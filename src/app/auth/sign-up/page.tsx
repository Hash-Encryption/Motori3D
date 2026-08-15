"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";

export default function SignUpPage() {
  const router = useRouter();
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
      const response = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          fullName,
          dealershipName,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Sign up failed.");
      }

      if (data.sessionCreated) {
        window.location.href = "/account";
      } else {
        setMessage(
          "Account created! Please check your email for confirmation before signing in.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
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
