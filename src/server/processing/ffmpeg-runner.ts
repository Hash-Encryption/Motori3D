import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { getFfmpegPath } from "@/server/processing/binary-paths";

const execFileAsync = promisify(execFile);

export async function runFfmpeg(args: string[]) {
  try {
    await execFileAsync(getFfmpegPath(), ["-hide_banner", "-loglevel", "error", ...args], {
      windowsHide: true,
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown FFmpeg failure";
    throw new Error(`FFmpeg processing failed: ${message}`);
  }
}
