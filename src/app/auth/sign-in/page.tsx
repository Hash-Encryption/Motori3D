"use client";

import Link from "next/link";
import { useState } from "react";

import { AuthShell } from "@/components/auth-shell";
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

      // Check query params for intended redirect
      const searchParams = new URLSearchParams(window.location.search);
      const nextParam = searchParams.get("next");

      // Resolve context to determine valid application destination
      const ctxRes = await fetch("/api/auth/context").catch(() => null);
      if (ctxRes && ctxRes.ok) {
        const ctx = await ctxRes.json().catch(() => ({}));
        
        // If specific safe internal redirect requested
        if (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")) {
          // If trying to access /super-admin, only allow if verified super admin
          if (nextParam.startsWith("/super-admin")) {
            if (ctx.isSuperAdmin) {
              window.location.href = nextParam;
              return;
            }
          } else {
            window.location.href = nextParam;
            return;
          }
        }

        // Dealership user destination
        if (ctx.business) {
          window.location.href = "/app";
          return;
        }

        // Platform Super Admin without dealership
        if (ctx.isSuperAdmin) {
          window.location.href = "/super-admin/clients";
          return;
        }
      }

      // Default application entry
      window.location.href = "/app";
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="mx-auto max-w-md p-6 sm:p-8 bg-white border border-slate-200 rounded-xl shadow-xs mt-8 text-slate-900">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">Dealership Sign In</h1>
        <p className="text-sm text-slate-500 mb-6">
          Access your inventory control plane and 360 processing workbench.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Email Address
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
              Password
            </label>
            <input
              type="password"
              required
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
            {loading ? "Signing In..." : "Sign In to Dealership"}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 text-center text-sm text-slate-500">
          Need a dealership workspace?{" "}
          <Link href="/auth/sign-up" className="text-red-600 font-medium hover:underline">
            Register Dealership
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
