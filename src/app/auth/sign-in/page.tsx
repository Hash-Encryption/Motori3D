"use client";

import Link from "next/link";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (!data.session) {
        throw new Error("Unable to establish session. Please verify your credentials.");
      }

      // Session cookies are written to document.cookie by @supabase/ssr browser client.
      window.location.href = "/account";
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md p-6 bg-stone-900 border border-stone-800 rounded-xl shadow-lg mt-8 text-stone-100">
        <h1 className="text-2xl font-bold text-white mb-2">Dealership Sign In</h1>
        <p className="text-sm text-stone-400 mb-6">
          Sign in to access your authorized dealership projects.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-950/80 border border-red-800 text-red-200 text-sm rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded text-stone-100 focus:outline-none focus:border-amber-500 text-sm"
              placeholder="dealer@dealership.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-300 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded text-stone-100 focus:outline-none focus:border-amber-500 text-sm"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded text-sm transition-colors disabled:opacity-50"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-stone-800 text-center text-sm text-stone-400">
          Need a dealership account?{" "}
          <Link href="/auth/sign-up" className="text-amber-400 hover:underline">
            Create Dealership
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
