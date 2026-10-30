import { requireSuperAdminContext } from "@/server/auth/auth-context";
import { listPlatformClients } from "@/server/admin/super-admin-repository";
import { SuperAdminShell } from "@/components/super-admin-shell";
import { SuperAdminClientsTable } from "@/components/super-admin-clients-table";

export const metadata = {
  title: "Dealership Clients — Super Admin",
};

export const dynamic = "force-dynamic";

export default async function SuperAdminClientsPage() {
  const context = await requireSuperAdminContext();
  const clients = await listPlatformClients();

  const totalClients = clients.length;
  const activeClients = clients.filter((c) => c.status === "ACTIVE").length;
  const totalVehicles = clients.reduce((acc, c) => acc + c.vehicleCount, 0);

  return (
    <SuperAdminShell userEmail={context.user.email || "admin@platform"}>
      <div className="space-y-6">
        {/* Page Heading & High-Level Operational Metrics */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Dealership Clients
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Platform-wide dealership tenant administration operating on real persisted records.
            </p>
          </div>

          {/* Quick Stats Strip */}
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Clients</span>
              <span className="font-extrabold text-slate-900">{totalClients}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Active</span>
              <span className="font-extrabold text-emerald-600">{activeClients}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Inventory</span>
              <span className="font-extrabold text-slate-900">{totalVehicles}</span>
            </div>
          </div>
        </div>

        {/* Real Persisted Client Directory */}
        <SuperAdminClientsTable initialClients={clients} />
      </div>
    </SuperAdminShell>
  );
}
