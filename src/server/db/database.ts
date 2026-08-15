import "server-only";

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const globalForDatabase = globalThis as typeof globalThis & {
  vehicle360Database?: DatabaseSync;
};

function openDatabase() {
  const dataDirectory = path.resolve(process.cwd(), "data");
  mkdirSync(dataDirectory, { recursive: true });

  const database = new DatabaseSync(
    path.join(dataDirectory, "vehicle-360.sqlite"),
  );

  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      stock_identifier TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS captures (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      source_video_path TEXT,
      source_filename TEXT,
      source_mime_type TEXT,
      source_size_bytes INTEGER,
      target_frame_count INTEGER NOT NULL DEFAULT 72,
      frame_count INTEGER NOT NULL DEFAULT 0,
      width INTEGER,
      height INTEGER,
      duration_seconds REAL,
      fps REAL,
      codec TEXT,
      orientation INTEGER,
      total_frame_estimate INTEGER,
      status TEXT NOT NULL DEFAULT 'UPLOADED',
      processing_stage TEXT,
      processing_progress INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      processing_requested_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    ) STRICT;

    CREATE INDEX IF NOT EXISTS captures_vehicle_id_idx
      ON captures(vehicle_id);

    CREATE TABLE IF NOT EXISTS frames (
      id TEXT PRIMARY KEY,
      capture_id TEXT NOT NULL,
      frame_index INTEGER NOT NULL,
      path TEXT NOT NULL,
      thumbnail_path TEXT,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(capture_id, frame_index),
      FOREIGN KEY (capture_id) REFERENCES captures(id) ON DELETE CASCADE
    ) STRICT;

    CREATE INDEX IF NOT EXISTS frames_capture_id_idx
      ON frames(capture_id);
  `);

  return database;
}

export function getDatabase() {
  if (!globalForDatabase.vehicle360Database) {
    globalForDatabase.vehicle360Database = openDatabase();
  }

  return globalForDatabase.vehicle360Database;
}
