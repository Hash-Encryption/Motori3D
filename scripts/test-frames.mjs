import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envFile = fs.readFileSync(".env.local", "utf8");
let supabaseUrl = "";
let serviceKey = "";

for (const line of envFile.split("\n")) {
  if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) {
    supabaseUrl = line.split("=")[1].trim();
  }
  if (line.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) {
    serviceKey = line.split("=")[1].trim();
  }
}

if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
}

const supabase = createClient(supabaseUrl, serviceKey);

async function testFrames() {
  const { data: capture } = await supabase
    .from("cloud_captures")
    .select("*")
    .eq("vehicle_id", "10f35412-b037-4d38-869a-7a78477bfede")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  console.log("Latest capture:", capture);

  const { data: frames } = await supabase
    .from("cloud_capture_frames")
    .select("*")
    .eq("capture_id", capture.id)
    .order("frame_index", { ascending: true });

  console.log("Total frames found for latest capture:", frames?.length);
  if (frames && frames.length > 0) {
    console.log("Frame 0 URL:", frames[0].public_url);
    console.log("Frame 47 URL:", frames[frames.length - 1].public_url);
    
    // Test fetching frame 0 via fetch
    const res = await fetch(frames[0].public_url);
    console.log("HTTP status of Frame 0:", res.status, res.headers.get("content-type"));
  }
}

testFrames().catch(console.error);
