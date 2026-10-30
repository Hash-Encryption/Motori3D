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
      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-semibold rounded-lg border border-slate-200 shadow-sm transition-colors disabled:opacity-50"
    >
      {loading ? "Signing Out..." : "Sign Out"}
    </button>
  );
}
