import { describe, expect, it } from "vitest";

import {
  buildPreloadOrder,
  calculateFrameTimestamps,
  frameFilename,
  isSupportedFrameCount,
  wrapFrameIndex,
} from "./frame-utils";

describe("calculateFrameTimestamps", () => {
  it("returns the requested deterministic count", () => {
    expect(calculateFrameTimestamps(30, 36)).toHaveLength(36);
    expect(calculateFrameTimestamps(30, 48)).toHaveLength(48);
    expect(calculateFrameTimestamps(30, 72)).toHaveLength(72);
  });

  it("samples evenly through 96 percent without duplicating the endpoint", () => {
    const timestamps = calculateFrameTimestamps(10, 48);
    expect(timestamps[0]).toBe(0);
    expect(timestamps[1] - timestamps[0]).toBeCloseTo(0.2, 8);
    expect(timestamps.at(-1)).toBeCloseTo(9.4, 8);
    expect(timestamps.at(-1)).toBeLessThan(9.6);
  });
});

describe("frame index and filename utilities", () => {
  it("wraps in both directions", () => {
    expect(wrapFrameIndex(72, 72)).toBe(0);
    expect(wrapFrameIndex(-1, 72)).toBe(71);
    expect(wrapFrameIndex(145, 72)).toBe(1);
  });

  it("creates filenames that remain lexically ordered", () => {
    const filenames = Array.from({ length: 72 }, (_, index) => frameFilename(index + 1));
    expect(filenames[0]).toBe("frame-001.webp");
    expect(filenames[71]).toBe("frame-072.webp");
    expect([...filenames].sort()).toEqual(filenames);
  });

  it("accepts only supported target counts", () => {
    expect(isSupportedFrameCount(36)).toBe(true);
    expect(isSupportedFrameCount(48)).toBe(true);
    expect(isSupportedFrameCount(72)).toBe(true);
    expect(isSupportedFrameCount(60)).toBe(false);
  });

  it("preloads the front frame and nearest angles in both directions", () => {
    expect(buildPreloadOrder(8)).toEqual([0, 1, 7, 2, 6, 3, 5, 4]);
  });
});
