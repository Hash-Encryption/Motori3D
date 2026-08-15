import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { CaptureProcessingPanel } from "@/components/capture-processing-panel";
import { VideoUploadForm } from "@/components/video-upload-form";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/server/auth/auth-context";
import { getLatestCloudCaptureForVehicle } from "@/server/captures/cloud-capture-repository";
import { getLatestCaptureForVehicle } from "@/server/captures/capture-repository";
import { getInventoryVehicle } from "@/server/vehicles/inventory-repository";
import { getVehicle } from "@/server/vehicles/vehicle-repository";

export const metadata = {
  title: "Processing",
};

export const dynamic = "force-dynamic";

function formatBytes(bytes: number | null) {
  if (bytes === null) return "Unknown";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function ProcessingPage(
  props: PageProps<"/vehicles/[id]/processing">,
) {
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
      // Ignored if SQLite is unavailable
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

  // Check for Cloud capture first
  let cloudCapture = null;
  if (authContext) {
    try {
      const supabase = await createClient();
      cloudCapture = await getLatestCloudCaptureForVehicle(supabase, id);
    } catch {
      // Ignored
    }
  }

  // Fallback to local capture
  let localCapture = null;
  try {
    localCapture = getLatestCaptureForVehicle(id);
  } catch {
    // Ignored
  }

  const hasCapture = cloudCapture !== null || localCapture !== null;

  return (
    <AppShell>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Capture pipeline</p>
          <h1>{vehicle.name}</h1>
          <p className="page-description">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </p>
        </div>
      </section>

      {!hasCapture ? (
        <section className="panel" aria-labelledby="upload-title">
          <h2 id="upload-title">Upload & Generate 360 Spin</h2>
          <p className="helper-text">
            Use one continuous 15–40 second phone video. Walk in a complete circle around the car at a steady height.
          </p>
          <VideoUploadForm vehicleId={vehicle.id} businessId={vehicle.businessId} />
        </section>
      ) : cloudCapture ? (
        <section className="panel" aria-labelledby="analysis-title">
          <div className="capture-summary-heading">
            <div>
              <p className="status-badge status-ready">360 Spin Ready</p>
              <h2 id="analysis-title">{cloudCapture.source_filename || "Walkaround 360"}</h2>
            </div>
          </div>

          <dl className="metadata-grid">
            <div><dt>Frames</dt><dd>{cloudCapture.frame_count} WebP frames</dd></div>
            <div><dt>Resolution</dt><dd>{cloudCapture.width} × {cloudCapture.height}</dd></div>
            <div><dt>Duration</dt><dd>{cloudCapture.duration_seconds?.toFixed(1)} sec</dd></div>
            <div><dt>Framerate</dt><dd>{cloudCapture.fps?.toFixed(1)} fps</dd></div>
          </dl>

          <div className="form-actions mt-6 flex gap-3">
            <a className="button button-primary" href={`/vehicles/${vehicle.id}/viewer`}>
              Open 360 Viewer
            </a>
            <VideoUploadForm vehicleId={vehicle.id} businessId={vehicle.businessId} />
          </div>
        </section>
      ) : localCapture ? (
        <section className="panel" aria-labelledby="analysis-title">
          <div className="capture-summary-heading">
            <div>
              <p className="status-badge status-ready">
                {localCapture.status === "READY" ? "Spin ready" : "Video analyzed"}
              </p>
              <h2 id="analysis-title">{localCapture.sourceFilename}</h2>
            </div>
            <span className="capture-size">{formatBytes(localCapture.sourceSizeBytes)}</span>
          </div>

          <dl className="metadata-grid">
            <div><dt>Duration</dt><dd>{localCapture.durationSeconds?.toFixed(2)} sec</dd></div>
            <div><dt>Resolution</dt><dd>{localCapture.width} × {localCapture.height}</dd></div>
            <div><dt>Frame rate</dt><dd>{localCapture.fps?.toFixed(2)} fps</dd></div>
            <div><dt>Codec</dt><dd>{localCapture.codec}</dd></div>
            <div><dt>Orientation</dt><dd>{localCapture.orientation}°</dd></div>
            <div><dt>Output target</dt><dd>{localCapture.targetFrameCount} frames</dd></div>
          </dl>

          <CaptureProcessingPanel initialCapture={localCapture} />
        </section>
      ) : null}
    </AppShell>
  );
}
