import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SpinViewer } from "@/components/spin-viewer";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/server/auth/auth-context";
import {
  getLatestCloudCaptureForVehicle,
  listCloudCaptureFrames,
} from "@/server/captures/cloud-capture-repository";
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

  // 1. Check Cloud 360 Spin Captures first
  let frameUrls: string[] = [];
  let spinWidth = 1920;
  let spinHeight = 1080;
  let captureId = id;

  if (authContext) {
    try {
      const supabase = await createClient();
      const cloudCapture = await getLatestCloudCaptureForVehicle(supabase, id);
      if (cloudCapture && cloudCapture.status === "READY") {
        captureId = cloudCapture.id;
        spinWidth = cloudCapture.width || 1920;
        spinHeight = cloudCapture.height || 1080;
        const frames = await listCloudCaptureFrames(supabase, cloudCapture.id);
        frameUrls = frames.map((f) => f.public_url);
      }
    } catch {
      // Ignored
    }
  }

  // 2. Fallback to local capture frames if no cloud frames
  if (frameUrls.length === 0) {
    try {
      const localCapture = getLatestCaptureForVehicle(id);
      if (localCapture && localCapture.status === "READY") {
        captureId = localCapture.id;
        const localFrames = listCaptureFrames(localCapture.id);
        if (localFrames.length > 0) {
          spinWidth = localFrames[0].width;
          spinHeight = localFrames[0].height;
          frameUrls = localFrames.map(
            (frame) => `/api/captures/${localCapture.id}/frames/${frame.frameIndex}`,
          );
        }
      }
    } catch {
      // Ignored
    }
  }

  const isReady = frameUrls.length > 0;

  return (
    <AppShell>
      <section className="page-heading viewer-heading">
        <div>
          <p className="eyebrow">Interactive 360 Spin Asset</p>
          <h1>{vehicle.name}</h1>
          <p className="page-description">
            Swipe or drag horizontally to rotate the vehicle. Pinch or double-click to zoom.
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

      {isReady ? (
        <SpinViewer
          captureId={captureId}
          vehicleName={vehicle.name}
          frameUrls={frameUrls}
          width={spinWidth}
          height={spinHeight}
        />
      ) : (
        <section className="panel">
          <div className="viewer-placeholder">
            <div>
              <h2>No 360 Spin Available</h2>
              <p>Upload a walkaround video to generate an interactive 360 turntable.</p>
            </div>
          </div>
          <div className="form-actions">
            <Link className="button button-primary" href={`/vehicles/${vehicle.id}/processing`}>
              Open 360 Processing
            </Link>
          </div>
        </section>
      )}
    </AppShell>
  );
}
