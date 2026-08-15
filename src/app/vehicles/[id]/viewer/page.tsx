import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SpinViewer } from "@/components/spin-viewer";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/server/auth/auth-context";
import {
  getLatestCaptureForVehicle,
  listCaptureFrames,
} from "@/server/captures/capture-repository";
import { getInventoryVehicle } from "@/server/vehicles/inventory-repository";
import { getVehicle } from "@/server/vehicles/vehicle-repository";

export const metadata = {
  title: "360 viewer",
};

export const dynamic = "force-dynamic";

export default async function ViewerPage(props: PageProps<"/vehicles/[id]/viewer">) {
  const { id } = await props.params;

  let vehicle: {
    id: string;
    name: string;
    make?: string | null;
    model?: string | null;
    year?: number | null;
    businessId?: string | null;
  } | null = null;

  const authContext = await getAuthContext().catch(() => null);

  // 1. Check Supabase inventory first if authenticated
  if (authContext) {
    try {
      const supabase = await createClient();
      const inventoryVehicle = await getInventoryVehicle(
        supabase,
        id,
        authContext.business.id,
      );
      if (inventoryVehicle) {
        vehicle = {
          id: inventoryVehicle.id,
          name: `${inventoryVehicle.year} ${inventoryVehicle.make} ${inventoryVehicle.model}`,
          make: inventoryVehicle.make,
          model: inventoryVehicle.model,
          year: inventoryVehicle.year,
          businessId: inventoryVehicle.businessId,
        };
      }
    } catch {
      // Continue to local lookup
    }
  }

  // 2. Fallback to local SQLite database if not found in Supabase
  if (!vehicle) {
    try {
      const localVehicle = getVehicle(id);
      if (localVehicle) {
        vehicle = localVehicle;
      }
    } catch {
      // Ignored if SQLite is unavailable on edge
    }
  }

  if (!vehicle) {
    notFound();
  }

  // Tenant security boundary
  if (vehicle.businessId) {
    if (
      !authContext ||
      !authContext.allMemberships.some((m) => m.businessId === vehicle.businessId)
    ) {
      redirect("/auth/sign-in");
    }
  }

  let capture = null;
  let frames: Array<{ frameIndex: number; width: number; height: number }> = [];
  try {
    capture = getLatestCaptureForVehicle(id);
    frames = capture?.status === "READY" ? listCaptureFrames(capture.id) : [];
  } catch {
    // Ignored in cloud environments without local captures
  }

  const ready = capture?.status === "READY" && frames.length > 0;

  return (
    <AppShell>
      <section className="page-heading viewer-heading">
        <div>
          <p className="eyebrow">Interactive asset</p>
          <h1>{vehicle.name}</h1>
          <p className="page-description">
            Swipe or drag horizontally to rotate the real captured sequence.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link className="button button-secondary" href={`/vehicles/${vehicle.id}`}>
            Vehicle Details
          </Link>
          <Link className="button button-secondary" href="/">
            Inventory
          </Link>
        </div>
      </section>

      {ready && capture ? (
        <SpinViewer
          captureId={capture.id}
          vehicleName={vehicle.name}
          frameUrls={frames.map(
            (frame) => `/api/captures/${capture.id}/frames/${frame.frameIndex}`,
          )}
          width={frames[0].width}
          height={frames[0].height}
        />
      ) : (
        <section className="panel">
          <div className="viewer-placeholder">
            <div>
              <h2>No ready frame sequence</h2>
              <p>Upload and process a walkaround video before opening the viewer.</p>
            </div>
          </div>
          <div className="form-actions">
            <Link className="button button-primary" href={`/vehicles/${vehicle.id}/processing`}>
              Open processing
            </Link>
          </div>
        </section>
      )}
    </AppShell>
  );
}
