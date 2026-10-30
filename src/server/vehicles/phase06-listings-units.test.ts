import { randomUUID } from "node:crypto";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closeDatabase, getDatabase } from "../db/database";
import {
  createCapture,
  getLatestCaptureForVehicle,
  listCaptureFrames,
  replaceCaptureFrames,
} from "../captures/capture-repository";
import {
  createVehicleForBusiness,
  getVehicleForBusiness,
} from "./vehicle-repository";
import {
  addPhysicalUnitToListing,
  createVehicleListingWithUnit,
  deleteVehicleListing,
  getVehicleListingWithUnits,
  listVehicleListings,
  reassignPhysicalUnit,
  updatePhysicalUnit,
  updateVehicleListing,
} from "./inventory-repository";
import {
  validateCreateListingWithUnit,
  validateCreatePhysicalUnit,
  validateCreateVehicleListing,
  validateReassignUnit,
  validateUpdatePhysicalUnit,
  validateUpdateVehicleListing,
} from "./vehicle-validation";
import type { Database } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("Phase 06 — Vehicle Listings & Physical Inventory Units Acceptance Suite", () => {
  const testRunId = Math.random().toString(36).slice(2, 8);
  const businessAId = "11111111-1111-1111-1111-" + testRunId.padEnd(12, "0");
  const businessBId = "22222222-2222-2222-2222-" + testRunId.padEnd(12, "0");

  beforeAll(() => {
    process.env.SQLITE_DB_PATH = path.join(
      "data",
      "test",
      `test-phase06-${testRunId}.sqlite`,
    );
    process.env.STORAGE_ROOT = path.join(
      "storage",
      "test",
      `test-phase06-${testRunId}`,
    );
    closeDatabase();
  });

  afterAll(() => {
    closeDatabase();
  });

  // ==============================================================================
  // 1. Validation & Status Separation Tests
  // ==============================================================================
  describe("1. Validation & Status Separation", () => {
    it("accepts valid listing publication statuses: DRAFT, PUBLISHED, ARCHIVED", () => {
      const validStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
      for (const status of validStatuses) {
        const res = validateCreateVehicleListing({
          make: "Porsche",
          model: "911 GT3",
          year: 2024,
          status,
        });
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.value.status).toBe(status);
        }
      }
    });

    it("rejects invalid listing statuses such as SOLD (SOLD belongs to physical units)", () => {
      const res = validateCreateVehicleListing({
        make: "Porsche",
        model: "911 GT3",
        year: 2024,
        status: "SOLD",
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.errors.status).toBe(
          "Listing status must be DRAFT, PUBLISHED, or ARCHIVED.",
        );
      }
    });

    it("accepts valid physical unit availability statuses: DRAFT, PUBLISHED, SOLD", () => {
      const validStatuses = ["DRAFT", "PUBLISHED", "SOLD"] as const;
      for (const status of validStatuses) {
        const res = validateCreatePhysicalUnit({
          vin: "1HGCR2F83HA000000",
          status,
        });
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.value.status).toBe(status);
        }
      }
    });

    it("rejects invalid physical unit statuses such as ARCHIVED (ARCHIVED belongs to listings)", () => {
      const res = validateCreatePhysicalUnit({
        vin: "1HGCR2F83HA000000",
        status: "ARCHIVED",
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.errors.status).toBe(
          "Physical unit status must be DRAFT, PUBLISHED, or SOLD.",
        );
      }
    });

    it("validates atomic creation payload with nested { listing, unit } structure", () => {
      const res = validateCreateListingWithUnit({
        listing: {
          make: "BMW",
          model: "M3 Competition",
          year: 2024,
          price: 85000,
          status: "PUBLISHED",
        },
        unit: {
          vin: "WBS83AY0000000000",
          stockNumber: "STK-M3-01",
          mileage: 1200,
          status: "PUBLISHED",
        },
      });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.listing.make).toBe("BMW");
        expect(res.value.listing.price).toBe(85000);
        expect(res.value.unit.stockNumber).toBe("STK-M3-01");
        expect(res.value.unit.vin).toBe("WBS83AY0000000000");
      }
    });

    it("validates atomic creation payload with flat combined object structure", () => {
      const res = validateCreateListingWithUnit({
        make: "Toyota",
        model: "GR Supra",
        year: 2024,
        price: 58000,
        vin: "JT83AY00000000000",
        stockNumber: "STK-SUPRA-01",
        mileage: 500,
        status: "PUBLISHED",
      });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.listing.make).toBe("Toyota");
        expect(res.value.unit.stockNumber).toBe("STK-SUPRA-01");
      }
    });

    it("validates unit reassignment input requiring valid UUIDs", () => {
      const valid = validateReassignUnit({
        unitId: "10f35412-0000-0000-0000-000000000001",
        targetListingId: "10f35412-0000-0000-0000-000000000002",
      });
      expect(valid.ok).toBe(true);

      const invalid = validateReassignUnit({
        unitId: "not-a-uuid",
        targetListingId: "bad-target",
      });
      expect(invalid.ok).toBe(false);
    });
  });

  // ==============================================================================
  // 2. Physical Unit Availability Derivation Rule Tests
  // ==============================================================================
  describe("2. Physical Unit Availability Derivation Rule", () => {
    it("correctly derives availableUnitCount strictly from status = 'PUBLISHED' units", () => {
      const mockUnits = [
        { id: "u-1", status: "PUBLISHED" }, // available
        { id: "u-2", status: "PUBLISHED" }, // available
        { id: "u-3", status: "DRAFT" },     // in prep (not available)
        { id: "u-4", status: "SOLD" },      // sold (not available)
      ];

      const availableCount = mockUnits.filter((u) => u.status === "PUBLISHED").length;
      const totalCount = mockUnits.length;

      expect(availableCount).toBe(2);
      expect(totalCount).toBe(4);
    });

    it("derives zero available units when all units are sold or in draft", () => {
      const mockUnits = [
        { id: "u-1", status: "SOLD" },
        { id: "u-2", status: "SOLD" },
        { id: "u-3", status: "DRAFT" },
      ];

      const availableCount = mockUnits.filter((u) => u.status === "PUBLISHED").length;
      expect(availableCount).toBe(0);
      expect(mockUnits.length).toBe(3);
    });

    it("derives zero available units for empty listings with no attached units", () => {
      const mockUnits: Array<{ id: string; status: string }> = [];
      const availableCount = mockUnits.filter((u) => u.status === "PUBLISHED").length;
      expect(availableCount).toBe(0);
      expect(mockUnits.length).toBe(0);
    });
  });

  // ==============================================================================
  // 3. Repository Operations & Multi-Tenant Isolation (In-Memory Supabase Mock)
  // ==============================================================================
  describe("3. Repository Operations & Tenant Isolation", () => {
    const listingsStore: any[] = [];
    const vehiclesStore: any[] = [];

    function createMockSupabase(): SupabaseClient<Database> {
      return {
        from: (tableName: string) => {
          const store = tableName === "vehicle_listings" ? listingsStore : vehiclesStore;
          const filters: Array<(row: any) => boolean> = [];
          let selectClause: string | undefined = undefined;

          function getFilteredRows() {
            let rows = store.filter((r) => filters.every((f) => f(r)));
            if (tableName === "vehicle_listings") {
              rows = rows.map((l) => ({
                ...l,
                units: vehiclesStore.filter(
                  (v) => v.listing_id === l.id && v.business_id === l.business_id,
                ),
              }));
            }
            return rows;
          }

          const builder: any = {
            select: (cols?: string) => {
              selectClause = cols;
              return builder;
            },
            eq: (col: string, val: any) => {
              filters.push((row: any) => row[col] === val);
              return builder;
            },
            in: (col: string, vals: any[]) => {
              filters.push((row: any) => vals.includes(row[col]));
              return builder;
            },
            order: () => builder,
            limit: () => builder,
            single: async () => {
              const rows = getFilteredRows();
              if (rows.length === 0) {
                return { data: null, error: { message: "Row not found" } };
              }
              return { data: rows[0], error: null };
            },
            maybeSingle: async () => {
              const rows = getFilteredRows();
              return { data: rows[0] ?? null, error: null };
            },
            insert: (payload: any) => {
              const rowsToInsert = Array.isArray(payload) ? payload : [payload];
              const inserted: any[] = [];
              for (const item of rowsToInsert) {
                const newRow = {
                  ...item,
                  id: item.id || randomUUID(),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };
                store.push(newRow);
                inserted.push(newRow);
              }
              const returnVal = Array.isArray(payload) ? inserted : inserted[0];
              const insertBuilder: any = {
                select: () => insertBuilder,
                single: async () => ({ data: returnVal, error: null }),
                maybeSingle: async () => ({ data: returnVal, error: null }),
                then: (resolve: any, _reject?: any) => resolve({ data: returnVal, error: null }),
              };
              return insertBuilder;
            },
            update: (payload: any) => {
              const updateBuilder: any = {
                eq: (col: string, val: any) => {
                  filters.push((row: any) => row[col] === val);
                  return updateBuilder;
                },
                select: () => updateBuilder,
                single: async () => {
                  const rows = getFilteredRows();
                  if (rows.length === 0) {
                    return { data: null, error: { message: "Not found" } };
                  }
                  Object.assign(rows[0], payload, { updated_at: new Date().toISOString() });
                  return { data: rows[0], error: null };
                },
                maybeSingle: async () => {
                  const rows = getFilteredRows();
                  if (rows.length === 0) {
                    return { data: null, error: null };
                  }
                  Object.assign(rows[0], payload, { updated_at: new Date().toISOString() });
                  return { data: rows[0], error: null };
                },
                then: (resolve: any, _reject?: any) => {
                  const rows = getFilteredRows();
                  for (const r of rows) {
                    Object.assign(r, payload, { updated_at: new Date().toISOString() });
                  }
                  resolve({ data: rows, error: null });
                },
              };
              return updateBuilder;
            },
            delete: () => {
              const deleteBuilder: any = {
                eq: (col: string, val: any) => {
                  filters.push((row: any) => row[col] === val);
                  return deleteBuilder;
                },
                then: (resolve: any, _reject?: any) => {
                  const rowsToDelete = getFilteredRows();
                  for (const r of rowsToDelete) {
                    const idx = store.indexOf(r);
                    if (idx !== -1) store.splice(idx, 1);
                  }
                  resolve({ data: null, error: null });
                },
              };
              return deleteBuilder;
            },
            then: (resolve: any, _reject?: any) => {
              resolve({ data: getFilteredRows(), error: null });
            },
          };
          return builder;
        },
        rpc: async (_fn: string, _args: any) => {
          return { data: null, error: { message: "Could not find the function in schema cache" } };
        },
      } as unknown as SupabaseClient<Database>;
    }

    let mockClient: SupabaseClient<Database>;
    let listingAId: string;
    let unitA1Id: string;
    let unitA2Id: string;

    beforeAll(() => {
      mockClient = createMockSupabase();
    });

    it("creates listing and unit atomically via createVehicleListingWithUnit", async () => {
      const result = await createVehicleListingWithUnit(
        mockClient,
        {
          listing: {
            make: "Mercedes-AMG",
            model: "GT Coupe",
            year: 2024,
            price: 175000,
            status: "PUBLISHED",
          },
          unit: {
            vin: "WDD83AY0000000001",
            stockNumber: "STK-AMG-01",
            mileage: 250,
            exteriorColor: "Manufaktur Selenite Grey",
            status: "PUBLISHED",
          },
        },
        businessAId,
      );

      expect(result.listing.id).toBeDefined();
      expect(result.unit.id).toBeDefined();
      expect(result.unit.listingId).toBe(result.listing.id);
      expect(result.unit.businessId).toBe(businessAId);
      expect(result.listing.make).toBe("Mercedes-AMG");
      expect(result.unit.stockNumber).toBe("STK-AMG-01");

      listingAId = result.listing.id;
      unitA1Id = result.unit.id;

      // Verify processing plane (SQLite) vehicle was also provisioned
      const localVehicle = getVehicleForBusiness(unitA1Id, businessAId);
      expect(localVehicle).not.toBeNull();
      expect(localVehicle?.stockIdentifier).toBe("STK-AMG-01");
    });

    it("adds a second physical unit to the same listing", async () => {
      const addedUnit = await addPhysicalUnitToListing(
        mockClient,
        listingAId,
        {
          vin: "WDD83AY0000000002",
          stockNumber: "STK-AMG-02",
          mileage: 1800,
          exteriorColor: "Obsidian Black",
          status: "PUBLISHED",
        },
        businessAId,
      );

      expect(addedUnit.id).toBeDefined();
      expect(addedUnit.listingId).toBe(listingAId);
      expect(addedUnit.businessId).toBe(businessAId);
      expect(addedUnit.stockNumber).toBe("STK-AMG-02");

      unitA2Id = addedUnit.id;
    });

    it("lists vehicle listings with derived available and total unit counts", async () => {
      const listings = await listVehicleListings(mockClient, businessAId);
      expect(listings.length).toBeGreaterThanOrEqual(1);

      const target = listings.find((l) => l.id === listingAId);
      expect(target).toBeDefined();
      expect(target?.totalUnitCount).toBe(2);
      expect(target?.availableUnitCount).toBe(2);
    });

    it("updates physical unit status to SOLD and verifies available count updates", async () => {
      const updatedUnit = await updatePhysicalUnit(
        mockClient,
        unitA1Id,
        { status: "SOLD" },
        businessAId,
      );
      expect(updatedUnit.status).toBe("SOLD");

      const listings = await listVehicleListings(mockClient, businessAId);
      const target = listings.find((l) => l.id === listingAId);
      expect(target?.totalUnitCount).toBe(2);
      expect(target?.availableUnitCount).toBe(1); // 1 available, 1 sold
    });

    it("updates listing marketing specifications and mirrors them to attached units", async () => {
      const updatedListing = await updateVehicleListing(
        mockClient,
        listingAId,
        { price: 169000, trim: "Black Series" },
        businessAId,
      );
      expect(updatedListing.price).toBe(169000);
      expect(updatedListing.trim).toBe("Black Series");

      // Verify mirrored columns on attached unit
      const listingWithUnits = await getVehicleListingWithUnits(
        mockClient,
        listingAId,
        businessAId,
      );
      expect(listingWithUnits?.units.length).toBe(2);
      for (const u of listingWithUnits!.units) {
        expect(u.trim).toBe("Black Series");
      }
    });

    it("blocks deletion of listing with attached physical units (safe non-destructive constraint)", async () => {
      await expect(
        deleteVehicleListing(mockClient, listingAId, businessAId),
      ).rejects.toThrow(/Cannot delete listing with \d+ attached physical inventory unit/);
    });

    it("reassigns physical unit to another listing within the SAME dealership", async () => {
      // 1. Create a second listing in Business A
      const secondListing = await createVehicleListingWithUnit(
        mockClient,
        {
          listing: {
            make: "Mercedes-AMG",
            model: "GT 4-Door",
            year: 2024,
            price: 140000,
            status: "PUBLISHED",
          },
          unit: {
            vin: "WDD83AY0000000099",
            stockNumber: "STK-GT4-01",
            status: "PUBLISHED",
          },
        },
        businessAId,
      );

      // 2. Reassign unitA2 (from listingAId) to secondListing.listing.id
      const reassignResult = await reassignPhysicalUnit(
        mockClient,
        unitA2Id,
        secondListing.listing.id,
        businessAId,
      );

      expect(reassignResult.success).toBe(true);
      expect(reassignResult.unit.listingId).toBe(secondListing.listing.id);
      expect(reassignResult.unit.id).toBe(unitA2Id); // ID PRESERVED

      // Verify listingA now has only 1 unit remaining
      const originalListing = await getVehicleListingWithUnits(
        mockClient,
        listingAId,
        businessAId,
      );
      expect(originalListing?.units.length).toBe(1);

      // Verify secondListing now has 2 units
      const targetListing = await getVehicleListingWithUnits(
        mockClient,
        secondListing.listing.id,
        businessAId,
      );
      expect(targetListing?.units.length).toBe(2);
    });

    it("strictly REJECTS cross-tenant reassignment across dealerships", async () => {
      // Create listing in Business B
      const businessBListing = await createVehicleListingWithUnit(
        mockClient,
        {
          listing: {
            make: "Ford",
            model: "Mustang Dark Horse",
            year: 2024,
            price: 65000,
            status: "PUBLISHED",
          },
          unit: {
            vin: "1FA6P8CF000000001",
            stockNumber: "STK-MUSTANG-01",
            status: "PUBLISHED",
          },
        },
        businessBId,
      );

      // Attempt to reassign Business A's unit to Business B's listing using Business A's auth
      await expect(
        reassignPhysicalUnit(
          mockClient,
          unitA1Id,
          businessBListing.listing.id,
          businessAId,
        ),
      ).rejects.toThrow(/Target listing not found in authorized dealership/);

      // Attempt using Business B's auth to steal Business A's unit
      await expect(
        reassignPhysicalUnit(
          mockClient,
          unitA1Id,
          businessBListing.listing.id,
          businessBId,
        ),
      ).rejects.toThrow(/Physical inventory unit not found in authorized dealership/);
    });
  });

  // ==============================================================================
  // 4. Local SQLite Engine & 360 Spin Viewer Linkage Preservation
  // ==============================================================================
  describe("4. Local SQLite Engine & 360 Spin Viewer Linkage", () => {
    it("verifies SQLite vehicles table has NO speculative listing_id column (ponytail discipline)", () => {
      const db = getDatabase();
      const columns = db.prepare("PRAGMA table_info(vehicles)").all() as Array<{
        name: string;
        type: string;
      }>;
      const columnNames = columns.map((c) => c.name);

      expect(columnNames).toContain("id");
      expect(columnNames).toContain("business_id");
      expect(columnNames).toContain("name");
      expect(columnNames).toContain("make");
      expect(columnNames).toContain("model");
      expect(columnNames).toContain("year");
      expect(columnNames).toContain("stock_identifier");

      // Invariant: SQLite schema remains purely physical unit capture engine
      expect(columnNames).not.toContain("listing_id");
    });

    it("preserves capture, processing, and frame extraction by physical unit UUID", () => {
      const unitUUID = randomUUID();

      // Provision physical unit in SQLite plane
      createVehicleForBusiness(
        {
          name: "2024 Corvette Z06",
          make: "Chevrolet",
          model: "Corvette Z06",
          year: 2024,
          stockIdentifier: "STK-Z06-99",
        },
        businessAId,
        unitUUID,
      );

      // Create capture tied to unitUUID
      const captureId = randomUUID();
      createCapture({
        id: captureId,
        vehicleId: unitUUID,
        sourceVideoPath: "source.mov",
        sourceFilename: "source.mov",
        sourceMimeType: "video/quicktime",
        targetFrameCount: 36,
      });

      // Add frames using replaceCaptureFrames
      replaceCaptureFrames({
        captureId,
        frameCount: 4,
        width: 1920,
        height: 1080,
        paths: [
          { path: "frame_000.webp", thumbnailPath: "thumb_000.webp" },
          { path: "frame_001.webp", thumbnailPath: "thumb_001.webp" },
          { path: "frame_002.webp", thumbnailPath: "thumb_002.webp" },
          { path: "frame_003.webp", thumbnailPath: "thumb_003.webp" },
        ],
      });

      // Update capture status to READY
      const db = getDatabase();
      db.prepare("UPDATE captures SET status = 'READY' WHERE id = ?").run(captureId);

      // Verify retrieval by unitUUID
      const latestCapture = getLatestCaptureForVehicle(unitUUID);
      expect(latestCapture).not.toBeNull();
      expect(latestCapture?.id).toBe(captureId);
      expect(latestCapture?.status).toBe("READY");

      const frames = listCaptureFrames(captureId);
      expect(frames.length).toBe(4);
    });
  });
});
