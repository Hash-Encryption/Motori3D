import { describe, expect, it } from "vitest";

import { isAllowedCaptureTransition } from "./capture-state";

describe("capture status transitions", () => {
  it("allows the successful processing path", () => {
    expect(isAllowedCaptureTransition("UPLOADED", "ANALYZING")).toBe(true);
    expect(isAllowedCaptureTransition("ANALYZING", "EXTRACTING")).toBe(true);
    expect(isAllowedCaptureTransition("EXTRACTING", "PROCESSING_IMAGES")).toBe(true);
    expect(isAllowedCaptureTransition("PROCESSING_IMAGES", "READY")).toBe(true);
  });

  it("allows failure from active stages and retry from failure", () => {
    expect(isAllowedCaptureTransition("ANALYZING", "FAILED")).toBe(true);
    expect(isAllowedCaptureTransition("EXTRACTING", "FAILED")).toBe(true);
    expect(isAllowedCaptureTransition("PROCESSING_IMAGES", "FAILED")).toBe(true);
    expect(isAllowedCaptureTransition("FAILED", "ANALYZING")).toBe(true);
  });

  it("rejects skipped stages", () => {
    expect(isAllowedCaptureTransition("UPLOADED", "READY")).toBe(false);
    expect(isAllowedCaptureTransition("ANALYZING", "PROCESSING_IMAGES")).toBe(false);
  });
});
