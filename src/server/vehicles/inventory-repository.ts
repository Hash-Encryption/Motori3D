import { randomUUID } from "node:crypto";
import { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import {
  createVehicleForBusiness,
  deleteEmptyVehicleForBusiness,
  getVehicleForBusiness,
  hasVehicleCaptures,
  updateVehicleForBusiness,
} from "./vehicle-repository";
import { getLatestCaptureForVehicle, listCaptureFrames } from "@/server/captures/capture-repository";
import type {
  CreateInventoryVehicleInput,
  CreateListingWithUnitInput,
  CreatePhysicalUnitInput,
  EnrichedInventoryVehicle,
  InventoryFilterOptions,
  InventoryVehicle,
  ListingFilterOptions,
  ListingInventorySummary,
  ListingPublicationStatus,
  ListingWithUnits,
  PhysicalInventoryUnit,
  PhysicalUnitStatus,
  UpdateInventoryVehicleInput,
  UpdatePhysicalUnitInput,
  UpdateVehicleListingInput,
  VehicleLifecycleStatus,
  VehicleListing,
} from "./inventory-types";

type ListingRow = Database["public"]["Tables"]["vehicle_listings"]["Row"];
type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];
type ListingRowWithUnits = ListingRow & { units?: VehicleRow[] };
type CaptureRow = Database["public"]["Tables"]["cloud_captures"]["Row"];

function isPlatformUnsupportedError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("[unenv]") ||
    msg.includes("mkdirSync") ||
    msg.includes("not implemented")
  );
}

// ==============================================================================
// Domain Mappers
// ==============================================================================

