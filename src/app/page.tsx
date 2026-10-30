import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getAuthContext } from "@/server/auth/auth-context";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const authContext = await getAuthContext().catch(() => null);

  if (authContext) {
    if (authContext.business) {
      redirect("/app");
    }
    if (authContext.isSuperAdmin) {
      redirect("/super-admin/clients");
    }
    redirect("/app");
  }

  // Unauthenticated Welcome View — Design Lock: Light Mode, Performance Red, Clean Automotive SaaS
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto py-12 sm:py-16 px-4 text-center space-y-8">
        <div className="space-y-3">
          <p className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-red-700 bg-red-50 border border-red-200">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
            Automotive Dealership 360 Platform
          </p>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Vehicle 360 Platform
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto font-normal leading-relaxed">
            Enterprise dealership SaaS connecting physical walkaround video captures with high-definition, interactive 360 vehicle viewers.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
          <Link
            href="/auth/sign-in"
            className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 shadow-sm transition-all min-h-[48px]"
          >
            Sign In to Dealership
          </Link>
          <Link
            href="/auth/sign-up"
            className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 rounded-xl text-sm font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 transition-all min-h-[48px]"
          >
            Register Dealership
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-12 border-t border-slate-200 text-left">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
            <h3 className="font-bold text-slate-900 text-sm">Tenant Isolation</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Strict multi-tenant architecture enforced by PostgreSQL Row Level Security (RLS).
            </p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
            <h3 className="font-bold text-slate-900 text-sm">Interactive 360</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Continuous walkaround video transforms into 48-frame high-resolution interactive spins.
            </p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
            <h3 className="font-bold text-slate-900 text-sm">Inventory Management</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Complete vehicle specifications and lifecycle control (Draft, Published, Sold).
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
