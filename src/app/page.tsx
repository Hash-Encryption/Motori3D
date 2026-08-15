import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { listVehicles } from "@/server/vehicles/vehicle-repository";

export const dynamic = "force-dynamic";

const statusLabels = {
  DRAFT: "Awaiting video",
  PROCESSING: "Processing",
  READY: "Ready",
  FAILED: "Needs attention",
} as const;

export default function ProjectsPage() {
  const vehicles = listVehicles();

  return (
    <AppShell>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Vehicle library</p>
          <h1>Vehicle 360</h1>
          <p className="page-description">
            Turn one real walkaround video into a drag-to-rotate vehicle view.
          </p>
        </div>
        <Link className="button button-primary" href="/vehicles/new">
          <span aria-hidden="true">+</span>
          New vehicle
        </Link>
      </section>

      {vehicles.length === 0 ? (
        <section className="empty-state" aria-labelledby="empty-title">
          <div className="empty-mark" aria-hidden="true">
            360°
          </div>
          <div>
            <h2 id="empty-title">No vehicle captures yet</h2>
            <p>
              Create a vehicle project, upload one walkaround video, and process
              it into an interactive image sequence.
            </p>
          </div>
          <Link className="button button-secondary" href="/vehicles/new">
            Create first vehicle
          </Link>
        </section>
      ) : (
        <section aria-label="Vehicle projects">
          <ul className="vehicle-grid">
            {vehicles.map((vehicle) => (
              <li className="vehicle-card" key={vehicle.id}>
                <div className="vehicle-card-preview" aria-hidden="true">
                  <span>360°</span>
                </div>
                <div className="vehicle-card-body">
                  <div>
                    <p className={`status-badge status-${vehicle.status.toLowerCase()}`}>
                      {statusLabels[vehicle.status]}
                    </p>
                    <h2>{vehicle.name}</h2>
                    <p className="vehicle-meta">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </p>
                  </div>
                  <Link
                    className="button button-secondary"
                    href={`/vehicles/${vehicle.id}/processing`}
                  >
                    Continue
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AppShell>
  );
}
