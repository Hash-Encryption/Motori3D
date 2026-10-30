import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type CloudCapture = Database["public"]["Tables"]["cloud_captures"]["Row"];
export type CloudCaptureFrame = Database["public"]["Tables"]["cloud_capture_frames"]["Row"];

export async function getLatestCloudCaptureForVehicle(
  supabase: SupabaseClient<Database>,
  vehicleId: string,
  businessId?: string,
): Promise<CloudCapture | null> {
  let query = supabase
    .from("cloud_captures")
    .select("*")
    .eq("vehicle_id", vehicleId);

  if (businessId) {
    query = query.eq("business_id", businessId);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to query cloud_captures:", error);
    return null;
  }

  return data;
}

export async function listCloudCaptureFrames(
  supabase: SupabaseClient<Database>,
  captureId: string,
  businessId?: string,
): Promise<CloudCaptureFrame[]> {
  if (businessId) {
    const { data: capture } = await supabase
      .from("cloud_captures")
      .select("id")
      .eq("id", captureId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (!capture) {
      return [];
    }
  }

  const { data, error } = await supabase
    .from("cloud_capture_frames")
    .select("*")
    .eq("capture_id", captureId)
    .order("frame_index", { ascending: true });

  if (error) {
    console.error("Failed to list cloud_capture_frames:", error);
    return [];
  }

  return data || [];
}

export async function getCloudCaptureFrameUrls(
  supabase: SupabaseClient<Database>,
  captureId: string,
  businessId?: string,
  expiresInSeconds = 3600,
): Promise<string[]> {
  const frames = await listCloudCaptureFrames(supabase, captureId, businessId);
  if (!frames || frames.length === 0) {
    return [];
  }

  // Attempt to generate secure signed URLs via server-side admin client
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const paths = frames.map((f) => f.storage_path);
    const { data: signedUrls, error } = await admin.storage
      .from("vehicle-spins")
      .createSignedUrls(paths, expiresInSeconds);

    if (!error && signedUrls && signedUrls.length === frames.length) {
      const validUrls = signedUrls
        .map((s) => s.signedUrl)
        .filter((url): url is string => Boolean(url));
      if (validUrls.length === frames.length) {
        return validUrls;
      }
    }
  } catch (err) {
    console.warn("Signed URL generation fallback to public_url:", err);
  }

  // Fallback to stored public_url
  return frames
    .map((f) => f.public_url)
    .filter((url): url is string => Boolean(url));
}
