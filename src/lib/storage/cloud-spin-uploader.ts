import { createClient } from "@/lib/supabase/client";
import type { ExtractedSpinAsset } from "@/lib/video/client-frame-extractor";

export type UploadProgressCallback = (progress: {
  uploadedFrames: number;
  totalFrames: number;
  percent: number;
  phase: "UPLOADING" | "SAVING_METADATA" | "READY";
}) => void;

export type CloudCaptureResult = {
  captureId: string;
  vehicleId: string;
  frameCount: number;
  frameUrls: string[];
  width: number;
  height: number;
};

function isValidUuid(id: string | null | undefined): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Uploads extracted WebP spin frames directly into Supabase Storage
 * and creates the corresponding cloud capture database records.
 */
export async function uploadSpinAssetToCloud(params: {
  businessId?: string | null;
  vehicleId: string;
  asset: ExtractedSpinAsset;
  filename: string;
  onProgress?: UploadProgressCallback;
}): Promise<CloudCaptureResult> {
  const { vehicleId, asset, filename, onProgress } = params;
  const supabase = createClient();

  // Resolve authenticated user & active dealership UUID
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;

  let resolvedBusinessId: string | null = isValidUuid(params.businessId)
    ? params.businessId!
    : null;

  if (!resolvedBusinessId && user) {
    const { data: memberships } = await supabase
      .from("business_memberships")
      .select("business_id")
      .eq("user_id", user.id)
      .eq("status", "ACTIVE")
      .limit(1);

    resolvedBusinessId = memberships?.[0]?.business_id ?? null;
  }

  if (!resolvedBusinessId) {
    // Lookup vehicle's business_id directly
    const { data: vehicleRow } = await supabase
      .from("vehicles")
      .select("business_id")
      .eq("id", vehicleId)
      .maybeSingle();

    resolvedBusinessId = vehicleRow?.business_id ?? null;
  }

  const captureId = crypto.randomUUID();
  const totalFrames = asset.frames.length;
  const storageFolder = resolvedBusinessId || "public";

  onProgress?.({
    uploadedFrames: 0,
    totalFrames,
    percent: 0,
    phase: "UPLOADING",
  });

  // Step 1: Upload all frames directly to Supabase Storage with concurrency control
  const concurrency = 6;
  const frameUploadResults: Array<{
    frameIndex: number;
    storagePath: string;
    publicUrl: string;
  }> = [];

  let completedCount = 0;

  async function uploadFrame(index: number): Promise<void> {
    const blob = asset.frames[index];
    const storagePath = `${storageFolder}/${vehicleId}/${captureId}/frame_${String(index).padStart(3, "0")}.webp`;

    const { error: uploadError } = await supabase.storage
      .from("vehicle-spins")
      .upload(storagePath, blob, {
        contentType: "image/webp",
        cacheControl: "31536000", // 1 year cache
        upsert: true,
      });

    if (uploadError) {
      console.error(`Failed to upload frame ${index}:`, uploadError);
      throw new Error(`Failed to upload frame ${index} to cloud storage: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from("vehicle-spins")
      .getPublicUrl(storagePath);

    frameUploadResults.push({
      frameIndex: index,
      storagePath,
      publicUrl: publicUrlData.publicUrl,
    });

    completedCount++;
    onProgress?.({
      uploadedFrames: completedCount,
      totalFrames,
      percent: Math.round((completedCount / totalFrames) * 100),
      phase: "UPLOADING",
    });
  }

  // Execute in parallel batches of `concurrency`
  for (let i = 0; i < totalFrames; i += concurrency) {
    const batch = [];
    for (let j = i; j < Math.min(i + concurrency, totalFrames); j++) {
      batch.push(uploadFrame(j));
    }
    await Promise.all(batch);
  }

  // Step 2: Save metadata to cloud_captures table if business_id is available
  onProgress?.({
    uploadedFrames: totalFrames,
    totalFrames,
    percent: 100,
    phase: "SAVING_METADATA",
  });

  frameUploadResults.sort((a, b) => a.frameIndex - b.frameIndex);

  if (resolvedBusinessId) {
    try {
      const { error: captureError } = await supabase.from("cloud_captures").upsert({
        id: captureId,
        business_id: resolvedBusinessId,
        vehicle_id: vehicleId,
        status: "READY",
        frame_count: totalFrames,
        target_frame_count: asset.metadata.targetFrameCount,
        width: asset.metadata.width,
        height: asset.metadata.height,
        duration_seconds: asset.metadata.durationSeconds,
        fps: asset.metadata.fps,
        source_filename: filename,
        updated_at: new Date().toISOString(),
      });

      if (!captureError) {
        const frameInserts = frameUploadResults.map((f) => ({
          capture_id: captureId,
          frame_index: f.frameIndex,
          storage_path: f.storagePath,
          public_url: f.publicUrl,
          width: asset.metadata.width,
          height: asset.metadata.height,
        }));

        await supabase.from("cloud_capture_frames").upsert(frameInserts);
      } else {
        console.warn("Could not write to cloud_captures table:", captureError.message);
      }
    } catch (dbErr) {
      console.warn("Database metadata sync skipped:", dbErr);
    }
  }

  onProgress?.({
    uploadedFrames: totalFrames,
    totalFrames,
    percent: 100,
    phase: "READY",
  });

  return {
    captureId,
    vehicleId,
    frameCount: totalFrames,
    frameUrls: frameUploadResults.map((f) => f.publicUrl),
    width: asset.metadata.width,
    height: asset.metadata.height,
  };
}
