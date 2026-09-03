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

async function fix() {
  console.log("Setting all cloud_captures status to READY...");
  const { data, error } = await supabase
    .from("cloud_captures")
    .update({ status: "READY" })
    .neq("status", "READY")
    .select();

  if (error) {
    console.error("Update error:", error);
  } else {
    console.log("Updated captures to READY:", data);
  }
}

fix().catch(console.error);
