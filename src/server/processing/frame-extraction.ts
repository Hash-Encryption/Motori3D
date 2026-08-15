import "server-only";

import { readdirSync } from "node:fs";
import path from "node:path";

import {
  calculateFrameTimestamps,
  frameFilename,
  type SupportedFrameCount,
} from "@/lib/spin/frame-utils";
import { runFfmpeg } from "@/server/processing/ffmpeg-runner";

export async function extractOrderedFrames(input: {
  sourcePath: string;
  outputDirectory: string;
  durationSeconds: number;
  frameCount: SupportedFrameCount;
}) {
  const timestamps = calculateFrameTimestamps(input.durationSeconds, input.frameCount);
  const usableDuration = input.durationSeconds * 0.96;
  const extractionRate = input.frameCount / usableDuration;
  const outputPattern = path.join(input.outputDirectory, "frame-%03d.png");

  await runFfmpeg([
    "-y",
    "-i",
    input.sourcePath,
    "-t",
    usableDuration.toFixed(6),
    "-vf",
    `fps=${extractionRate.toFixed(10)},scale=w='if(gt(iw,ih),min(1600,iw),-2)':h='if(gt(iw,ih),-2,min(1600,ih))':flags=lanczos,setsar=1`,
    "-frames:v",
    String(input.frameCount),
    "-start_number",
    "1",
    outputPattern,
  ]);

  const files = readdirSync(input.outputDirectory)
    .filter((filename) => /^frame-\d{3}\.png$/.test(filename))
    .sort();

  if (files.length !== input.frameCount) {
    throw new Error(
      `Frame extraction generated ${files.length} files; expected ${input.frameCount}.`,
    );
  }

  const expectedFiles = timestamps.map((_, index) => frameFilename(index + 1, "png"));
  if (files.some((filename, index) => filename !== expectedFiles[index])) {
    throw new Error("Extracted frame filenames are not in deterministic order.");
  }

  return files.map((filename, index) => ({
    filename,
    timestampSeconds: timestamps[index],
    absolutePath: path.join(input.outputDirectory, filename),
  }));
}
