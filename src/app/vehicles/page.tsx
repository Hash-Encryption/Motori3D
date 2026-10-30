import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { InventoryDashboard } from "@/components/inventory-dashboard";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/server/auth/auth-context";
import {
  listInventoryVehicles,
  listVehicleListings,
} from "@/server/vehicles/inventory-repository";
import type { EnrichedInventoryVehicle } from "@/server/vehicles/inventory-types";

export const metadata = {
  title: "Vehicle Listings & Inventory — Vehicle 360",
};

export const dynamic = "force-dynamic";

export default async function VehiclesPage() {
  const context = await getAuthContext().catch(() => null);

  if (!context) {
    redirect("/auth/sign-in");
  }

  if (!context.business) {
    redirect("/app");
  }

  const supabase = await createClient();

  // Load listings first; fallback to inventory vehicles if listings table is still being migrated
  const listings = await listVehicleListings(supabase, context.business.id).catch(() => []);
  let vehicles: EnrichedInventoryVehicle[] = [];

  if (listings.length === 0) {
    vehicles = await listInventoryVehicles(supabase, context.business.id).catch(() => []);
  }

  return (
    <AppShell>
      <InventoryDashboard
        initialListings={listings.length > 0 ? listings : undefined}
        initialVehicles={vehicles}
        business={context.business}
        role={context.role}
      />
    </AppShell>
  );
}
