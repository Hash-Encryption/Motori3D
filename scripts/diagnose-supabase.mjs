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

console.log("Connecting to Supabase at:", supabaseUrl);
const supabase = createClient(supabaseUrl, serviceKey);

async function runDiagnostics() {
  console.log("\n--- Checking Storage Buckets ---");
  const { data: buckets, error: bucketsErr } = await supabase.storage.listBuckets();
  if (bucketsErr) {
    console.error("Storage listBuckets error:", bucketsErr);
  } else {
    console.log("Buckets found:", buckets.map((b) => ({ id: b.id, name: b.name, public: b.public })));
  }

  console.log("\n--- Checking Vehicle 10f35412-b037-4d38-869a-7a78477bfede ---");
  const { data: vehicle, error: vehicleErr } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", "10f35412-b037-4d38-869a-7a78477bfede")
    .maybeSingle();

  if (vehicleErr) {
    console.error("Vehicle query error:", vehicleErr);
  } else {
    console.log("Vehicle data:", vehicle);
  }

  console.log("\n--- Checking Cloud Captures Table ---");
  const { data: captures, error: capturesErr } = await supabase
    .from("cloud_captures")
    .select("*");

  if (capturesErr) {
    console.error("cloud_captures query error:", capturesErr);
  } else {
    console.log("Total cloud_captures found:", captures?.length);
    console.log("Captures:", captures);
  }

  console.log("\n--- Checking Cloud Capture Frames Table ---");
  const { data: frames, error: framesErr } = await supabase
    .from("cloud_capture_frames")
    .select("*");

  if (framesErr) {
    console.error("cloud_capture_frames query error:", framesErr);
  } else {
    console.log("Total cloud_capture_frames found:", frames?.length);
  }

  console.log("\n--- Checking Storage Files in 'vehicle-spins' ---");
  const { data: files, error: filesErr } = await supabase.storage
    .from("vehicle-spins")
    .list();

  if (filesErr) {
    console.error("Storage list error in vehicle-spins:", filesErr);
  } else {
    console.log("Root files/folders in vehicle-spins:", files);
  }
}

runDiagnostics().catch(console.error);
