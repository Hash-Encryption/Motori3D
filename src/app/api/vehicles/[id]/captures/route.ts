import { randomUUID } from "node:crypto";
import path from "node:path";

import {
  completeCaptureUpload,
  createCapture,
  markCaptureFailed,
} from "@/server/captures/capture-repository";
import { analyzeVideo } from "@/server/processing/video-analysis";
import {
  getCaptureSourcePath,
  removeCaptureFiles,
  UploadTooLargeError,
  writeUploadStream,
} from "@/server/storage/local-storage";
import { getVehicle } from "@/server/vehicles/vehicle-repository";

export const runtime = "nodejs";

const allowedFrameCounts = new Set([36, 48, 72]);
const allowedMimeTypes = new Set(["video/mp4", "video/quicktime"]);

function getMaximumUploadBytes() {
  const configured = Number(process.env.MAX_UPLOAD_MB ?? "750");
  const megabytes = Number.isFinite(configured) && configured > 0 ? configured : 750;
  return Math.floor(megabytes * 1024 * 1024);
}

function getSafeFilename(request: Request) {
  const encoded = request.headers.get("x-file-name") ?? "walkaround.mp4";
  let decoded = encoded;
  try {
    decoded = decodeURIComponent(encoded);
  } catch {
    decoded = "walkaround.mp4";
  }
  return path.basename(decoded).replace(/[\u0000-\u001f<>:"/\\|?*]/g, "_").slice(0, 120);
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/vehicles/[id]/captures">,
) {
  const { id: vehicleId } = await context.params;
  const vehicle = getVehicle(vehicleId);
  if (!vehicle) {
    return Response.json({ error: "Vehicle project not found." }, { status: 404 });
  }

  if (!request.body) {
    return Response.json({ error: "Select a video to upload." }, { status: 400 });
  }

  const filename = getSafeFilename(request);
  const extension = path.extname(filename).toLowerCase();
  const mimeType = (request.headers.get("content-type") ?? "").split(";")[0];
  if (!allowedMimeTypes.has(mimeType) || ![".mp4", ".mov"].includes(extension)) {
    return Response.json(
      { error: "Upload an MP4 or MOV phone video." },
      { status: 415 },
    );
  }

  const targetFrameCount = Number(request.headers.get("x-target-frame-count") ?? "48");
  if (!allowedFrameCounts.has(targetFrameCount)) {
    return Response.json(
      { error: "Target frame count must be 36, 48, or 72." },
      { status: 422 },
    );
  }

  const maximumBytes = getMaximumUploadBytes();
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    return Response.json(
      { error: `Video exceeds the ${Math.floor(maximumBytes / 1024 / 1024)} MB limit.` },
      { status: 413 },
    );
  }

  const captureId = randomUUID();
  const source = getCaptureSourcePath(
    vehicleId,
    captureId,
    extension as ".mp4" | ".mov",
  );
  createCapture({
    id: captureId,
    vehicleId,
    sourceVideoPath: source.relativePath,
    sourceFilename: filename,
    sourceMimeType: mimeType,
    targetFrameCount: targetFrameCount as 36 | 48 | 72,
  });

  try {
    const sizeBytes = await writeUploadStream(request.body, source.absolutePath, maximumBytes);
    if (sizeBytes === 0) {
      throw new Error("The uploaded video is empty.");
    }

    const metadata = await analyzeVideo(source.absolutePath);
    const capture = completeCaptureUpload(captureId, sizeBytes, metadata);
    return Response.json({ capture }, { status: 201 });
  } catch (error) {
    const technicalMessage = error instanceof Error ? error.message : "Unknown upload failure";
    console.error("Video upload or analysis failed", { vehicleId, captureId, error });
    markCaptureFailed(captureId, technicalMessage);
    removeCaptureFiles(vehicleId, captureId);

    const publicMessage =
      error instanceof UploadTooLargeError
        ? error.message
        : "The video could not be read. Confirm it is a valid MP4 or MOV file and try again.";
    return Response.json({ error: publicMessage }, { status: 422 });
  }
}
