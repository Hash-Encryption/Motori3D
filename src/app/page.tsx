import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { InventoryDashboard } from "@/components/inventory-dashboard";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/server/auth/auth-context";
import { listInventoryVehicles } from "@/server/vehicles/inventory-repository";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const authContext = await getAuthContext().catch(() => null);

  if (authContext) {
    const supabase = await createClient();
    const vehicles = await listInventoryVehicles(
      supabase,
      authContext.business.id,
    ).catch(() => []);

    return (
      <AppShell>
        <InventoryDashboard
          initialVehicles={vehicles}
          business={authContext.business}
          role={authContext.role}
        />
      </AppShell>
    );
  }

  // Unauthenticated Welcome View
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto py-12 px-4 text-center space-y-8">
        <div className="space-y-4">
          <p className="eyebrow inline-block">Dealership 360 Platform</p>
          <h1 className="text-4xl font-extrabold text-white tracking-tight sm:text-5xl">
            Vehicle 360 Inventory
          </h1>
          <p className="text-lg text-stone-400 max-w-xl mx-auto">
            B2B dealership SaaS platform connecting physical walkaround video captures with interactive, drag-to-rotate 360 vehicle viewers.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/auth/sign-in"
            className="button button-primary w-full sm:w-auto px-8 py-3 text-base"
          >
            Sign In to Dealership
          </Link>
          <Link
            href="/auth/sign-up"
            className="button button-secondary w-full sm:w-auto px-8 py-3 text-base"
          >
            Register Dealership
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12 border-t border-stone-800 text-left">
          <div className="bg-stone-900/50 p-5 rounded-xl border border-stone-800">
            <h3 className="font-semibold text-white text-sm mb-1">Dealership Isolation</h3>
            <p className="text-xs text-stone-400">
              Multi-tenant architecture with Supabase PostgreSQL Row Level Security (RLS).
            </p>
          </div>
          <div className="bg-stone-900/50 p-5 rounded-xl border border-stone-800">
            <h3 className="font-semibold text-white text-sm mb-1">Interactive 360</h3>
            <p className="text-xs text-stone-400">
              One continuous walkaround video transforms into 48-frame high-resolution interactive spins.
            </p>
          </div>
          <div className="bg-stone-900/50 p-5 rounded-xl border border-stone-800">
            <h3 className="font-semibold text-white text-sm mb-1">Inventory Management</h3>
            <p className="text-xs text-stone-400">
              Lifecycle status control (Draft, Published, Sold) and complete vehicle specifications.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
