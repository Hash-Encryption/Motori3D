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
 * Reuses the canonical inventory UUID if supplied.
 */
export function createVehicleForBusiness(
  input: CreateVehicleInput,
  businessId: string | null,
  explicitId?: string,
): VehicleRecord {
  const id = explicitId || randomUUID();
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

/**
 * Update local vehicle processing metadata for an authorized business.
 * Disallows mutating id or business_id to enforce identity invariants.
 */
export function updateVehicleForBusiness(
  vehicleId: string,
  businessId: string,
  updates: {
    name?: string;
    make?: string;
    model?: string;
    year?: number;
    stockIdentifier?: string | null;
  },
): VehicleRecord | null {
  const existing = getVehicleForBusiness(vehicleId, businessId);
  if (!existing) {
    return null;
  }

  const timestamp = new Date().toISOString();
  const updatedName = updates.name ?? existing.name;
  const updatedMake = updates.make ?? existing.make;
  const updatedModel = updates.model ?? existing.model;
  const updatedYear = updates.year ?? existing.year;
  const updatedStock =
    updates.stockIdentifier !== undefined
      ? updates.stockIdentifier
      : existing.stockIdentifier;

  getDatabase()
    .prepare(
      `UPDATE vehicles SET
        name = ?, make = ?, model = ?, year = ?, stock_identifier = ?, updated_at = ?
       WHERE id = ? AND business_id = ?`,
    )
    .run(
      updatedName,
      updatedMake,
      updatedModel,
      updatedYear,
      updatedStock,
      timestamp,
      vehicleId,
      businessId,
    );

  return getVehicleForBusiness(vehicleId, businessId);
}

/**
 * Check whether any captures exist for a vehicle in SQLite.
 */
export function hasVehicleCaptures(vehicleId: string): boolean {
  const result = getDatabase()
    .prepare("SELECT count(*) as count FROM captures WHERE vehicle_id = ?")
    .get(vehicleId) as { count: number } | undefined;

  return (result?.count ?? 0) > 0;
}

/**
 * Safe Non-Destructive Deletion:
 * Deletes local SQLite processing record ONLY if no captures or media exist.
 * If captures exist, throws an error to protect processing evidence.
 */
export function deleteEmptyVehicleForBusiness(
  vehicleId: string,
  businessId: string,
): { deleted: boolean } {
  const vehicle = getVehicleForBusiness(vehicleId, businessId);
  if (!vehicle) {
    return { deleted: false };
  }

  if (hasVehicleCaptures(vehicleId)) {
    throw new Error(
      "Cannot delete vehicle with attached captures or 360 media. Processing evidence is protected.",
    );
  }

  getDatabase()
    .prepare("DELETE FROM vehicles WHERE id = ? AND business_id = ?")
    .run(vehicleId, businessId);

  return { deleted: true };
}
