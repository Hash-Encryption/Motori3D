import "server-only";

import { randomUUID } from "node:crypto";

import { getDatabase } from "@/server/db/database";
import type { CreateVehicleInput } from "@/server/vehicles/vehicle-validation";

export type VehicleStatus = "DRAFT" | "PROCESSING" | "READY" | "FAILED";

export type VehicleRecord = {
  id: string;
  businessId: string | null;
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
  business_id: string | null;
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
    businessId: row.business_id,
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

/**
 * Legacy / Prototype unscoped vehicle listing.
 * Returns only legacy vehicles (where business_id is NULL) to prevent leaking tenant data.
 */
export function listVehicles(): VehicleRecord[] {
  const rows = getDatabase()
    .prepare(
      `SELECT id, business_id, name, make, model, year, stock_identifier, status,
              created_at, updated_at
       FROM vehicles
       WHERE business_id IS NULL
       ORDER BY created_at DESC`,
    )
    .all() as VehicleRow[];

  return rows.map(mapVehicle);
}

/**
 * Tenant-scoped vehicle listing for authenticated dealerships.
 */
export function listVehiclesForBusiness(businessId: string): VehicleRecord[] {
  const rows = getDatabase()
    .prepare(
      `SELECT id, business_id, name, make, model, year, stock_identifier, status,
              created_at, updated_at
       FROM vehicles
       WHERE business_id = ?
       ORDER BY created_at DESC`,
    )
    .all(businessId) as VehicleRow[];

  return rows.map(mapVehicle);
}

/**
 * Internal / pipeline vehicle lookup by ID.
 */
export function getVehicle(id: string): VehicleRecord | null {
  const row = getDatabase()
    .prepare(
      `SELECT id, business_id, name, make, model, year, stock_identifier, status,
              created_at, updated_at
       FROM vehicles
       WHERE id = ?`,
    )
    .get(id) as VehicleRow | undefined;

  return row ? mapVehicle(row) : null;
}

/**
 * Tenant-scoped vehicle lookup by ID and authorized business ID.
 */
export function getVehicleForBusiness(
  vehicleId: string,
  businessId: string,
): VehicleRecord | null {
  const row = getDatabase()
    .prepare(
      `SELECT id, business_id, name, make, model, year, stock_identifier, status,
              created_at, updated_at
       FROM vehicles
       WHERE id = ? AND business_id = ?`,
    )
    .get(vehicleId, businessId) as VehicleRow | undefined;

  return row ? mapVehicle(row) : null;
}

/**
 * Legacy / unauthenticated vehicle creation (business_id is NULL).
 */
export function createVehicle(input: CreateVehicleInput): VehicleRecord {
  return createVehicleForBusiness(input, null);
}

/**
 * Tenant-scoped vehicle creation associated with an authorized business UUID.
 */
export function createVehicleForBusiness(
  input: CreateVehicleInput,
  businessId: string | null,
): VehicleRecord {
  const id = randomUUID();
  const timestamp = new Date().toISOString();

  getDatabase()
    .prepare(
      `INSERT INTO vehicles (
        id, business_id, name, make, model, year, stock_identifier, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)`,
    )
    .run(
      id,
      businessId,
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
