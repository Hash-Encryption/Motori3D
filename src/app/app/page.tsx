import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getAuthContext } from "@/server/auth/auth-context";

export const dynamic = "force-dynamic";

export default async function AppVerificationPage() {
  const context = await getAuthContext().catch(() => null);

  if (!context) {
    redirect("/auth/sign-in");
  }

  const { user, business, role, isSuperAdmin } = context;

  return (
    <AppShell>
      <div className="mx-auto max-w-xl p-6 bg-stone-900 border border-stone-800 rounded-xl mt-8 text-stone-100 font-mono text-sm space-y-4 shadow-lg">
        <div className="border-b border-stone-800 pb-3">
          <h1 className="text-lg font-bold text-white font-sans">
            Phase 04 Verification
          </h1>
          <p className="text-xs text-stone-400 font-sans mt-0.5">
            Backend / Authentication / Connectivity Quick Check
          </p>
        </div>

        <div className="space-y-3 pt-1">
          <div>
            <span className="text-stone-500 text-xs block font-sans">Authenticated User:</span>
            <span className="text-amber-400 font-semibold">{user.email}</span>
            <span className="text-stone-500 text-xs ml-2">({user.id})</span>
          </div>

          <div>
            <span className="text-stone-500 text-xs block font-sans">Business:</span>
            <span className="text-stone-100 font-semibold">{business.name}</span>
            <span className="text-stone-500 text-xs ml-2">({business.id})</span>
          </div>

          <div>
            <span className="text-stone-500 text-xs block font-sans">Role:</span>
            <span className="text-stone-200">{role}</span>
            {isSuperAdmin && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-purple-900/80 text-purple-200 border border-purple-700 rounded font-sans">
                SUPER_ADMIN
              </span>
            )}
          </div>

          <div className="pt-3 border-t border-stone-800 flex items-center justify-between">
            <span className="text-stone-400 font-sans text-sm">Backend:</span>
            <span className="text-emerald-400 font-bold">Connected ✓</span>
          </div>
        </div>

        <div className="pt-4 border-t border-stone-800 flex items-center justify-between text-xs font-sans">
          <Link href="/" className="text-amber-400 hover:underline">
            ← Inventory
          </Link>
          <Link href="/account" className="text-stone-400 hover:underline">
            Account Details →
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
