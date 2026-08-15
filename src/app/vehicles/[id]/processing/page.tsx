import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { CaptureProcessingPanel } from "@/components/capture-processing-panel";
import { VideoUploadForm } from "@/components/video-upload-form";
import { getLatestCaptureForVehicle } from "@/server/captures/capture-repository";
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
  const vehicle = getVehicle(id);
  if (!vehicle) notFound();

  const capture = getLatestCaptureForVehicle(id);

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

      {!capture || (capture.status === "FAILED" && !capture.sourceSizeBytes) ? (
        <section className="panel" aria-labelledby="upload-title">
          <h2 id="upload-title">
            {capture?.status === "FAILED" ? "Try another video" : "Upload walkaround video"}
          </h2>
          <p className="helper-text">
            Use one continuous 15–40 second phone video. Keep the full car near
            the center at a roughly constant height and distance.
          </p>
          {capture?.status === "FAILED" ? (
            <div className="capture-error" role="alert">
              <strong>Previous upload failed</strong>
              <span>{capture.error ?? "The file could not be analyzed."}</span>
            </div>
          ) : null}
          <VideoUploadForm vehicleId={vehicle.id} />
        </section>
      ) : (
        <section className="panel" aria-labelledby="analysis-title">
          <div className="capture-summary-heading">
            <div>
              <p className="status-badge status-ready">
                {capture.status === "READY" ? "Spin ready" : "Video analyzed"}
              </p>
              <h2 id="analysis-title">{capture.sourceFilename}</h2>
            </div>
            <span className="capture-size">{formatBytes(capture.sourceSizeBytes)}</span>
          </div>

          <dl className="metadata-grid">
            <div><dt>Duration</dt><dd>{capture.durationSeconds?.toFixed(2)} sec</dd></div>
            <div><dt>Resolution</dt><dd>{capture.width} × {capture.height}</dd></div>
            <div><dt>Frame rate</dt><dd>{capture.fps?.toFixed(2)} fps</dd></div>
            <div><dt>Codec</dt><dd>{capture.codec}</dd></div>
            <div><dt>Orientation</dt><dd>{capture.orientation}°</dd></div>
            <div><dt>Output target</dt><dd>{capture.targetFrameCount} frames</dd></div>
          </dl>

          <CaptureProcessingPanel initialCapture={capture} />
        </section>
      )}
    </AppShell>
  );
}
