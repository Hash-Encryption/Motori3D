import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getAuthContext } from "@/server/auth/auth-context";
import { AccountClientActions } from "./account-client-actions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const context = await getAuthContext();

  if (!context) {
    redirect("/auth/sign-in");
  }

  const { user, profile, business, role, allMemberships } = context;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl p-6 bg-stone-900 border border-stone-800 rounded-xl shadow-lg mt-6 text-stone-100">
        <div className="flex items-center justify-between border-b border-stone-800 pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Dealership Account</h1>
            <p className="text-sm text-stone-400">
              SaaS Control Plane & Multi-Tenant Context
            </p>
          </div>
          <AccountClientActions />
        </div>

        <div className="space-y-6">
          {/* User Profile Info */}
          <div className="bg-stone-950 p-4 rounded-lg border border-stone-800">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">
              Authenticated Identity
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-stone-500 block text-xs">Email</span>
                <span className="font-mono text-stone-200">{user.email}</span>
              </div>
              <div>
                <span className="text-stone-500 block text-xs">Full Name</span>
                <span className="text-stone-200">
                  {profile?.fullName || "Not specified"}
                </span>
              </div>
              <div>
                <span className="text-stone-500 block text-xs">Supabase User ID</span>
                <span className="font-mono text-xs text-stone-400">{user.id}</span>
              </div>
            </div>
          </div>

          {/* Active Dealership Info */}
          <div className="bg-stone-950 p-4 rounded-lg border border-stone-800">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                Active Dealership Tenant
              </h2>
              <span className="px-2 py-0.5 text-xs font-medium rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {role === "DEALER_ADMIN" ? "Administrator" : "Member"}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-stone-500 block text-xs">Dealership Name</span>
                <span className="font-semibold text-white">{business.name}</span>
              </div>
              <div>
                <span className="text-stone-500 block text-xs">Slug</span>
                <span className="font-mono text-stone-300">/{business.slug}</span>
              </div>
              <div>
                <span className="text-stone-500 block text-xs">Business UUID</span>
                <span className="font-mono text-xs text-stone-400">{business.id}</span>
              </div>
              <div>
                <span className="text-stone-500 block text-xs">Status</span>
                <span className="text-emerald-400 font-medium">{business.status}</span>
              </div>
            </div>
          </div>

          {/* Dealership Switcher if multi-tenant */}
          {allMemberships.length > 1 && (
            <div className="bg-stone-950 p-4 rounded-lg border border-stone-800">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">
                Switch Dealership ({allMemberships.length} memberships)
              </h2>
              <div className="space-y-2">
                {allMemberships.map((m) => (
                  <div
                    key={m.business.id}
                    className={`flex items-center justify-between p-2 rounded border text-sm ${
                      m.business.id === business.id
                        ? "bg-amber-950/40 border-amber-700/60 text-amber-200"
                        : "bg-stone-900 border-stone-800 text-stone-300 hover:border-stone-700"
                    }`}
                  >
                    <div>
                      <span className="font-medium">{m.business.name}</span>
                      <span className="text-xs text-stone-500 ml-2">({m.role})</span>
                    </div>
                    {m.business.id !== business.id && (
                      <form
                        action="/api/auth/context"
                        method="POST"
                        className="inline"
                      >
                        <input type="hidden" name="businessId" value={m.business.id} />
                        <button
                          type="submit"
                          className="px-2.5 py-1 text-xs bg-stone-800 hover:bg-stone-700 text-stone-200 rounded border border-stone-600"
                        >
                          Select
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Link
              href="/"
              className="text-sm text-stone-400 hover:text-stone-200 hover:underline"
            >
              ← Back to Vehicles
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
