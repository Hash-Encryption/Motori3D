"use client";

import Link from "next/link";
import { useState } from "react";

import { AuthShell } from "@/components/auth-shell";
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
    <AuthShell>
      <div className="mx-auto max-w-md p-6 sm:p-8 bg-white border border-slate-200 rounded-xl shadow-xs mt-8 text-slate-900">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">Create Dealership Account</h1>
        <p className="text-sm text-slate-500 mb-6">
          Set up your dealership tenant with administrator privileges.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Dealership / Business Name
            </label>
            <input
              type="text"
              required
              value={dealershipName}
              onChange={(e) => setDealershipName(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 text-sm shadow-2xs"
              placeholder="e.g. Apex Luxury Motors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Your Full Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 text-sm shadow-2xs"
              placeholder="Alex Vance"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Work Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 text-sm shadow-2xs"
              placeholder="alex@apexmotors.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Password (min. 8 characters)
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 text-sm shadow-2xs"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-sm transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            {loading ? "Creating Account..." : "Create Dealership Account"}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/auth/sign-in" className="text-red-600 font-medium hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
