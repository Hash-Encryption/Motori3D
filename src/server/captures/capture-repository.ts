import "server-only";

import { randomUUID } from "node:crypto";

import { isAllowedCaptureTransition } from "@/server/captures/capture-state";
import { getDatabase } from "@/server/db/database";
import type { VideoMetadata } from "@/server/processing/video-analysis";

export type CaptureStatus =
  | "UPLOADED"
  | "ANALYZING"
  | "EXTRACTING"
  | "PROCESSING_IMAGES"
  | "READY"
  | "FAILED";

export type CaptureRecord = {
  id: string;
  vehicleId: string;
  sourceVideoPath: string | null;
  sourceFilename: string | null;
  sourceMimeType: string | null;
  sourceSizeBytes: number | null;
  targetFrameCount: 36 | 48 | 72;
  frameCount: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  fps: number | null;
  codec: string | null;
  orientation: number | null;
  totalFrameEstimate: number | null;
  status: CaptureStatus;
  processingStage: string | null;
  processingProgress: number;
  error: string | null;
  processingRequestedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CaptureRow = {
  id: string;
  vehicle_id: string;
  source_video_path: string | null;
  source_filename: string | null;
  source_mime_type: string | null;
  source_size_bytes: number | null;
  target_frame_count: 36 | 48 | 72;
  frame_count: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  fps: number | null;
  codec: string | null;
  orientation: number | null;
  total_frame_estimate: number | null;
  status: CaptureStatus;
  processing_stage: string | null;
  processing_progress: number;
  error: string | null;
  processing_requested_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapCapture(row: CaptureRow): CaptureRecord {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    sourceVideoPath: row.source_video_path,
    sourceFilename: row.source_filename,
    sourceMimeType: row.source_mime_type,
    sourceSizeBytes: row.source_size_bytes,
    targetFrameCount: row.target_frame_count,
    frameCount: row.frame_count,
    width: row.width,
    height: row.height,
    durationSeconds: row.duration_seconds,
    fps: row.fps,
    codec: row.codec,
    orientation: row.orientation,
    totalFrameEstimate: row.total_frame_estimate,
    status: row.status,
    processingStage: row.processing_stage,
    processingProgress: row.processing_progress,
    error: row.error,
    processingRequestedAt: row.processing_requested_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const captureColumns = `
  id, vehicle_id, source_video_path, source_filename, source_mime_type,
  source_size_bytes, target_frame_count, frame_count, width, height,
  duration_seconds, fps, codec, orientation, total_frame_estimate, status,
  processing_stage, processing_progress, error, processing_requested_at,
  created_at, updated_at
`;

export function getCapture(id: string): CaptureRecord | null {
  const row = getDatabase()
    .prepare(`SELECT ${captureColumns} FROM captures WHERE id = ?`)
    .get(id) as CaptureRow | undefined;
  return row ? mapCapture(row) : null;
}

export function getLatestCaptureForVehicle(vehicleId: string): CaptureRecord | null {
  const row = getDatabase()
    .prepare(
      `SELECT ${captureColumns}
       FROM captures
       WHERE vehicle_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get(vehicleId) as CaptureRow | undefined;
  return row ? mapCapture(row) : null;
}

export function createCapture(input: {
  id: string;
  vehicleId: string;
  sourceVideoPath: string;
  sourceFilename: string;
  sourceMimeType: string;
  targetFrameCount: 36 | 48 | 72;
}) {
  const timestamp = new Date().toISOString();
  getDatabase()
    .prepare(
      `INSERT INTO captures (
        id, vehicle_id, source_video_path, source_filename, source_mime_type,
        target_frame_count, status, processing_stage, processing_progress,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'UPLOADED', 'RECEIVING_UPLOAD', 0, ?, ?)`,
    )
    .run(
      input.id,
      input.vehicleId,
      input.sourceVideoPath,
      input.sourceFilename,
      input.sourceMimeType,
      input.targetFrameCount,
      timestamp,
      timestamp,
    );
  return getCapture(input.id);
}

export function completeCaptureUpload(
  id: string,
  sizeBytes: number,
  metadata: VideoMetadata,
) {
  const timestamp = new Date().toISOString();
  getDatabase()
    .prepare(
      `UPDATE captures SET
        source_size_bytes = ?, width = ?, height = ?, duration_seconds = ?,
        fps = ?, codec = ?, orientation = ?, total_frame_estimate = ?,
        status = 'UPLOADED', processing_stage = 'VIDEO_ANALYZED',
        processing_progress = 15, error = NULL, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      sizeBytes,
      metadata.width,
      metadata.height,
      metadata.durationSeconds,
      metadata.fps,
      metadata.codec,
      metadata.orientation,
      metadata.totalFrameEstimate,
      timestamp,
      id,
    );
  return getCapture(id);
}

export function markCaptureFailed(id: string, error: string) {
  const timestamp = new Date().toISOString();
  getDatabase()
    .prepare(
      `UPDATE captures SET
        status = 'FAILED', processing_stage = 'FAILED', error = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(error.slice(0, 2000), timestamp, id);

  const capture = getCapture(id);
  if (capture) {
    getDatabase()
      .prepare("UPDATE vehicles SET status = 'FAILED', updated_at = ? WHERE id = ?")
      .run(timestamp, capture.vehicleId);
  }
}

export function updateCaptureState(input: {
  id: string;
  status: CaptureStatus;
  stage: string;
  progress: number;
}) {
  const current = getCapture(input.id);
  if (!current) {
    throw new Error("Capture not found while updating processing state.");
  }
  if (
    current.status !== input.status &&
    !isAllowedCaptureTransition(current.status, input.status)
  ) {
    throw new Error(`Invalid capture transition: ${current.status} -> ${input.status}.`);
  }

  const timestamp = new Date().toISOString();
  getDatabase()
    .prepare(
      `UPDATE captures SET
        status = ?, processing_stage = ?, processing_progress = ?,
        error = NULL, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      input.status,
      input.stage,
      Math.max(0, Math.min(100, Math.round(input.progress))),
      timestamp,
      input.id,
    );

  const capture = getCapture(input.id);
  if (capture) {
    const vehicleStatus =
      input.status === "READY"
        ? "READY"
        : input.status === "FAILED"
          ? "FAILED"
          : "PROCESSING";
    getDatabase()
      .prepare("UPDATE vehicles SET status = ?, updated_at = ? WHERE id = ?")
      .run(vehicleStatus, timestamp, capture.vehicleId);
  }
}

export function updateCaptureAnalysis(id: string, metadata: VideoMetadata) {
  const timestamp = new Date().toISOString();
  getDatabase()
    .prepare(
      `UPDATE captures SET
        width = ?, height = ?, duration_seconds = ?, fps = ?, codec = ?,
        orientation = ?, total_frame_estimate = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      metadata.width,
      metadata.height,
      metadata.durationSeconds,
      metadata.fps,
      metadata.codec,
      metadata.orientation,
      metadata.totalFrameEstimate,
      timestamp,
      id,
    );
}

export function replaceCaptureFrames(input: {
  captureId: string;
  frameCount: number;
  width: number;
  height: number;
  paths: Array<{ path: string; thumbnailPath: string }>;
}) {
  const database = getDatabase();
  const timestamp = new Date().toISOString();
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("DELETE FROM frames WHERE capture_id = ?").run(input.captureId);
    const insert = database.prepare(
      `INSERT INTO frames (
        id, capture_id, frame_index, path, thumbnail_path, width, height, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const [index, frame] of input.paths.entries()) {
      insert.run(
        randomUUID(),
        input.captureId,
        index,
        frame.path,
        frame.thumbnailPath,
        input.width,
        input.height,
        timestamp,
      );
    }

    database
      .prepare(
        `UPDATE captures SET frame_count = ?, width = ?, height = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(input.frameCount, input.width, input.height, timestamp, input.captureId);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function listCaptureFrames(captureId: string) {
  return getDatabase()
    .prepare(
      `SELECT frame_index AS frameIndex, path, thumbnail_path AS thumbnailPath,
              width, height
       FROM frames
       WHERE capture_id = ?
       ORDER BY frame_index ASC`,
    )
    .all(captureId) as Array<{
    frameIndex: number;
    path: string;
    thumbnailPath: string;
    width: number;
    height: number;
  }>;
}

export function getCaptureFrame(captureId: string, frameIndex: number) {
  return getDatabase()
    .prepare(
      `SELECT frame_index AS frameIndex, path, thumbnail_path AS thumbnailPath,
              width, height
       FROM frames
       WHERE capture_id = ? AND frame_index = ?`,
    )
    .get(captureId, frameIndex) as
    | {
        frameIndex: number;
        path: string;
        thumbnailPath: string;
        width: number;
        height: number;
      }
    | undefined;
}
