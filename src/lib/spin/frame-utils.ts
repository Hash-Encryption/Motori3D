export const SUPPORTED_FRAME_COUNTS = [36, 48, 72] as const;
export type SupportedFrameCount = (typeof SUPPORTED_FRAME_COUNTS)[number];

export function isSupportedFrameCount(value: number): value is SupportedFrameCount {
  return SUPPORTED_FRAME_COUNTS.includes(value as SupportedFrameCount);
}

export function calculateFrameTimestamps(
  durationSeconds: number,
  frameCount: SupportedFrameCount,
  usableRatio = 0.96,
) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error("Video duration must be greater than zero.");
  }
  if (!Number.isFinite(usableRatio) || usableRatio <= 0 || usableRatio > 1) {
    throw new Error("Usable ratio must be greater than zero and at most one.");
  }

  const usableDuration = durationSeconds * usableRatio;
  return Array.from(
    { length: frameCount },
    (_, index) => (usableDuration * index) / frameCount,
  );
}

export function wrapFrameIndex(index: number, frameCount: number) {
  if (!Number.isInteger(frameCount) || frameCount <= 0) {
    throw new Error("Frame count must be a positive integer.");
  }
  return ((Math.trunc(index) % frameCount) + frameCount) % frameCount;
}

export function frameFilename(index: number, extension: "png" | "webp" = "webp") {
  if (!Number.isInteger(index) || index < 1 || index > 999) {
    throw new Error("Frame filename index must be between 1 and 999.");
  }
  return `frame-${String(index).padStart(3, "0")}.${extension}`;
}

export function buildPreloadOrder(frameCount: number) {
  if (!Number.isInteger(frameCount) || frameCount <= 0) {
    throw new Error("Frame count must be a positive integer.");
  }

  const order = [0];
  for (let distance = 1; order.length < frameCount; distance += 1) {
    const forward = wrapFrameIndex(distance, frameCount);
    const backward = wrapFrameIndex(-distance, frameCount);
    if (!order.includes(forward)) order.push(forward);
    if (!order.includes(backward)) order.push(backward);
  }
  return order;
}
