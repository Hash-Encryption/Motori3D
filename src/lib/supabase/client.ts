import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database.types";

const DEFAULT_SUPABASE_URL = "https://ilebbqeknviaqhyvpygv.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsZWJicWVrbnZpYXFoeXZweWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3ODM1MDgsImV4cCI6MjEwMjM1OTUwOH0.B8jLxuokX_m-xDj3yv3PfeyU84pxyJV2CNVVFOnD4NA";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
