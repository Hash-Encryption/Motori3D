import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdminContext } from "@/server/auth/auth-context";
import { getPlatformClientDetail } from "@/server/admin/super-admin-repository";
import { SuperAdminShell } from "@/components/super-admin-shell";
import { SuperAdminStatusToggle } from "@/components/super-admin-status-toggle";

export const metadata = {
  title: "Dealership Inspection — Super Admin",
};

export const dynamic = "force-dynamic";

type PageParams = {
  id: string;
};

export default async function SuperAdminClientDetailPage(props: {
  params: Promise<PageParams>;
}) {
  const { id } = await props.params;
  const context = await requireSuperAdminContext();
  const client = await getPlatformClientDetail(id);

  if (!client) {
    notFound();
  }

  return (
    <SuperAdminShell userEmail={context.user.email || "admin@platform"}>
      <div className="space-y-6 max-w-5xl">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            href="/super-admin/clients"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Clients Directory
          </Link>
        </div>

        {/* Client Identity & Status Card */}
        <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Client ID
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  {client.id}
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
                {client.name}
              </h1>
              <p className="text-xs font-mono text-slate-500 mt-0.5">
                Slug: /{client.slug}
              </p>
            </div>

            {/* Status Management */}
            <SuperAdminStatusToggle
              businessId={client.id}
              businessName={client.name}
              initialStatus={client.status}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-1">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Created Date</span>
              <span className="font-semibold text-slate-800">
                {new Date(client.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Last Updated</span>
              <span className="font-semibold text-slate-800">
                {new Date(client.updatedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Active Members</span>
              <span className="font-semibold text-slate-800">{client.members.length}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Inventory</span>
              <span className="font-semibold text-slate-800">{client.vehicles.length}</span>
            </div>
          </div>
        </div>

        {/* Memberships Summary */}
        <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Dealership Memberships ({client.members.length})
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">
              Real persisted tenant users
            </span>
          </div>

          {client.members.length === 0 ? (
            <p className="text-xs text-slate-500">No active memberships associated with this dealership.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                    <th className="py-2.5 px-3">User</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Joined Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {client.members.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">
                          {m.fullName || "User Account"}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">{m.userId}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {m.role === "DEALER_ADMIN" ? "Administrator" : "Team Member"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-emerald-600 font-semibold">{m.status}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Existing Vehicles Relationship Summary */}
        <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Vehicle Inventory ({client.vehicles.length})
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">
              Canonical Supabase records
            </span>
          </div>

          {client.vehicles.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No inventory units created yet for this dealership.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                    <th className="py-2.5 px-3">Vehicle</th>
                    <th className="py-2.5 px-3">Lifecycle Status</th>
                    <th className="py-2.5 px-3">Price / Mileage</th>
                    <th className="py-2.5 px-3">VIN / Stock #</th>
                    <th className="py-2.5 px-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {client.vehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {v.year} {v.make} {v.model}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
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
                      <td className="py-2.5 px-3 text-slate-700">
                        {v.price != null ? `$${v.price.toLocaleString()}` : "—"}
                        {v.mileage != null && (
                          <span className="text-slate-400 text-[11px] block">
                            {v.mileage.toLocaleString()} mi
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                        {v.stockNumber ? `#${v.stockNumber}` : v.vin || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                        {new Date(v.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </SuperAdminShell>
  );
}
