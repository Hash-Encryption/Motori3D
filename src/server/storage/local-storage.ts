import "server-only";

import { createWriteStream, mkdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const INTERNAL_ID_PATTERN = /^[0-9a-f-]{36}$/i;

export class UploadTooLargeError extends Error {
  constructor(maximumBytes: number) {
    super(`Upload exceeds the ${Math.floor(maximumBytes / 1024 / 1024)} MB limit.`);
    this.name = "UploadTooLargeError";
  }
}

function assertInternalId(id: string, label: string) {
  if (!INTERNAL_ID_PATTERN.test(id)) {
    throw new Error(`Invalid internal ${label}.`);
  }
}

export function getStorageRoot() {
  if (process.env.NODE_ENV === "test" && process.env.STORAGE_ROOT) {
    return path.join(process.cwd(), process.env.STORAGE_ROOT);
  }
  return path.join(process.cwd(), "storage");
}

export function resolveInsideStorage(...segments: string[]) {
  const root = getStorageRoot();
  const resolved = path.join(root, ...segments);
  const relative = path.relative(root, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Resolved storage path is outside the storage root.");
  }

  return { absolutePath: resolved, relativePath: relative.replaceAll("\\", "/") };
}

export function resolveStoredPath(relativePath: string) {
  return resolveInsideStorage(relativePath);
}

export function getCaptureDirectory(vehicleId: string, captureId: string) {
  assertInternalId(vehicleId, "vehicle ID");
  assertInternalId(captureId, "capture ID");

  return resolveInsideStorage("vehicles", vehicleId, "captures", captureId);
}

export function getCaptureSourcePath(
  vehicleId: string,
  captureId: string,
  extension: ".mp4" | ".mov",
) {
  const captureDirectory = getCaptureDirectory(vehicleId, captureId);
  return resolveInsideStorage(
    captureDirectory.relativePath,
    "source",
    `original${extension}`,
  );
}

export async function writeUploadStream(
  body: ReadableStream<Uint8Array>,
  destinationPath: string,
  maximumBytes: number,
) {
  const destinationDirectory = path.dirname(destinationPath);
  const temporaryPath = `${destinationPath}.uploading`;
  mkdirSync(destinationDirectory, { recursive: true });

  let bytesWritten = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytesWritten += chunk.length;
      if (bytesWritten > maximumBytes) {
        callback(new UploadTooLargeError(maximumBytes));
        return;
      }
      callback(null, chunk);
    },
  });

  try {
    await pipeline(
      Readable.fromWeb(body as never),
      limiter,
      createWriteStream(temporaryPath, { flags: "wx" }),
    );
    renameSync(temporaryPath, destinationPath);
    return bytesWritten;
  } catch (error) {
    rmSync(temporaryPath, { force: true });
    throw error;
  }
}

export function removeCaptureFiles(vehicleId: string, captureId: string) {
  const captureDirectory = getCaptureDirectory(vehicleId, captureId);
  rmSync(captureDirectory.absolutePath, { recursive: true, force: true });
}

export function prepareCaptureOutputDirectories(vehicleId: string, captureId: string) {
  const captureDirectory = getCaptureDirectory(vehicleId, captureId);
  const raw = resolveInsideStorage(captureDirectory.relativePath, "raw");
  const frames = resolveInsideStorage(captureDirectory.relativePath, "frames");
  const thumbs = resolveInsideStorage(captureDirectory.relativePath, "thumbs");

  for (const directory of [raw, frames, thumbs]) {
    rmSync(directory.absolutePath, { recursive: true, force: true });
    mkdirSync(directory.absolutePath, { recursive: true });
  }

  return { raw, frames, thumbs };
}

export function removeRawFrames(vehicleId: string, captureId: string) {
  const captureDirectory = getCaptureDirectory(vehicleId, captureId);
  const raw = resolveInsideStorage(captureDirectory.relativePath, "raw");
  rmSync(raw.absolutePath, { recursive: true, force: true });
}
