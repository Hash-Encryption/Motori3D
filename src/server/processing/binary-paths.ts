import "server-only";

import { createRequire } from "node:module";
import path from "node:path";

const requireFromProject = createRequire(path.join(process.cwd(), "package.json"));

export function getFfprobePath() {
  const override = process.env.FFPROBE_PATH?.trim();
  if (override) return override;

  const ffprobePackage = requireFromProject("ffprobe-static") as { path: string };
  return ffprobePackage.path;
}

export function getFfmpegPath() {
  const override = process.env.FFMPEG_PATH?.trim();
  if (override) return override;

  return requireFromProject("ffmpeg-static") as string;
}
