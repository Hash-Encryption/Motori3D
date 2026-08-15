import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { getFfprobePath } from "@/server/processing/binary-paths";

const execFileAsync = promisify(execFile);

type ProbeStream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  nb_frames?: string;
  duration?: string;
  tags?: { rotate?: string };
  side_data_list?: Array<{ rotation?: number }>;
};

type ProbeOutput = {
  streams?: ProbeStream[];
  format?: { duration?: string; format_name?: string };
};

export type VideoMetadata = {
  durationSeconds: number;
  fps: number;
  width: number;
  height: number;
  codec: string;
  orientation: number;
  totalFrameEstimate: number;
  format: string;
};

function parseRate(rate: string | undefined) {
  if (!rate) return 0;
  const [numeratorText, denominatorText = "1"] = rate.split("/");
  const numerator = Number(numeratorText);
  const denominator = Number(denominatorText);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}

function normalizeRotation(rotation: number) {
  const normalized = ((Math.round(rotation) % 360) + 360) % 360;
  return [0, 90, 180, 270].includes(normalized) ? normalized : 0;
}

export async function analyzeVideo(filePath: string): Promise<VideoMetadata> {
  const ffprobePath = getFfprobePath();

  let stdout: string;
  try {
    const result = await execFileAsync(
      ffprobePath,
      [
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        filePath,
      ],
      { windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
    );
    stdout = result.stdout;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ffprobe failure";
    throw new Error(`ffprobe could not read this video: ${message}`);
  }

  let output: ProbeOutput;
  try {
    output = JSON.parse(stdout) as ProbeOutput;
  } catch {
    throw new Error("ffprobe returned invalid metadata.");
  }

  const videoStream = output.streams?.find((stream) => stream.codec_type === "video");
  if (!videoStream) {
    throw new Error("The uploaded file does not contain a video stream.");
  }

  const durationSeconds = Number(output.format?.duration ?? videoStream.duration);
  const fps = parseRate(videoStream.avg_frame_rate || videoStream.r_frame_rate);
  const width = Number(videoStream.width);
  const height = Number(videoStream.height);
  const reportedFrames = Number(videoStream.nb_frames);
  const sideDataRotation = videoStream.side_data_list?.find(
    (entry) => typeof entry.rotation === "number",
  )?.rotation;
  const tagRotation = Number(videoStream.tags?.rotate);
  const orientation = normalizeRotation(
    sideDataRotation ?? (Number.isFinite(tagRotation) ? tagRotation : 0),
  );

  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(height) ||
    height <= 0
  ) {
    throw new Error("The video is missing valid duration or resolution metadata.");
  }

  return {
    durationSeconds,
    fps: Number.isFinite(fps) && fps > 0 ? fps : 0,
    width,
    height,
    codec: videoStream.codec_name || "unknown",
    orientation,
    totalFrameEstimate:
      Number.isFinite(reportedFrames) && reportedFrames > 0
        ? Math.round(reportedFrames)
        : Math.max(1, Math.round(durationSeconds * fps)),
    format: output.format?.format_name || "unknown",
  };
}

export async function analyzeImage(filePath: string) {
  const ffprobePath = getFfprobePath();
  const { stdout } = await execFileAsync(
    ffprobePath,
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "json",
      filePath,
    ],
    { windowsHide: true, maxBuffer: 1024 * 1024 },
  );
  const parsed = JSON.parse(stdout) as {
    streams?: Array<{ width?: number; height?: number }>;
  };
  const stream = parsed.streams?.[0];
  const width = Number(stream?.width);
  const height = Number(stream?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Optimized frame is missing valid dimensions.");
  }
  return { width, height };
}
