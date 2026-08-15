import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import {
  frameFilename,
  wrapFrameIndex,
} from "../../lib/spin/frame-utils";
import {
  completeCaptureUpload,
  createCapture,
  getCapture,
  getCaptureFrame,
  listCaptureFrames,
  markCaptureFailed,
} from "../captures/capture-repository";
import { processCapture } from "./capture-pipeline";
import { analyzeImage, analyzeVideo } from "./video-analysis";
import {
  getCaptureSourcePath,
  resolveStoredPath,
} from "../storage/local-storage";
import { createVehicle, getVehicle } from "../vehicles/vehicle-repository";

const SOURCE_VIDEO_PATH = path.resolve(
  process.cwd(),
  "storage/vehicles/ee9f81f8-5c48-402c-a457-1f57f3c31464/captures/6b83f992-786f-4c7e-9a31-4c84b79f9a3b/source/original.mov",
);

describe("Phase 01 Real Pipeline Acceptance", () => {
  it("locates the real test video IMG_0522.mov", () => {
    expect(existsSync(SOURCE_VIDEO_PATH)).toBe(true);
    const stats = statSync(SOURCE_VIDEO_PATH);
    expect(stats.size).toBeGreaterThan(10 * 1024 * 1024); // ~123 MB
  });

  it("analyzes real video metadata correctly", async () => {
    const metadata = await analyzeVideo(SOURCE_VIDEO_PATH);
    expect(metadata.durationSeconds).toBeCloseTo(38.77, 1);
    expect(metadata.width).toBe(3840);
    expect(metadata.height).toBe(2160);
    expect(metadata.codec).toBe("hevc");
    expect(metadata.fps).toBeCloseTo(30, 0);
    expect(metadata.totalFrameEstimate).toBeGreaterThan(1000);
  });

  it("executes complete 36-frame pipeline with IMG_0522.mov", async () => {
    const targetCount = 36;
    const vehicle = createVehicle({
      name: "Phase 01 Acceptance 36",
      make: "Acceptance",
      model: "Car36",
      year: 2026,
      stockIdentifier: "ACC-36",
    });

    const captureId = randomUUID();
    const source = getCaptureSourcePath(vehicle.id, captureId, ".mov");
    mkdirSync(path.dirname(source.absolutePath), { recursive: true });
    copyFileSync(SOURCE_VIDEO_PATH, source.absolutePath);

    createCapture({
      id: captureId,
      vehicleId: vehicle.id,
      sourceVideoPath: source.relativePath,
      sourceFilename: "IMG_0522.mov",
      sourceMimeType: "video/quicktime",
      targetFrameCount: targetCount,
    });

    const metadata = await analyzeVideo(source.absolutePath);
    completeCaptureUpload(captureId, statSync(source.absolutePath).size, metadata);

    // Execute full pipeline
    await processCapture(captureId);

    const capture = getCapture(captureId);
    expect(capture?.status).toBe("READY");
    expect(capture?.frameCount).toBe(targetCount);
    expect(capture?.processingProgress).toBe(100);
    expect(capture?.width).toBe(1600);
    expect(capture?.height).toBe(900);

    const frames = listCaptureFrames(captureId);
    expect(frames).toHaveLength(targetCount);
    expect(frames[0].frameIndex).toBe(0);
    expect(frames[targetCount - 1].frameIndex).toBe(targetCount - 1);

    // Check first frame on disk
    const firstFrame = getCaptureFrame(captureId, 0);
    expect(firstFrame).toBeDefined();
    const firstFrameFile = resolveStoredPath(firstFrame!.path);
    expect(existsSync(firstFrameFile.absolutePath)).toBe(true);

    const frameAnalysis = await analyzeImage(firstFrameFile.absolutePath);
    expect(frameAnalysis.width).toBe(1600);
    expect(frameAnalysis.height).toBe(900);

    // Check first thumbnail on disk
    const firstThumbFile = resolveStoredPath(firstFrame!.thumbnailPath);
    expect(existsSync(firstThumbFile.absolutePath)).toBe(true);
    const thumbAnalysis = await analyzeImage(firstThumbFile.absolutePath);
    expect(thumbAnalysis.width).toBe(320);
    expect(thumbAnalysis.height).toBe(180);
  }, 120000);

  it("executes complete 48-frame pipeline with IMG_0522.mov", async () => {
    const targetCount = 48;
    const vehicle = createVehicle({
      name: "Phase 01 Acceptance 48",
      make: "Acceptance",
      model: "Car48",
      year: 2026,
      stockIdentifier: "ACC-48",
    });

    const captureId = randomUUID();
    const source = getCaptureSourcePath(vehicle.id, captureId, ".mov");
    mkdirSync(path.dirname(source.absolutePath), { recursive: true });
    copyFileSync(SOURCE_VIDEO_PATH, source.absolutePath);

    createCapture({
      id: captureId,
      vehicleId: vehicle.id,
      sourceVideoPath: source.relativePath,
      sourceFilename: "IMG_0522.mov",
      sourceMimeType: "video/quicktime",
      targetFrameCount: targetCount,
    });

    const metadata = await analyzeVideo(source.absolutePath);
    completeCaptureUpload(captureId, statSync(source.absolutePath).size, metadata);

    // Execute full pipeline
    await processCapture(captureId);

    const capture = getCapture(captureId);
    expect(capture?.status).toBe("READY");
    expect(capture?.frameCount).toBe(48);
    expect(capture?.processingProgress).toBe(100);

    const frames = listCaptureFrames(captureId);
    expect(frames).toHaveLength(48);
  }, 120000);

  it("executes complete 72-frame pipeline with IMG_0522.mov", async () => {
    const targetCount = 72;
    const vehicle = createVehicle({
      name: "Phase 01 Acceptance 72",
      make: "Acceptance",
      model: "Car72",
      year: 2026,
      stockIdentifier: "ACC-72",
    });

    const captureId = randomUUID();
    const source = getCaptureSourcePath(vehicle.id, captureId, ".mov");
    mkdirSync(path.dirname(source.absolutePath), { recursive: true });
    copyFileSync(SOURCE_VIDEO_PATH, source.absolutePath);

    createCapture({
      id: captureId,
      vehicleId: vehicle.id,
      sourceVideoPath: source.relativePath,
      sourceFilename: "IMG_0522.mov",
      sourceMimeType: "video/quicktime",
      targetFrameCount: targetCount,
    });

    const metadata = await analyzeVideo(source.absolutePath);
    completeCaptureUpload(captureId, statSync(source.absolutePath).size, metadata);

    // Execute full pipeline
    await processCapture(captureId);

    const capture = getCapture(captureId);
    expect(capture?.status).toBe("READY");
    expect(capture?.frameCount).toBe(72);
    expect(capture?.processingProgress).toBe(100);

    const frames = listCaptureFrames(captureId);
    expect(frames).toHaveLength(72);

    // Verify all 72 filenames follow deterministic naming
    for (let i = 0; i < 72; i++) {
      expect(frames[i].path).toContain(frameFilename(i + 1, "webp"));
    }
  }, 150000);

  it("handles forward, reverse, and boundary wrapping correctly", () => {
    // 72 frames: index 0 to 71
    // Forward past last: 71 -> 0 -> 1
    expect(wrapFrameIndex(71 + 1, 72)).toBe(0);
    expect(wrapFrameIndex(71 + 2, 72)).toBe(1);

    // Reverse past first: 0 -> 71 -> 70
    expect(wrapFrameIndex(0 - 1, 72)).toBe(71);
    expect(wrapFrameIndex(0 - 2, 72)).toBe(70);

    // 48 frames:
    expect(wrapFrameIndex(47 + 1, 48)).toBe(0);
    expect(wrapFrameIndex(-1, 48)).toBe(47);

    // 36 frames:
    expect(wrapFrameIndex(35 + 1, 36)).toBe(0);
    expect(wrapFrameIndex(-1, 36)).toBe(35);
  });

  it("handles corrupted/invalid video input gracefully with error logging", async () => {
    const vehicle = createVehicle({
      name: "Failure Vehicle",
      make: "Corrupt",
      model: "Invalid",
      year: 2026,
      stockIdentifier: "FAIL-01",
    });

    const captureId = randomUUID();
    const source = getCaptureSourcePath(vehicle.id, captureId, ".mp4");
    mkdirSync(path.dirname(source.absolutePath), { recursive: true });
    writeFileSync(source.absolutePath, "INVALID CORRUPTED VIDEO DATA");

    createCapture({
      id: captureId,
      vehicleId: vehicle.id,
      sourceVideoPath: source.relativePath,
      sourceFilename: "corrupt.mp4",
      sourceMimeType: "video/mp4",
      targetFrameCount: 36,
    });

    await expect(analyzeVideo(source.absolutePath)).rejects.toThrow();

    markCaptureFailed(captureId, "ffprobe could not read this video: invalid header");
    const failedCapture = getCapture(captureId);
    const failedVehicle = getVehicle(vehicle.id);

    expect(failedCapture?.status).toBe("FAILED");
    expect(failedCapture?.error).toContain("ffprobe could not read this video");
    expect(failedVehicle?.status).toBe("FAILED");
  });

  it("persists and reloads across fresh SQLite connections", () => {
    const dataDir = path.resolve(process.cwd(), "data");
    const freshDb = new DatabaseSync(path.join(dataDir, "vehicle-360.sqlite"));
    
    const countRow = freshDb.prepare("SELECT count(*) as total FROM captures WHERE status = 'READY'").get() as { total: number };
    expect(countRow.total).toBeGreaterThanOrEqual(3);

    const frameCountRow = freshDb.prepare("SELECT count(*) as total FROM frames").get() as { total: number };
    expect(frameCountRow.total).toBeGreaterThanOrEqual(168);
  });
});