export function mapListingRow(row: ListingRow): VehicleListing {
  return {
    id: row.id,
    businessId: row.business_id,
    title: row.title,
    make: row.make,
    model: row.model,
    year: row.year,
    trim: row.trim,
    bodyStyle: row.body_style,
    transmission: row.transmission,
    fuelType: row.fuel_type,
    price: row.price,
    description: row.description,
    status: row.status as ListingPublicationStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPhysicalUnitRow(
  row: VehicleRow,
  captureInfo?: {
    hasCapture: boolean;
    captureId: string | null;
    captureStatus: string | null;
    frameCount: number;
    isSpinReady: boolean;
  },
): PhysicalInventoryUnit {
  return {
    id: row.id,
    businessId: row.business_id,
    listingId: row.listing_id ?? "",
    make: row.make,
    model: row.model,
    year: row.year,
    trim: row.trim,
    vin: row.vin,
    stockNumber: row.stock_number,
    mileage: row.mileage,
    exteriorColor: row.exterior_color,
    interiorColor: row.interior_color,
    status: row.status as PhysicalUnitStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hasCapture: captureInfo?.hasCapture ?? false,
    captureId: captureInfo?.captureId ?? null,
    captureStatus: captureInfo?.captureStatus ?? null,
    frameCount: captureInfo?.frameCount ?? 0,
    isSpinReady: captureInfo?.isSpinReady ?? false,
  };
}

export function mapInventoryRow(row: VehicleRow): InventoryVehicle {
  return {
    id: row.id,
    businessId: row.business_id,
    listingId: row.listing_id ?? undefined,
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

export function enrichInventoryVehicle(vehicle: InventoryVehicle): EnrichedInventoryVehicle {
  let capture = null;
  let frames: unknown[] = [];

  try {
    capture = getLatestCaptureForVehicle(vehicle.id);
    frames = capture?.status === "READY" ? listCaptureFrames(capture.id) : [];
  } catch (err) {
    if (!isPlatformUnsupportedError(err)) {
      console.warn("Could not load local capture for vehicle", err);
    }
  }

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

// ==============================================================================
// Phase 06: Vehicle Listings Operations
// ==============================================================================

/**
 * List vehicle listings for an authorized dealership tenant with joined available unit counts.
 * Available quantity is strictly: COUNT(vehicles WHERE listing_id = listing.id AND status = 'PUBLISHED')
 */
export async function listVehicleListings(
  supabase: SupabaseClient<Database>,
  businessId: string,
  filters?: ListingFilterOptions,
): Promise<ListingInventorySummary[]> {
  let query = supabase
    .from("vehicle_listings")
    .select(`
      *,
      units:vehicles(
        id,
        status,
        vin,
        stock_number,
        mileage,
        exterior_color
      )
    `)
    .eq("business_id", businessId);

  if (filters?.status && filters.status !== "ALL") {
    query = query.eq("status", filters.status);
  }

  if (filters?.query) {
    const rawQuery = filters.query.trim().replace(/[%_]/g, "\\$&");
    if (rawQuery) {
      query = query.or(
        `title.ilike.%${rawQuery}%,make.ilike.%${rawQuery}%,model.ilike.%${rawQuery}%`,
      );
    }
  }

  query = query.order("created_at", { ascending: false });

  const { data: rows, error } = await query;
  if (error) {
    if (error.message.includes("vehicle_listings") || (error as { code?: string }).code === "PGRST205") {
      const legacyVehicles = await listInventoryVehicles(supabase, businessId, {
        query: filters?.query,
        status: filters?.status === "ALL" ? undefined : (filters?.status as VehicleLifecycleStatus),
      });
      return legacyVehicles.map((v) => ({
        id: v.listingId || v.id,
        businessId: v.businessId,
        title: `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`,
        make: v.make,
        model: v.model,
        year: v.year,
        trim: v.trim,
        bodyStyle: v.bodyStyle,
        transmission: v.transmission,
        fuelType: v.fuelType,
        price: v.price,
        description: null,
        status: (v.status === "SOLD" ? "ARCHIVED" : (v.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT")) as ListingPublicationStatus,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
        availableUnitCount: v.status === "PUBLISHED" ? 1 : 0,
        totalUnitCount: 1,
        hasCapture: v.hasCapture,
        isSpinReady: v.isSpinReady,
        captureId: v.captureId,
      }));
    }
    console.error("Failed to list vehicle listings", error);
    throw new Error(`Failed to list vehicle listings: ${error.message}`);
  }

  // Pre-fetch cloud captures for units in these listings
  const listingRows = (rows || []) as unknown as ListingRowWithUnits[];
  const allUnits = listingRows.flatMap((r) => r.units || []);
  const unitIds = allUnits.map((u) => u.id);
  const cloudCapturesMap = new Map<string, CaptureRow>();

  if (unitIds.length > 0) {
    try {
      const { data: captures } = await supabase
        .from("cloud_captures")
        .select("*")
        .in("vehicle_id", unitIds)
        .eq("status", "READY");

      if (captures) {
        for (const c of captures) {
          cloudCapturesMap.set(c.vehicle_id, c);
        }
      }
    } catch {
      // Ignored if table not populated
    }
  }

  return listingRows.map((row) => {
    const mapped = mapListingRow(row);
    const units = row.units || [];
    // Derivation rule: only physical units with status === 'PUBLISHED' count as available
    const availableUnitCount = units.filter((u) => u.status === "PUBLISHED").length;
    const totalUnitCount = units.length;

    let hasCapture = false;
    let isSpinReady = false;
    let captureId: string | null = null;

    for (const u of units) {
      const cloud = cloudCapturesMap.get(u.id);
      if (cloud) {
        hasCapture = true;
        isSpinReady = true;
        captureId = cloud.id;
        break;
      }
      try {
        const local = getLatestCaptureForVehicle(u.id);
        if (local && local.status === "READY") {
          hasCapture = true;
          isSpinReady = true;
          captureId = local.id;
          break;
        }
      } catch {
        // Ignored in serverless
      }
    }

    return {
      ...mapped,
      availableUnitCount,
      totalUnitCount,
      hasCapture,
      isSpinReady,
      captureId,
    };
  });
}

/**
 * Retrieve a single vehicle listing with all attached physical inventory units.
 */
export async function getVehicleListingWithUnits(
  supabase: SupabaseClient<Database>,
  listingId: string,
  businessId: string,
): Promise<ListingWithUnits | null> {
  const { data: listingRow, error: listingError } = await supabase
    .from("vehicle_listings")
    .select("*")
    .eq("id", listingId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (listingError) {
    if (listingError.message.includes("vehicle_listings") || (listingError as { code?: string }).code === "PGRST205") {
      return null;
    }
    console.error("Failed to fetch vehicle listing", listingError);
    throw new Error(`Failed to fetch vehicle listing: ${listingError.message}`);
  }

  if (!listingRow) {
    return null;
  }

  const { data: unitRows, error: unitsError } = await supabase
    .from("vehicles")
    .select("*")
    .eq("listing_id", listingId)
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (unitsError) {
    console.error("Failed to fetch physical units for listing", unitsError);
    throw new Error(`Failed to fetch units: ${unitsError.message}`);
  }

  const unitIds = (unitRows || []).map((u) => u.id);
  const cloudCapturesMap = new Map<string, CaptureRow>();

  if (unitIds.length > 0) {
    try {
      const { data: captures } = await supabase
        .from("cloud_captures")
        .select("*")
        .in("vehicle_id", unitIds);

      if (captures) {
        for (const c of captures) {
          cloudCapturesMap.set(c.vehicle_id, c);
        }
      }
    } catch {
      // Ignored
    }
  }

  const units: PhysicalInventoryUnit[] = (unitRows || []).map((row) => {
    const cloud = cloudCapturesMap.get(row.id);
    let captureInfo: {
      hasCapture: boolean;
      captureId: string | null;
      captureStatus: string | null;
      frameCount: number;
      isSpinReady: boolean;
    } | null = cloud
      ? {
          hasCapture: true,
          captureId: cloud.id,
          captureStatus: cloud.status,
          frameCount: cloud.frame_count,
          isSpinReady: cloud.status === "READY",
        }
      : null;

    if (!captureInfo) {
      try {
        const local = getLatestCaptureForVehicle(row.id);
        const frames = local?.status === "READY" ? listCaptureFrames(local.id) : [];
        captureInfo = {
          hasCapture: local !== null,
          captureId: local?.id ?? null,
          captureStatus: local?.status ?? null,
          frameCount: local?.frameCount ?? 0,
          isSpinReady: local?.status === "READY" && frames.length > 0,
        };
      } catch {
        // Ignored
      }
    }

    return mapPhysicalUnitRow(row, captureInfo ?? undefined);
  });

  const availableUnitCount = units.filter((u) => u.status === "PUBLISHED").length;

  return {
    listing: mapListingRow(listingRow),
    units,
    availableUnitCount,
    totalUnitCount: units.length,
  };
}

/**
 * Atomic Creation of a Vehicle Listing + Initial Physical Unit.
 * Uses dedicated PostgreSQL RPC `create_listing_with_unit` for genuine database transaction atomicity.
 * If unit creation fails, listing creation is automatically rolled back by PostgreSQL.
 */
export async function createVehicleListingWithUnit(
  supabase: SupabaseClient<Database>,
  input: CreateListingWithUnitInput,
  businessId: string,
): Promise<{ listing: VehicleListing; unit: PhysicalInventoryUnit }> {
  const listingTitle =
    input.listing.title ||
    [input.listing.year, input.listing.make, input.listing.model, input.listing.trim]
      .filter(Boolean)
      .join(" ");

  const payloadListing = {
    business_id: businessId,
    title: listingTitle,
    make: input.listing.make,
    model: input.listing.model,
    year: input.listing.year,
    trim: input.listing.trim ?? null,
    body_style: input.listing.bodyStyle ?? null,
    transmission: input.listing.transmission ?? null,
    fuel_type: input.listing.fuelType ?? null,
    price: input.listing.price ?? null,
    description: input.listing.description ?? null,
    status: input.listing.status ?? "DRAFT",
  };

  const unitId = input.unit.id || randomUUID();
  const payloadUnit = {
    id: unitId,
    vin: input.unit.vin ?? null,
    stock_number: input.unit.stockNumber ?? null,
    mileage: input.unit.mileage ?? null,
    exterior_color: input.unit.exteriorColor ?? null,
    interior_color: input.unit.interiorColor ?? null,
    status: input.unit.status ?? "PUBLISHED",
  };

  // Step 1: Execute atomic transactional RPC in PostgreSQL
  let rpcResult: { listing_id: string; unit_id: string } | null = null;
  const rpcClient = supabase as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: { listing_id: string; unit_id: string } | null; error: { message: string } | null }>;
  };
  const { data, error: rpcError } = await rpcClient.rpc("create_listing_with_unit", {
    p_listing: payloadListing,
    p_unit: payloadUnit,
  });

  if (rpcError || !data) {
    const isMissingRpc =
      rpcError &&
      (rpcError.message.toLowerCase().includes("not find") ||
        rpcError.message.toLowerCase().includes("not found") ||
        rpcError.message.toLowerCase().includes("does not exist") ||
        rpcError.message.toLowerCase().includes("function"));

    if (rpcError && !isMissingRpc) {
      throw new Error(`Failed to create listing with unit: ${rpcError.message}`);
    }

    // Direct fallback insertion with manual rollback if RPC not yet installed
    const listingId = randomUUID();

    const { data: insertedListing, error: listErr } = await supabase
      .from("vehicle_listings")
      .insert({
        id: listingId,
        ...payloadListing,
      })
      .select()
      .single();

    if (listErr || !insertedListing) {
      throw new Error(`Failed to create vehicle listing: ${listErr?.message ?? "Unknown error"}`);
    }

    const { data: insertedUnit, error: unitErr } = await supabase
      .from("vehicles")
      .insert({
        id: unitId,
        business_id: businessId,
        listing_id: listingId,
        make: input.listing.make,
        model: input.listing.model,
        year: input.listing.year,
        trim: input.listing.trim ?? null,
        body_style: input.listing.bodyStyle ?? null,
        transmission: input.listing.transmission ?? null,
        fuel_type: input.listing.fuelType ?? null,
        price: input.listing.price ?? null,
        vin: input.unit.vin ?? null,
        stock_number: input.unit.stockNumber ?? null,
        mileage: input.unit.mileage ?? null,
        exterior_color: input.unit.exteriorColor ?? null,
        interior_color: input.unit.interiorColor ?? null,
        status: input.unit.status ?? "PUBLISHED",
      })
      .select()
      .single();

    if (unitErr || !insertedUnit) {
      await supabase.from("vehicle_listings").delete().eq("id", listingId);
      throw new Error(`Failed to create physical unit: ${unitErr?.message ?? "Unknown error"}. Listing rolled back.`);
    }

    rpcResult = { listing_id: listingId, unit_id: unitId };
  } else {
    rpcResult = typeof data === "string" ? JSON.parse(data) : data;
  }

  // Step 2: Provision matching SQLite local processing record with the identical physical unit UUID
  const finalUnitId = rpcResult!.unit_id;
  const finalListingId = rpcResult!.listing_id;
  const localName = `${input.listing.year} ${input.listing.make} ${input.listing.model}`;

  try {
    createVehicleForBusiness(
      {
        name: localName,
        make: input.listing.make,
        model: input.listing.model,
        year: input.listing.year,
        stockIdentifier: input.unit.stockNumber ?? null,
      },
      businessId,
      finalUnitId,
    );
  } catch (sqliteError) {
    if (!isPlatformUnsupportedError(sqliteError)) {
      console.error("SQLite processing provisioning failed, compensating Supabase insert...", sqliteError);
      await supabase.from("vehicles").delete().eq("id", finalUnitId);
      await supabase.from("vehicle_listings").delete().eq("id", finalListingId);
      throw new Error(
        `Failed to provision local processing plane: ${sqliteError instanceof Error ? sqliteError.message : "SQLite error"}. Rollback completed.`,
      );
    }
  }

  const listingDetail = await getVehicleListingWithUnits(supabase, finalListingId, businessId);
  if (!listingDetail) {
    throw new Error("Created listing could not be read back.");
  }

  const createdUnit = listingDetail.units.find((u) => u.id === finalUnitId);
  if (!createdUnit) {
    throw new Error("Created physical unit could not be read back.");
  }

  return {
    listing: listingDetail.listing,
    unit: createdUnit,
  };
}

/**
 * Add an additional physical unit to an existing listing.
 * Non-destructively mirrors listing specifications onto vehicles row for backward compatibility.
 */
export async function addPhysicalUnitToListing(
  supabase: SupabaseClient<Database>,
  listingId: string,
  unitInput: CreatePhysicalUnitInput,
  businessId: string,
): Promise<PhysicalInventoryUnit> {
  const { data: listing, error: listErr } = await supabase
    .from("vehicle_listings")
    .select("*")
    .eq("id", listingId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (listErr || !listing) {
    throw new Error("Target listing not found in authorized dealership.");
  }

  const unitId = unitInput.id || randomUUID();

  const { data: inserted, error: unitErr } = await supabase
    .from("vehicles")
    .insert({
      id: unitId,
      business_id: businessId,
      listing_id: listingId,
      make: listing.make,
      model: listing.model,
      year: listing.year,
      trim: listing.trim,
      body_style: listing.body_style,
      transmission: listing.transmission,
      fuel_type: listing.fuel_type,
      price: listing.price,
      vin: unitInput.vin ?? null,
      stock_number: unitInput.stockNumber ?? null,
      mileage: unitInput.mileage ?? null,
      exterior_color: unitInput.exteriorColor ?? null,
      interior_color: unitInput.interiorColor ?? null,
      status: unitInput.status ?? "PUBLISHED",
    })
    .select()
    .single();

  if (unitErr || !inserted) {
    throw new Error(`Failed to add physical unit: ${unitErr?.message ?? "Unknown error"}`);
  }

  try {
    createVehicleForBusiness(
      {
        name: `${listing.year} ${listing.make} ${listing.model}`,
        make: listing.make,
        model: listing.model,
        year: listing.year,
        stockIdentifier: unitInput.stockNumber ?? null,
      },
      businessId,
      unitId,
    );
  } catch (sqliteError) {
    if (!isPlatformUnsupportedError(sqliteError)) {
      console.error("SQLite provisioning failed, compensating Supabase unit...", sqliteError);
      await supabase.from("vehicles").delete().eq("id", unitId);
      throw new Error(
        `Failed to provision processing plane for unit: ${sqliteError instanceof Error ? sqliteError.message : "SQLite error"}`,
      );
    }
  }

  return mapPhysicalUnitRow(inserted);
}

/**
 * Reassign an existing physical inventory unit to a different listing within the same dealership.
 * Preserves vehicle UUID, captures, and storage paths. Rejects cross-tenant reassignment.
 */
export async function reassignPhysicalUnit(
  supabase: SupabaseClient<Database>,
  unitId: string,
  targetListingId: string,
  businessId: string,
): Promise<{ success: boolean; unit: PhysicalInventoryUnit }> {
  // Validate that source physical unit exists and belongs to authorized dealership
  const { data: existingUnit, error: unitErr } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", unitId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (unitErr || !existingUnit) {
    throw new Error("Physical inventory unit not found in authorized dealership.");
  }

  // Validate that target listing exists and belongs to the SAME dealership
  const { data: targetListing, error: listErr } = await supabase
    .from("vehicle_listings")
    .select("*")
    .eq("id", targetListingId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (listErr || !targetListing) {
    throw new Error("Target listing not found in authorized dealership.");
  }

  const { data: updated, error: updateErr } = await supabase
    .from("vehicles")
    .update({
      listing_id: targetListingId,
      make: targetListing.make,
      model: targetListing.model,
      year: targetListing.year,
      trim: targetListing.trim,
      body_style: targetListing.body_style,
      transmission: targetListing.transmission,
      fuel_type: targetListing.fuel_type,
      price: targetListing.price,
    })
    .eq("id", unitId)
    .eq("business_id", businessId)
    .select()
    .single();

  if (updateErr || !updated) {
    throw new Error(`Failed to reassign physical unit: ${updateErr?.message ?? "Update error"}`);
  }

  return { success: true, unit: mapPhysicalUnitRow(updated) };
}

/**
 * Update canonical listing-level marketing attributes.
 */
export async function updateVehicleListing(
  supabase: SupabaseClient<Database>,
  listingId: string,
  input: UpdateVehicleListingInput,
  businessId: string,
): Promise<VehicleListing> {
  const updatePayload: Database["public"]["Tables"]["vehicle_listings"]["Update"] = {};

  if (input.title !== undefined) updatePayload.title = input.title;
  if (input.make !== undefined) updatePayload.make = input.make;
  if (input.model !== undefined) updatePayload.model = input.model;
  if (input.year !== undefined) updatePayload.year = input.year;
  if (input.trim !== undefined) updatePayload.trim = input.trim;
  if (input.bodyStyle !== undefined) updatePayload.body_style = input.bodyStyle;
  if (input.transmission !== undefined) updatePayload.transmission = input.transmission;
  if (input.fuelType !== undefined) updatePayload.fuel_type = input.fuelType;
  if (input.price !== undefined) updatePayload.price = input.price;
  if (input.description !== undefined) updatePayload.description = input.description;
  if (input.status !== undefined) updatePayload.status = input.status;

  const { data: updated, error } = await supabase
    .from("vehicle_listings")
    .update(updatePayload)
    .eq("id", listingId)
    .eq("business_id", businessId)
    .select()
    .single();

  if (error || !updated) {
    throw new Error(`Failed to update vehicle listing: ${error?.message ?? "Listing not found"}`);
  }

  // Update mirrored specs on attached units for backward compatibility
  const mirroredUpdates: Partial<Database["public"]["Tables"]["vehicles"]["Update"]> = {};
  if (input.make !== undefined) mirroredUpdates.make = input.make;
  if (input.model !== undefined) mirroredUpdates.model = input.model;
  if (input.year !== undefined) mirroredUpdates.year = input.year;
  if (input.trim !== undefined) mirroredUpdates.trim = input.trim;
  if (input.price !== undefined) mirroredUpdates.price = input.price;
  if (input.bodyStyle !== undefined) mirroredUpdates.body_style = input.bodyStyle;
  if (input.transmission !== undefined) mirroredUpdates.transmission = input.transmission;
  if (input.fuelType !== undefined) mirroredUpdates.fuel_type = input.fuelType;

  if (Object.keys(mirroredUpdates).length > 0) {
    await supabase
      .from("vehicles")
      .update(mirroredUpdates)
      .eq("listing_id", listingId)
      .eq("business_id", businessId);
  }

  return mapListingRow(updated);
}

/**
 * Update physical unit specifications and lifecycle status.
 */
export async function updatePhysicalUnit(
  supabase: SupabaseClient<Database>,
  unitId: string,
  input: UpdatePhysicalUnitInput,
  businessId: string,
): Promise<PhysicalInventoryUnit> {
  const updatePayload: Database["public"]["Tables"]["vehicles"]["Update"] = {};

  if (input.vin !== undefined) updatePayload.vin = input.vin;
  if (input.stockNumber !== undefined) updatePayload.stock_number = input.stockNumber;
  if (input.mileage !== undefined) updatePayload.mileage = input.mileage;
  if (input.exteriorColor !== undefined) updatePayload.exterior_color = input.exteriorColor;
  if (input.interiorColor !== undefined) updatePayload.interior_color = input.interiorColor;
  if (input.status !== undefined) updatePayload.status = input.status;

  const { data: updated, error } = await supabase
    .from("vehicles")
    .update(updatePayload)
    .eq("id", unitId)
    .eq("business_id", businessId)
    .select()
    .single();

  if (error || !updated) {
    throw new Error(`Failed to update physical unit: ${error?.message ?? "Unit not found"}`);
  }

  if (input.stockNumber !== undefined) {
    try {
      const local = getVehicleForBusiness(unitId, businessId);
      if (local) {
        updateVehicleForBusiness(unitId, businessId, {
          stockIdentifier: input.stockNumber,
        });
      }
    } catch {
      // Ignored
    }
  }

  return mapPhysicalUnitRow(updated);
}

/**
 * Safe Non-Destructive Listing Deletion.
 * Blocks deletion if any physical units are attached (ON DELETE RESTRICT).
 */
export async function deleteVehicleListing(
  supabase: SupabaseClient<Database>,
  listingId: string,
  businessId: string,
): Promise<{ success: boolean }> {
  const { data: attachedUnits, error: countErr } = await supabase
    .from("vehicles")
    .select("id")
    .eq("listing_id", listingId)
    .eq("business_id", businessId);

  if (countErr) {
    throw new Error(`Failed to check attached units: ${countErr.message}`);
  }

  if (attachedUnits && attachedUnits.length > 0) {
    throw new Error(
      `Cannot delete listing with ${attachedUnits.length} attached physical inventory unit(s). Set listing status to ARCHIVED instead, or reassign/delete attached units first.`,
    );
  }

  const { error: deleteErr } = await supabase
    .from("vehicle_listings")
    .delete()
    .eq("id", listingId)
    .eq("business_id", businessId);

  if (deleteErr) {
    throw new Error(`Failed to delete vehicle listing: ${deleteErr.message}`);
  }

  return { success: true };
}

// ==============================================================================
// Legacy Phase 04 Operations (Retained & Integrated with Phase 06 Listings)
// ==============================================================================

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
      query = query.or(
        `make.ilike.%${rawQuery}%,model.ilike.%${rawQuery}%,vin.ilike.%${rawQuery}%,stock_number.ilike.%${rawQuery}%`,
      );
    }
  }

  query = query.order("created_at", { ascending: false });

  const { data: rows, error } = await query;
  if (error) {
    console.error("Failed to list inventory vehicles from Supabase", error);
    throw new Error(`Failed to list inventory vehicles: ${error.message}`);
  }

  const vehicleIds = (rows || []).map((r) => r.id);
  const cloudCapturesMap = new Map<string, Database["public"]["Tables"]["cloud_captures"]["Row"]>();

  if (vehicleIds.length > 0) {
    try {
      const { data: captures } = await supabase
        .from("cloud_captures")
        .select("*")
        .in("vehicle_id", vehicleIds)
        .eq("status", "READY");

      if (captures) {
        for (const c of captures) {
          cloudCapturesMap.set(c.vehicle_id, c);
        }
      }
    } catch {
      // Ignored
    }
  }

  return (rows || []).map((row) => {
    const mapped = mapInventoryRow(row);
    const cloud = cloudCapturesMap.get(row.id);
    if (cloud) {
      return {
        ...mapped,
        hasCapture: true,
        captureId: cloud.id,
        captureStatus: cloud.status,
        frameCount: cloud.frame_count,
        isSpinReady: true,
      };
    }
    return enrichInventoryVehicle(mapped);
  });
}

export async function getInventoryVehicle(
  supabase: SupabaseClient<Database>,
  vehicleId: string,
  businessId: string,
): Promise<EnrichedInventoryVehicle | null> {
  const { data: row, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", vehicleId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch inventory vehicle from Supabase", error);
    throw new Error(`Failed to fetch inventory vehicle: ${error.message}`);
  }

  if (!row) {
    return null;
  }

  const mapped = mapInventoryRow(row);

  try {
    const { data: cloud } = await supabase
      .from("cloud_captures")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .eq("status", "READY")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cloud) {
      return {
        ...mapped,
        hasCapture: true,
        captureId: cloud.id,
        captureStatus: cloud.status,
        frameCount: cloud.frame_count,
        isSpinReady: true,
      };
    }
  } catch {
    // Ignored
  }

  return enrichInventoryVehicle(mapped);
}

export async function createInventoryVehicle(
  supabase: SupabaseClient<Database>,
  input: CreateInventoryVehicleInput,
  businessId: string,
): Promise<EnrichedInventoryVehicle> {
  try {
    // Delegate through createVehicleListingWithUnit to guarantee listing creation
    const result = await createVehicleListingWithUnit(
      supabase,
      {
        listing: {
          make: input.make,
          model: input.model,
          year: input.year,
          trim: input.trim ?? null,
          bodyStyle: input.bodyStyle ?? null,
          transmission: input.transmission ?? null,
          fuelType: input.fuelType ?? null,
          price: input.price ?? null,
          status: input.status === "SOLD" ? "ARCHIVED" : (input.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"),
        },
        unit: {
          vin: input.vin ?? null,
          stockNumber: input.stockNumber ?? null,
          mileage: input.mileage ?? null,
          exteriorColor: input.exteriorColor ?? null,
          interiorColor: input.interiorColor ?? null,
          status: input.status ?? "DRAFT",
        },
      },
      businessId,
    );

    return enrichInventoryVehicle({
      id: result.unit.id,
      businessId,
      listingId: result.listing.id,
      make: result.listing.make,
      model: result.listing.model,
      year: result.listing.year,
      price: result.listing.price,
      mileage: result.unit.mileage,
      vin: result.unit.vin,
      stockNumber: result.unit.stockNumber,
      trim: result.listing.trim,
      exteriorColor: result.unit.exteriorColor,
      interiorColor: result.unit.interiorColor,
      bodyStyle: result.listing.bodyStyle,
      transmission: result.listing.transmission,
      fuelType: result.listing.fuelType,
      status: result.unit.status,
      createdAt: result.unit.createdAt,
      updatedAt: result.unit.updatedAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("vehicle_listings") && !msg.includes("PGRST205")) {
      throw err;
    }

    // Backward-compatibility fallback: if vehicle_listings table has not yet been migrated in Supabase,
    // operate directly on vehicles table
    const vehicleId = randomUUID();
    const { data: inserted, error: insertError } = await supabase
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

    if (insertError || !inserted) {
      throw new Error(`Failed to create inventory vehicle: ${insertError?.message ?? "Insert failed"}`);
    }

    try {
      createVehicleForBusiness(
        {
          name: `${input.year} ${input.make} ${input.model}`,
          make: input.make,
          model: input.model,
          year: input.year,
          stockIdentifier: input.stockNumber ?? null,
        },
        businessId,
        vehicleId,
      );
    } catch (sqliteError) {
      if (!isPlatformUnsupportedError(sqliteError)) {
        console.error("SQLite provisioning failed, compensating Supabase vehicle...", sqliteError);
        await supabase.from("vehicles").delete().eq("id", vehicleId);
        throw new Error(
          `Failed to provision processing plane for vehicle: ${sqliteError instanceof Error ? sqliteError.message : "SQLite error"}`,
        );
      }
    }

    return enrichInventoryVehicle(mapInventoryRow(inserted));
  }
}

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

  // Also update listing if listing_id exists
  if (updated.listing_id) {
    const listingUpdate: Partial<Database["public"]["Tables"]["vehicle_listings"]["Update"]> = {};
    if (input.make !== undefined) listingUpdate.make = input.make;
    if (input.model !== undefined) listingUpdate.model = input.model;
    if (input.year !== undefined) listingUpdate.year = input.year;
    if (input.price !== undefined) listingUpdate.price = input.price;
    if (input.trim !== undefined) listingUpdate.trim = input.trim;
    if (input.bodyStyle !== undefined) listingUpdate.body_style = input.bodyStyle;
    if (input.transmission !== undefined) listingUpdate.transmission = input.transmission;
    if (input.fuelType !== undefined) listingUpdate.fuel_type = input.fuelType;

    if (Object.keys(listingUpdate).length > 0) {
      await supabase
        .from("vehicle_listings")
        .update(listingUpdate)
        .eq("id", updated.listing_id)
        .eq("business_id", businessId);
    }
  }

  // Sync basic display metadata in SQLite if processing record exists
  try {
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
  } catch (sqliteErr) {
    if (!isPlatformUnsupportedError(sqliteErr)) {
      console.warn("Could not sync local SQLite metadata", sqliteErr);
    }
  }

  return enrichInventoryVehicle(mapInventoryRow(updated));
}

export async function updateInventoryStatus(
  supabase: SupabaseClient<Database>,
  vehicleId: string,
  status: VehicleLifecycleStatus,
  businessId: string,
): Promise<EnrichedInventoryVehicle> {
  return updateInventoryVehicle(supabase, vehicleId, { status }, businessId);
}

export async function deleteInventoryVehicle(
  supabase: SupabaseClient<Database>,
  vehicleId: string,
  businessId: string,
): Promise<{ success: boolean }> {
  let hasCaptures = false;
  try {
    hasCaptures = hasVehicleCaptures(vehicleId);
  } catch (err) {
    if (!isPlatformUnsupportedError(err)) {
      console.warn("Could not check local captures", err);
    }
  }

  if (hasCaptures) {
    throw new Error(
      "Cannot delete vehicle with attached captures or 360 media. Processing evidence is protected. Set status to SOLD instead.",
    );
  }

  let localSnapshot = null;
  let localDeleted = false;
  try {
    localSnapshot = getVehicleForBusiness(vehicleId, businessId);
    if (localSnapshot) {
      const res = deleteEmptyVehicleForBusiness(vehicleId, businessId);
      localDeleted = res.deleted;
    }
  } catch (err) {
    if (!isPlatformUnsupportedError(err)) {
      throw err;
    }
  }

  const { error: supabaseError } = await supabase
    .from("vehicles")
    .delete()
    .eq("id", vehicleId)
    .eq("business_id", businessId);

  if (supabaseError) {
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
