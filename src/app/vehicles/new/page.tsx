import { AppShell } from "@/components/app-shell";
import { CreateVehicleForm } from "@/components/create-vehicle-form";

export const metadata = {
  title: "New vehicle",
};

export default function NewVehiclePage() {
  return (
    <AppShell>
      <section className="page-heading">
        <div>
          <p className="eyebrow">New capture</p>
          <h1>Create vehicle</h1>
          <p className="page-description">
            Add the vehicle details first. Video upload follows after the
            project is saved.
          </p>
        </div>
      </section>

      <section className="panel" aria-labelledby="vehicle-details-title">
        <h2 id="vehicle-details-title">Vehicle details</h2>
        <p className="helper-text">All fields except the stock identifier are required.</p>
        <CreateVehicleForm />
      </section>
    </AppShell>
  );
}
