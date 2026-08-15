import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { VehicleDetailView } from "@/components/vehicle-detail-view";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/server/auth/auth-context";
import { getInventoryVehicle } from "@/server/vehicles/inventory-repository";

export const metadata = {
  title: "Vehicle Details",
};

export const dynamic = "force-dynamic";

export default async function VehicleDetailPage(
  props: PageProps<"/vehicles/[id]">,
) {
  const { id } = await props.params;
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/auth/sign-in");
  }

  const supabase = await createClient();
  const vehicle = await getInventoryVehicle(
    supabase,
    id,
    authContext.business.id,
  );

  if (!vehicle) {
    notFound();
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-xs text-stone-400 hover:text-stone-200 transition-colors flex items-center gap-1"
          >
            ← Back to Inventory
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-400">Dealership:</span>
            <span className="text-xs font-semibold text-stone-200">
              {authContext.business.name}
            </span>
          </div>
        </div>

        <VehicleDetailView
          initialVehicle={vehicle}
          dealershipName={authContext.business.name}
        />
      </div>
    </AppShell>
  );
}
