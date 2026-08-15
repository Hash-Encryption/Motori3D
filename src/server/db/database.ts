import "server-only";

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const globalForDatabase = globalThis as typeof globalThis & {
  vehicle360Database?: DatabaseSync;
};

function runLocalMigrations(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedVersions = new Set(
    (
      database
        .prepare("SELECT version FROM schema_migrations")
        .all() as { version: string }[]
    ).map((row) => row.version),
  );

  // Baseline migration (creates baseline tables if opening a fresh database)
  if (!appliedVersions.has("001_baseline_sqlite_schema")) {
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

    database
      .prepare(
        "INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('001_baseline_sqlite_schema', ?)",
      )
      .run(new Date().toISOString());
  }

  // Phase 03 Migration: Add nullable business_id ownership bridge to vehicles
  if (!appliedVersions.has("002_add_vehicles_business_id")) {
    const columns = database
      .prepare("PRAGMA table_info(vehicles)")
      .all() as { name: string }[];
    const hasBusinessId = columns.some((col) => col.name === "business_id");

    if (!hasBusinessId) {
      database.exec("ALTER TABLE vehicles ADD COLUMN business_id TEXT;");
    }

    database.exec(`
      CREATE INDEX IF NOT EXISTS vehicles_business_id_idx
        ON vehicles(business_id);
    `);

    database
      .prepare(
        "INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('002_add_vehicles_business_id', ?)",
      )
      .run(new Date().toISOString());
  }
}

function openDatabase() {
  const dataDirectory = path.resolve(process.cwd(), "data");
  mkdirSync(dataDirectory, { recursive: true });

  const database = new DatabaseSync(
    path.join(dataDirectory, "vehicle-360.sqlite"),
  );

  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA journal_mode = WAL;");

  runLocalMigrations(database);

  return database;
}

export function getDatabase() {
  if (!globalForDatabase.vehicle360Database) {
    globalForDatabase.vehicle360Database = openDatabase();
  }

  return globalForDatabase.vehicle360Database;
}
