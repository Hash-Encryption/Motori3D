import "server-only";

import path from "node:path";

import { isSupportedFrameCount } from "@/lib/spin/frame-utils";
import {
  getCapture,
  markCaptureFailed,
  replaceCaptureFrames,
  updateCaptureAnalysis,
  updateCaptureState,
} from "@/server/captures/capture-repository";
import { extractOrderedFrames } from "@/server/processing/frame-extraction";
import { optimizeFrames } from "@/server/processing/image-optimization";
import { analyzeImage, analyzeVideo } from "@/server/processing/video-analysis";
import {
  prepareCaptureOutputDirectories,
  removeRawFrames,
  resolveStoredPath,
} from "@/server/storage/local-storage";

export async function processCapture(captureId: string) {
  const capture = getCapture(captureId);
  if (!capture?.sourceVideoPath) {
    throw new Error("Capture source video is missing.");
  }
  if (!isSupportedFrameCount(capture.targetFrameCount)) {
    throw new Error("Capture target frame count is not supported.");
  }

  try {
    updateCaptureState({
      id: capture.id,
      status: "ANALYZING",
      stage: "ANALYZING_VIDEO",
      progress: 20,
    });
    const source = resolveStoredPath(capture.sourceVideoPath);
    const metadata = await analyzeVideo(source.absolutePath);
    updateCaptureAnalysis(capture.id, metadata);

    updateCaptureState({
      id: capture.id,
      status: "EXTRACTING",
      stage: "EXTRACTING_FRAMES",
      progress: 30,
    });
    const directories = prepareCaptureOutputDirectories(capture.vehicleId, capture.id);
    const rawFrames = await extractOrderedFrames({
      sourcePath: source.absolutePath,
      outputDirectory: directories.raw.absolutePath,
      durationSeconds: metadata.durationSeconds,
      frameCount: capture.targetFrameCount,
    });

    updateCaptureState({
      id: capture.id,
      status: "PROCESSING_IMAGES",
      stage: "OPTIMIZING_IMAGES",
      progress: 50,
    });
    const optimized = await optimizeFrames({
      rawFrames,
      framesDirectory: directories.frames.absolutePath,
      thumbsDirectory: directories.thumbs.absolutePath,
      onProgress(completed, total) {
        const progress = 50 + Math.round((completed / total) * 40);
        updateCaptureState({
          id: capture.id,
          status: "PROCESSING_IMAGES",
          stage: `OPTIMIZING_IMAGE_${completed}_OF_${total}`,
          progress,
        });
      },
    });

    updateCaptureState({
      id: capture.id,
      status: "PROCESSING_IMAGES",
      stage: "BUILDING_VIEWER_MANIFEST",
      progress: 95,
    });
    const dimensions = await analyzeImage(optimized[0].framePath);
    const paths = optimized.map((frame) => ({
      path: path.relative(resolveStoredPath("").absolutePath, frame.framePath).replaceAll("\\", "/"),
      thumbnailPath: path
        .relative(resolveStoredPath("").absolutePath, frame.thumbnailPath)
        .replaceAll("\\", "/"),
    }));
    replaceCaptureFrames({
      captureId: capture.id,
      frameCount: paths.length,
      width: dimensions.width,
      height: dimensions.height,
      paths,
    });
    removeRawFrames(capture.vehicleId, capture.id);
    updateCaptureState({
      id: capture.id,
      status: "READY",
      stage: "READY",
      progress: 100,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown processing failure";
    console.error("Capture processing failed", { captureId, error });
    markCaptureFailed(captureId, message);
  }
}
