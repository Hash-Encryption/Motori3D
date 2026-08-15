"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AccountClientActions() {
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/auth/sign-in";
    } catch (err) {
      console.error("Sign out failed", err);
      window.location.href = "/auth/sign-in";
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white text-xs font-semibold rounded border border-stone-700 transition-colors disabled:opacity-50"
    >
      {loading ? "Signing Out..." : "Sign Out"}
    </button>
  );
}
