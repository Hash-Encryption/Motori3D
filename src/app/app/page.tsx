import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/server/auth/auth-context";
import { listInventoryVehicles } from "@/server/vehicles/inventory-repository";

export const metadata = {
  title: "Dealership Overview — Vehicle 360",
};

export const dynamic = "force-dynamic";

export default async function DealershipOverviewPage() {
  const context = await getAuthContext().catch(() => null);

  if (!context) {
    redirect("/auth/sign-in");
  }

  // If user is a super admin with no dealership membership, route them to Super Admin console
  if (!context.business) {
    if (context.isSuperAdmin) {
      redirect("/super-admin/clients");
    }

    // Safe unassigned state
    return (
      <AppShell>
        <div className="max-w-md mx-auto py-16 px-4 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">No Dealership Membership</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            Your authenticated account ({context.user.email}) does not currently belong to an active dealership.
            Contact your dealership administrator to receive an invitation.
          </p>
          <div className="pt-2">
            <Link
              href="/account"
              className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Account Details
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const { business, role } = context;
  const supabase = await createClient();
  const vehicles = await listInventoryVehicles(supabase, business.id).catch(() => []);

  const totalCount = vehicles.length;
  const publishedCount = vehicles.filter((v) => v.status === "PUBLISHED").length;
  const draftCount = vehicles.filter((v) => v.status === "DRAFT").length;
  const soldCount = vehicles.filter((v) => v.status === "SOLD").length;

  const recentVehicles = vehicles.slice(0, 5);
  const roleLabel = role === "DEALER_ADMIN" ? "Dealership Admin" : "Team Member";

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Dealership Header & Primary Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-2xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                {roleLabel}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {business.status}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {business.name}
            </h1>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              /{business.slug} • Tenant ID: {business.id.slice(0, 8)}...
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/vehicles"
              className="inline-flex items-center justify-center px-3.5 py-2 rounded-lg text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors min-h-[40px]"
            >
              View Inventory
            </Link>
            <Link
              href="/vehicles/new"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 shadow-xs transition-colors min-h-[40px]"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Add Vehicle
            </Link>
          </div>
        </div>

        {/* Lightweight Operational Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">
              Total Inventory
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1">{totalCount}</div>
            <span className="text-[11px] text-slate-500 font-medium">vehicles tracked</span>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">
              Published
            </span>
            <div className="text-2xl font-black text-emerald-600 mt-1">{publishedCount}</div>
            <span className="text-[11px] text-slate-500 font-medium">active for buyers</span>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">
              Draft
            </span>
            <div className="text-2xl font-black text-slate-700 mt-1">{draftCount}</div>
            <span className="text-[11px] text-slate-500 font-medium">in preparation</span>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">
              Sold
            </span>
            <div className="text-2xl font-black text-slate-400 mt-1">{soldCount}</div>
            <span className="text-[11px] text-slate-500 font-medium">completed sales</span>
          </div>
        </div>

        {/* Recent Inventory Overview */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Recent Inventory
              </h2>
              <p className="text-[11px] text-slate-500">
                Latest vehicles entered in {business.name}
              </p>
            </div>
            {vehicles.length > 5 && (
              <Link
                href="/vehicles"
                className="text-xs font-bold text-red-600 hover:text-red-700 transition-colors inline-flex items-center gap-1"
              >
                View all ({totalCount}) →
              </Link>
            )}
          </div>

          {recentVehicles.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="text-sm font-bold text-slate-900">No vehicles in inventory yet</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Add your first vehicle record to begin uploading 360 walkaround videos and generating interactive spins.
              </p>
              <div className="pt-2">
                <Link
                  href="/vehicles/new"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-xs"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Add First Vehicle
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/60 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                    <th className="py-3 px-4">Vehicle</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Price / Mileage</th>
                    <th className="py-3 px-4">VIN / Stock #</th>
                    <th className="py-3 px-4">360 Spin</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentVehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/vehicles/${v.id}`}
                          className="font-bold text-slate-900 hover:text-red-600 transition-colors"
                        >
                          {v.year} {v.make} {v.model}
                        </Link>
                        {v.trim && <span className="text-[11px] text-slate-400 block">{v.trim}</span>}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            v.status === "PUBLISHED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : v.status === "SOLD"
                                ? "bg-slate-100 text-slate-600 border border-slate-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {v.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {v.price != null ? `$${v.price.toLocaleString()}` : "—"}
                        {v.mileage != null && (
                          <span className="text-slate-400 text-[11px] block font-normal">
                            {v.mileage.toLocaleString()} mi
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                        {v.stockNumber ? `#${v.stockNumber}` : v.vin || "—"}
                      </td>
                      <td className="py-3.5 px-4">
                        {v.isSpinReady ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Ready ({v.frameCount}f)
                          </span>
                        ) : v.captureStatus === "PROCESSING" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Processing
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">No spin</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/vehicles/${v.id}`}
                          className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                          Open →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
