import "server-only";

import { randomUUID } from "node:crypto";

import { getDatabase } from "@/server/db/database";
import type { CreateVehicleInput } from "@/server/vehicles/vehicle-validation";

export type VehicleStatus = "DRAFT" | "PROCESSING" | "READY" | "FAILED";

export type VehicleRecord = {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
  stockIdentifier: string | null;
  status: VehicleStatus;
  createdAt: string;
  updatedAt: string;
};

type VehicleRow = {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
  stock_identifier: string | null;
  status: VehicleStatus;
  created_at: string;
  updated_at: string;
};

function mapVehicle(row: VehicleRow): VehicleRecord {
  return {
    id: row.id,
    name: row.name,
    make: row.make,
    model: row.model,
    year: row.year,
    stockIdentifier: row.stock_identifier,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listVehicles(): VehicleRecord[] {
  const rows = getDatabase()
    .prepare(
      `SELECT id, name, make, model, year, stock_identifier, status,
              created_at, updated_at
       FROM vehicles
       ORDER BY created_at DESC`,
    )
    .all() as VehicleRow[];

  return rows.map(mapVehicle);
}

export function getVehicle(id: string): VehicleRecord | null {
  const row = getDatabase()
    .prepare(
      `SELECT id, name, make, model, year, stock_identifier, status,
              created_at, updated_at
       FROM vehicles
       WHERE id = ?`,
    )
    .get(id) as VehicleRow | undefined;

  return row ? mapVehicle(row) : null;
}

export function createVehicle(input: CreateVehicleInput): VehicleRecord {
  const id = randomUUID();
  const timestamp = new Date().toISOString();

  getDatabase()
    .prepare(
      `INSERT INTO vehicles (
        id, name, make, model, year, stock_identifier, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)`,
    )
    .run(
      id,
      input.name,
      input.make,
      input.model,
      input.year,
      input.stockIdentifier,
      timestamp,
      timestamp,
    );

  const vehicle = getVehicle(id);
  if (!vehicle) {
    throw new Error("Vehicle was inserted but could not be read back.");
  }

  return vehicle;
}
