import type { CaptureStatus } from "@/server/captures/capture-repository";

const allowedTransitions: Record<CaptureStatus, readonly CaptureStatus[]> = {
  UPLOADED: ["ANALYZING", "FAILED"],
  ANALYZING: ["EXTRACTING", "FAILED"],
  EXTRACTING: ["PROCESSING_IMAGES", "FAILED"],
  PROCESSING_IMAGES: ["READY", "FAILED"],
  READY: ["ANALYZING"],
  FAILED: ["ANALYZING"],
};

export function isAllowedCaptureTransition(
  from: CaptureStatus,
  to: CaptureStatus,
) {
  return allowedTransitions[from].includes(to);
}
