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
import { getAuthContext } from "@/server/auth/auth-context";
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
  let vehicle: { id: string; name: string; businessId?: string | null } | null = null;

  const authContext = await getAuthContext().catch(() => null);
  if (authContext) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const { getInventoryVehicle } = await import("@/server/vehicles/inventory-repository");
      const supabase = await createClient();
      const inv = await getInventoryVehicle(supabase, vehicleId, authContext.business.id);
      if (inv) {
        vehicle = {
          id: inv.id,
          name: `${inv.year} ${inv.make} ${inv.model}`,
          businessId: inv.businessId,
        };
      }
    } catch {
      // Continue to local lookup
    }
  }

  if (!vehicle) {
    try {
      vehicle = getVehicle(vehicleId);
    } catch {
      // Ignored if SQLite is unavailable
    }
  }

  if (!vehicle) {
    return Response.json({ error: "Vehicle project not found." }, { status: 404 });
  }

  // Tenant boundary: If vehicle belongs to a dealership, caller must be authorized for that dealership
  if (vehicle.businessId) {
    if (
      !authContext ||
      !authContext.allMemberships.some((m) => m.businessId === vehicle.businessId)
    ) {
      return Response.json(
        { error: "Access denied. You do not have permission to upload captures for this dealership." },
        { status: 403 },
      );
    }
  } else {
    // Unassigned legacy vehicles cannot accept new uploads in production unless caller is Super Admin
    if (!authContext?.isSuperAdmin && process.env.NODE_ENV === "production") {
      return Response.json(
        { error: "New captures require an active dealership vehicle. Unassigned uploads are prohibited." },
        { status: 400 },
      );
    }
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

  try {
    createCapture({
      id: captureId,
      vehicleId,
      sourceVideoPath: source.relativePath,
      sourceFilename: filename,
      sourceMimeType: mimeType,
      targetFrameCount: targetFrameCount as 36 | 48 | 72,
    });

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

    try {
      markCaptureFailed(captureId, technicalMessage);
      removeCaptureFiles(vehicleId, captureId);
    } catch {
      // Ignored if platform doesn't have filesystem
    }

    const isPlatformError =
      technicalMessage.includes("[unenv]") ||
      technicalMessage.includes("mkdirSync") ||
      technicalMessage.includes("DatabaseSync") ||
      technicalMessage.includes("spawn") ||
      technicalMessage.includes("not implemented");

    const publicMessage = isPlatformError
      ? "Edge runtime notice: Local FFmpeg frame extraction requires a Node.js runtime environment (e.g. running 'npm run dev' locally). In serverless cloud workers, connect a cloud media processing worker."
      : error instanceof UploadTooLargeError
      ? error.message
      : "The video could not be read. Confirm it is a valid MP4 or MOV file and try again.";

    return Response.json({ error: publicMessage }, { status: 422 });
  }
}
