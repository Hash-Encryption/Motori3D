import "server-only";

import path from "node:path";

import { frameFilename } from "@/lib/spin/frame-utils";
import { runFfmpeg } from "@/server/processing/ffmpeg-runner";

type RawFrame = {
  filename: string;
  absolutePath: string;
};

export async function optimizeFrames(input: {
  rawFrames: RawFrame[];
  framesDirectory: string;
  thumbsDirectory: string;
  onProgress: (completed: number, total: number) => void;
}) {
  const output = new Array<{
    framePath: string;
    thumbnailPath: string;
  }>(input.rawFrames.length);
  let nextIndex = 0;
  let completed = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= input.rawFrames.length) return;

      const frame = input.rawFrames[index];
      const filename = frameFilename(index + 1);
      const framePath = path.join(input.framesDirectory, filename);
      const thumbnailPath = path.join(input.thumbsDirectory, filename);

      await runFfmpeg([
        "-y",
        "-i",
        frame.absolutePath,
        "-map_metadata",
        "-1",
        "-frames:v",
        "1",
        "-c:v",
        "libwebp",
        "-quality",
        "84",
        "-compression_level",
        "4",
        framePath,
        "-map_metadata",
        "-1",
        "-frames:v",
        "1",
        "-vf",
        "scale=w='if(gt(iw,ih),min(320,iw),-2)':h='if(gt(iw,ih),-2,min(320,ih))':flags=lanczos",
        "-c:v",
        "libwebp",
        "-quality",
        "74",
        "-compression_level",
        "4",
        thumbnailPath,
      ]);

      output[index] = { framePath, thumbnailPath };
      completed += 1;
      input.onProgress(completed, input.rawFrames.length);
    }
  }

  const concurrency = Math.min(4, input.rawFrames.length);
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return output;
}
