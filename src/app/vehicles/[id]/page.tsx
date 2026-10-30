import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ListingDetailView } from "@/components/listing-detail-view";
import { VehicleDetailView } from "@/components/vehicle-detail-view";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/server/auth/auth-context";
import {
  getInventoryVehicle,
  getVehicleListingWithUnits,
} from "@/server/vehicles/inventory-repository";

export const metadata = {
  title: "Vehicle Listing & Inventory",
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

  // 1. Try resolving ID as a Vehicle Listing
  let listing = null;
  try {
    listing = await getVehicleListingWithUnits(
      supabase,
      id,
      authContext.business.id,
    );
  } catch {
    // If listing query fails, check vehicle unit lookup
  }

  if (listing) {
    return (
      <AppShell>
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Link
              href="/vehicles"
              className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1"
            >
              ← Back to Listings & Inventory
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Dealership:</span>
              <span className="text-xs font-semibold text-slate-900">
                {authContext.business.name}
              </span>
            </div>
          </div>

          <ListingDetailView
            initialListing={listing}
            dealershipName={authContext.business.name}
          />
        </div>
      </AppShell>
    );
  }

  // 2. Fallback: try resolving ID as a Physical Inventory Unit
  const vehicle = await getInventoryVehicle(
    supabase,
    id,
    authContext.business.id,
  );

  if (!vehicle) {
    notFound();
  }

  // If physical unit has an associated listing, redirect to canonical listing view
  if (vehicle.listingId) {
    redirect(`/vehicles/${vehicle.listingId}`);
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/vehicles"
            className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1"
          >
            ← Back to Inventory
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Dealership:</span>
            <span className="text-xs font-semibold text-slate-900">
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
