import "server-only";

import { processCapture } from "@/server/processing/capture-pipeline";

const globalForJobs = globalThis as typeof globalThis & {
  vehicle360ProcessingJobs?: Map<string, Promise<void>>;
};

const jobs =
  globalForJobs.vehicle360ProcessingJobs ??
  (globalForJobs.vehicle360ProcessingJobs = new Map<string, Promise<void>>());

export function queueCaptureProcessing(captureId: string) {
  const existing = jobs.get(captureId);
  if (existing) return existing;

  const job = processCapture(captureId).finally(() => jobs.delete(captureId));
  jobs.set(captureId, job);
  return job;
}
