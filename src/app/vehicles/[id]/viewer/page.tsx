import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SpinViewer } from "@/components/spin-viewer";
import {
  getLatestCaptureForVehicle,
  listCaptureFrames,
} from "@/server/captures/capture-repository";
import { getVehicle } from "@/server/vehicles/vehicle-repository";

export const metadata = {
  title: "360 viewer",
};

export const dynamic = "force-dynamic";

export default async function ViewerPage(props: PageProps<"/vehicles/[id]/viewer">) {
  const { id } = await props.params;
  const vehicle = getVehicle(id);
  if (!vehicle) notFound();

  const capture = getLatestCaptureForVehicle(id);
  const frames = capture?.status === "READY" ? listCaptureFrames(capture.id) : [];
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
        <Link className="button button-secondary" href="/">Projects</Link>
      </section>

      {ready && capture ? (
        <SpinViewer
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
