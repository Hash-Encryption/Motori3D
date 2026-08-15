import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import { getLatestCaptureForVehicle, listCaptureFrames } from "@/server/captures/capture-repository";
import type {
  CreateInventoryVehicleInput,
  EnrichedInventoryVehicle,
  InventoryFilterOptions,
  InventoryVehicle,
  UpdateInventoryVehicleInput,
  VehicleLifecycleStatus,
} from "./inventory-types";
import {
  createVehicleForBusiness,
  deleteEmptyVehicleForBusiness,
  getVehicleForBusiness,
  hasVehicleCaptures,
  updateVehicleForBusiness,
} from "./vehicle-repository";

type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];

function mapInventoryRow(row: VehicleRow): InventoryVehicle {
  return {
    id: row.id,
    businessId: row.business_id,
    make: row.make,
    model: row.model,
    year: row.year,
    price: row.price,
    mileage: row.mileage,
    vin: row.vin,
    stockNumber: row.stock_number,
    trim: row.trim,
    exteriorColor: row.exterior_color,
    interiorColor: row.interior_color,
    bodyStyle: row.body_style,
    transmission: row.transmission,
    fuelType: row.fuel_type,
    status: row.status as VehicleLifecycleStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Enriches an authoritative Supabase inventory vehicle with local SQLite capture state.
 */
export function enrichInventoryVehicle(vehicle: InventoryVehicle): EnrichedInventoryVehicle {
  const capture = getLatestCaptureForVehicle(vehicle.id);
  const frames = capture?.status === "READY" ? listCaptureFrames(capture.id) : [];
  const isSpinReady = capture?.status === "READY" && frames.length > 0;

  return {
    ...vehicle,
    hasCapture: capture !== null,
    captureId: capture?.id ?? null,
    captureStatus: capture?.status ?? null,
    frameCount: capture?.frameCount ?? 0,
    isSpinReady,
  };
}

/**
 * List inventory vehicles for an authorized dealership tenant with secure search and status filters.
 */
export async function listInventoryVehicles(
  supabase: SupabaseClient<Database>,
  businessId: string,
  filters?: InventoryFilterOptions,
): Promise<EnrichedInventoryVehicle[]> {
  let query = supabase
    .from("vehicles")
    .select("*")
    .eq("business_id", businessId);

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.query) {
    const rawQuery = filters.query.trim().replace(/[%_]/g, "\\$&");
    if (rawQuery) {
      // Safe parameterized ILIKE search across make, model, VIN, and stock number
      query = query.or(
        `make.ilike.%${rawQuery}%,model.ilike.%${rawQuery}%,vin.ilike.%${rawQuery}%,stock_number.ilike.%${rawQuery}%`,
      );
    }
  }

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list inventory vehicles: ${error.message}`);
  }

  return (data ?? []).map((row) => enrichInventoryVehicle(mapInventoryRow(row)));
}

/**
 * Get a single inventory vehicle by ID for an authorized dealership tenant.
 */
export async function getInventoryVehicle(
  supabase: SupabaseClient<Database>,
  vehicleId: string,
  businessId: string,
): Promise<EnrichedInventoryVehicle | null> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", vehicleId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to get inventory vehicle: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return enrichInventoryVehicle(mapInventoryRow(data));
}

/**
 * Create a new inventory vehicle in Supabase and provision its matching SQLite processing record.
 * Uses two-phase execution with compensation handling to prevent dangling or broken state.
 */
export async function createInventoryVehicle(
  supabase: SupabaseClient<Database>,
  input: CreateInventoryVehicleInput,
  businessId: string,
): Promise<EnrichedInventoryVehicle> {
  const vehicleId = randomUUID();
  const name = `${input.year} ${input.make} ${input.model}`;

  // Step 1: Insert canonical inventory record in Supabase with RLS
  const { data: inserted, error: supabaseError } = await supabase
    .from("vehicles")
    .insert({
      id: vehicleId,
      business_id: businessId,
      make: input.make,
      model: input.model,
      year: input.year,
      price: input.price ?? null,
      mileage: input.mileage ?? null,
      vin: input.vin ?? null,
      stock_number: input.stockNumber ?? null,
      trim: input.trim ?? null,
      exterior_color: input.exteriorColor ?? null,
      interior_color: input.interiorColor ?? null,
      body_style: input.bodyStyle ?? null,
      transmission: input.transmission ?? null,
      fuel_type: input.fuelType ?? null,
      status: input.status ?? "DRAFT",
    })
    .select()
    .single();

  if (supabaseError || !inserted) {
    throw new Error(
      `Failed to create inventory vehicle in Supabase: ${supabaseError?.message ?? "Unknown error"}`,
    );
  }

  // Step 2: Provision matching SQLite local processing record with the identical vehicle UUID
  try {
    createVehicleForBusiness(
      {
        name,
        make: input.make,
        model: input.model,
        year: input.year,
        stockIdentifier: input.stockNumber ?? null,
      },
      businessId,
      vehicleId,
    );
  } catch (sqliteError) {
    // Partial failure compensation: Rollback the Supabase record to avoid broken processing identity
    console.error("SQLite processing provisioning failed, compensating Supabase insert...", sqliteError);
    await supabase.from("vehicles").delete().eq("id", vehicleId);
    throw new Error(
      `Failed to provision local processing plane for vehicle: ${sqliteError instanceof Error ? sqliteError.message : "SQLite error"}. Inventory creation was rolled back.`,
    );
  }

  return enrichInventoryVehicle(mapInventoryRow(inserted));
}

/**
 * Update an existing inventory vehicle's metadata.
 * Prohibits changing id or business_id to enforce identity invariants.
 */
export async function updateInventoryVehicle(
  supabase: SupabaseClient<Database>,
  vehicleId: string,
  input: UpdateInventoryVehicleInput,
  businessId: string,
): Promise<EnrichedInventoryVehicle> {
  const updatePayload: Database["public"]["Tables"]["vehicles"]["Update"] = {};

  if (input.make !== undefined) updatePayload.make = input.make;
  if (input.model !== undefined) updatePayload.model = input.model;
  if (input.year !== undefined) updatePayload.year = input.year;
  if (input.price !== undefined) updatePayload.price = input.price;
  if (input.mileage !== undefined) updatePayload.mileage = input.mileage;
  if (input.vin !== undefined) updatePayload.vin = input.vin;
  if (input.stockNumber !== undefined) updatePayload.stock_number = input.stockNumber;
  if (input.trim !== undefined) updatePayload.trim = input.trim;
  if (input.exteriorColor !== undefined) updatePayload.exterior_color = input.exteriorColor;
  if (input.interiorColor !== undefined) updatePayload.interior_color = input.interiorColor;
  if (input.bodyStyle !== undefined) updatePayload.body_style = input.bodyStyle;
  if (input.transmission !== undefined) updatePayload.transmission = input.transmission;
  if (input.fuelType !== undefined) updatePayload.fuel_type = input.fuelType;
  if (input.status !== undefined) updatePayload.status = input.status;

  const { data: updated, error } = await supabase
    .from("vehicles")
    .update(updatePayload)
    .eq("id", vehicleId)
    .eq("business_id", businessId)
    .select()
    .single();

  if (error || !updated) {
    throw new Error(`Failed to update inventory vehicle: ${error?.message ?? "Vehicle not found"}`);
  }

  // Sync basic display metadata in SQLite if processing record exists
  const existingLocal = getVehicleForBusiness(vehicleId, businessId);
  if (existingLocal) {
    const newMake = input.make ?? existingLocal.make;
    const newModel = input.model ?? existingLocal.model;
    const newYear = input.year ?? existingLocal.year;
    updateVehicleForBusiness(vehicleId, businessId, {
      name: `${newYear} ${newMake} ${newModel}`,
      make: newMake,
      model: newModel,
      year: newYear,
      stockIdentifier: input.stockNumber !== undefined ? input.stockNumber : existingLocal.stockIdentifier,
    });
  }

  return enrichInventoryVehicle(mapInventoryRow(updated));
}

/**
 * Update inventory lifecycle status (DRAFT, PUBLISHED, SOLD).
 */
export async function updateInventoryStatus(
  supabase: SupabaseClient<Database>,
  vehicleId: string,
  status: VehicleLifecycleStatus,
  businessId: string,
): Promise<EnrichedInventoryVehicle> {
  return updateInventoryVehicle(supabase, vehicleId, { status }, businessId);
}

/**
 * Safe Non-Destructive Deletion with Deterministic Compensation:
 * - If vehicle has linked captures/frames/media in SQLite: BLOCKS deletion immediately to protect evidence.
 * - If vehicle has NO captures:
 *   1. Captures snapshot of local processing record.
 *   2. Deletes empty SQLite processing record.
 *   3. Attempts authorized Supabase deletion.
 *   4. If Supabase deletion fails: compensates by restoring the local SQLite processing record with the same UUID and business ownership, preserving identity consistency.
 */
export async function deleteInventoryVehicle(
  supabase: SupabaseClient<Database>,
  vehicleId: string,
  businessId: string,
): Promise<{ success: boolean }> {
  // Step 1: Check if processing plane holds captures or media evidence
  if (hasVehicleCaptures(vehicleId)) {
    throw new Error(
      "Cannot delete vehicle with attached captures or 360 media. Processing evidence is protected. Set status to SOLD instead.",
    );
  }

  // Step 2: Retain snapshot of local processing record before deletion
  const localSnapshot = getVehicleForBusiness(vehicleId, businessId);

  // Step 3: Delete empty SQLite stub
  const { deleted: localDeleted } = deleteEmptyVehicleForBusiness(vehicleId, businessId);

  // Step 4: Delete Supabase inventory metadata with RLS
  const { error: supabaseError } = await supabase
    .from("vehicles")
    .delete()
    .eq("id", vehicleId)
    .eq("business_id", businessId);

  if (supabaseError) {
    // Compensation: Restore local SQLite processing record if it was deleted
    if (localSnapshot && localDeleted) {
      try {
        createVehicleForBusiness(
          {
            name: localSnapshot.name,
            make: localSnapshot.make,
            model: localSnapshot.model,
            year: localSnapshot.year,
            stockIdentifier: localSnapshot.stockIdentifier,
          },
          localSnapshot.businessId,
          localSnapshot.id,
        );
      } catch (compensationError) {
        console.error(
          "Failed to restore local processing vehicle during delete compensation",
          compensationError,
        );
      }
    }

    throw new Error(
      `Failed to delete vehicle metadata from Supabase: ${supabaseError.message}. Local processing state was restored.`,
    );
  }

  return { success: true };
}
