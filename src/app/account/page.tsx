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
      <div className="mx-auto max-w-2xl p-6 bg-white border border-slate-200 rounded-xl shadow-xs mt-6 text-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Dealership Account</h1>
            <p className="text-sm text-slate-500">
              SaaS Control Plane & Multi-Tenant Context
            </p>
          </div>
          <AccountClientActions />
        </div>

        <div className="space-y-6">
          {/* User Profile Info */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Authenticated Identity
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-500 block text-xs">Email</span>
                <span className="font-mono text-slate-800 text-xs">{user.email}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">Full Name</span>
                <span className="text-slate-800">
                  {profile?.fullName || "Not specified"}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-500 block text-xs">Supabase User ID</span>
                <span className="font-mono text-xs text-slate-500">{user.id}</span>
              </div>
            </div>
          </div>

          {/* Active Dealership Info */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Active Dealership Tenant
              </h2>
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                role === "DEALER_ADMIN"
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-slate-100 text-slate-700 border-slate-200"
              }`}>
                {role === "DEALER_ADMIN" ? "Administrator" : "Member"}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-500 block text-xs">Dealership Name</span>
                <span className="font-semibold text-slate-900">{business.name}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">Slug</span>
                <span className="font-mono text-slate-700">/{business.slug}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">Business UUID</span>
                <span className="font-mono text-xs text-slate-500">{business.id}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">Status</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {business.status}
                </span>
              </div>
            </div>
          </div>

          {/* Dealership Switcher if multi-tenant */}
          {allMemberships.length > 1 && (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Switch Dealership ({allMemberships.length} memberships)
              </h2>
              <div className="space-y-2">
                {allMemberships.map((m) => (
                  <div
                    key={m.business.id}
                    className={`flex items-center justify-between p-3 rounded-lg border text-sm transition-colors ${
                      m.business.id === business.id
                        ? "bg-red-50/70 border-red-200 text-red-900 font-medium"
                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <div>
                      <span className="font-medium">{m.business.name}</span>
                      <span className="text-xs text-slate-500 ml-2">
                        ({m.role === "DEALER_ADMIN" ? "Admin" : "Member"})
                      </span>
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
                          className="px-2.5 py-1 text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 rounded border border-slate-200 shadow-2xs cursor-pointer"
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
              href="/app"
              className="text-sm text-slate-500 hover:text-slate-900 hover:underline"
            >
              ← Back to Dealership Overview
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
