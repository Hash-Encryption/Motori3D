import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { CreateVehicleForm } from "@/components/create-vehicle-form";
import { getAuthContext } from "@/server/auth/auth-context";

export const metadata = {
  title: "New Inventory Vehicle",
};

export const dynamic = "force-dynamic";

export default async function NewVehiclePage() {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/auth/sign-in");
  }

  return (
    <AppShell>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Dealership Inventory</p>
          <h1>Add New Vehicle</h1>
          <p className="page-description">
            Create an authoritative inventory record for{" "}
            <strong>{authContext.business.name}</strong>. Video walkaround upload and 360 processing follow after saving.
          </p>
        </div>
      </section>

      <section className="panel" aria-labelledby="vehicle-details-title">
        <h2 id="vehicle-details-title">Vehicle Specifications</h2>
        <p className="helper-text">
          Make, model, and year are required. Price, mileage, VIN, and stock number can be filled now or updated later.
        </p>
        <CreateVehicleForm />
      </section>
    </AppShell>
  );
}
