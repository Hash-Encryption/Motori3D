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
