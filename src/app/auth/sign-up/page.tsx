"use client";

import Link from "next/link";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [dealershipName, setDealershipName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const supabase = createClient();
      
      const rawSlug = dealershipName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const slug = rawSlug || `dealership-${Date.now().toString(36)}`;

      // 1. Sign up user via browser Supabase client
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (authData.session) {
        // 2. Provision dealership atomically via RPC with the active session
        const { error: rpcError } = await supabase.rpc("create_dealership", {
          dealership_name: dealershipName.trim(),
          dealership_slug: slug,
        });

        if (rpcError) {
          console.error("Dealership bootstrap RPC error:", rpcError);
        }

        // Navigate with active session cookies
        window.location.href = "/account";
      } else {
        setMessage(
          "Account created! Please check your email for confirmation before signing in.",
        );
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md p-6 bg-stone-900 border border-stone-800 rounded-xl shadow-lg mt-8 text-stone-100">
        <h1 className="text-2xl font-bold text-white mb-2">Create Dealership Account</h1>
        <p className="text-sm text-stone-400 mb-6">
          Set up your dealership tenant with administrator privileges.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-950/80 border border-red-800 text-red-200 text-sm rounded">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-sm rounded">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-300 mb-1">
              Dealership / Business Name
            </label>
            <input
              type="text"
              required
              value={dealershipName}
              onChange={(e) => setDealershipName(e.target.value)}
              className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded text-stone-100 focus:outline-none focus:border-amber-500 text-sm"
              placeholder="e.g. Apex Luxury Motors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-300 mb-1">
              Your Full Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded text-stone-100 focus:outline-none focus:border-amber-500 text-sm"
              placeholder="Alex Vance"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-300 mb-1">
              Work Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded text-stone-100 focus:outline-none focus:border-amber-500 text-sm"
              placeholder="alex@apexmotors.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-300 mb-1">
              Password (min. 8 characters)
            </label>
            <input
              type="password"
              required
              minLength={8}
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
            {loading ? "Creating Account..." : "Create Dealership Account"}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-stone-800 text-center text-sm text-stone-400">
          Already have an account?{" "}
          <Link href="/auth/sign-in" className="text-amber-400 hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
