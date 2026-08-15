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

/**
 * Uploads extracted WebP spin frames directly into Supabase Storage
 * and creates the corresponding cloud capture database records.
 */
export async function uploadSpinAssetToCloud(params: {
  businessId: string;
  vehicleId: string;
  asset: ExtractedSpinAsset;
  filename: string;
  onProgress?: UploadProgressCallback;
}): Promise<CloudCaptureResult> {
  const { businessId, vehicleId, asset, filename, onProgress } = params;
  const supabase = createClient();

  const captureId = crypto.randomUUID();
  const totalFrames = asset.frames.length;

  onProgress?.({
    uploadedFrames: 0,
    totalFrames,
    percent: 0,
    phase: "UPLOADING",
  });

  // Step 1: Create initial cloud_captures entry
  const { error: captureError } = await supabase.from("cloud_captures").insert({
    id: captureId,
    business_id: businessId,
    vehicle_id: vehicleId,
    status: "PROCESSING",
    frame_count: totalFrames,
    target_frame_count: asset.metadata.targetFrameCount,
    width: asset.metadata.width,
    height: asset.metadata.height,
    duration_seconds: asset.metadata.durationSeconds,
    fps: asset.metadata.fps,
    source_filename: filename,
  });

  if (captureError) {
    console.error("Failed to create cloud capture record:", captureError);
    throw new Error(`Failed to initialize cloud capture: ${captureError.message}`);
  }

  // Step 2: Upload all frames to Supabase Storage with concurrency control
  const concurrency = 6;
  const frameUploadResults: Array<{
    frameIndex: number;
    storagePath: string;
    publicUrl: string;
  }> = [];

  let completedCount = 0;

  async function uploadFrame(index: number): Promise<void> {
    const blob = asset.frames[index];
    const storagePath = `${businessId}/${vehicleId}/${captureId}/frame_${String(index).padStart(3, "0")}.webp`;

    const { error: uploadError } = await supabase.storage
      .from("vehicle-spins")
      .upload(storagePath, blob, {
        contentType: "image/webp",
        cacheControl: "31536000", // 1 year cache
        upsert: true,
      });

    if (uploadError) {
      console.error(`Failed to upload frame ${index}:`, uploadError);
      throw new Error(`Failed to upload frame ${index}: ${uploadError.message}`);
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

  // Step 3: Insert frame metadata records
  onProgress?.({
    uploadedFrames: totalFrames,
    totalFrames,
    percent: 100,
    phase: "SAVING_METADATA",
  });

  frameUploadResults.sort((a, b) => a.frameIndex - b.frameIndex);

  const frameInserts = frameUploadResults.map((f) => ({
    capture_id: captureId,
    frame_index: f.frameIndex,
    storage_path: f.storagePath,
    public_url: f.publicUrl,
    width: asset.metadata.width,
    height: asset.metadata.height,
  }));

  const { error: frameDbError } = await supabase
    .from("cloud_capture_frames")
    .insert(frameInserts);

  if (frameDbError) {
    console.error("Failed to save frame metadata:", frameDbError);
    // Non-fatal if public URLs can be derived from bucket
  }

  // Step 4: Mark capture as READY
  await supabase
    .from("cloud_captures")
    .update({ status: "READY", updated_at: new Date().toISOString() })
    .eq("id", captureId);

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
