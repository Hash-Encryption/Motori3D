import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type CloudCapture = Database["public"]["Tables"]["cloud_captures"]["Row"];
export type CloudCaptureFrame = Database["public"]["Tables"]["cloud_capture_frames"]["Row"];

export async function getLatestCloudCaptureForVehicle(
  supabase: SupabaseClient<Database>,
  vehicleId: string,
): Promise<CloudCapture | null> {
  const { data, error } = await supabase
    .from("cloud_captures")
    .select("*")
    .eq("vehicle_id", vehicleId)
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
): Promise<CloudCaptureFrame[]> {
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
