import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Database } from "@/types/database.types";
import {
  createCapture,
  getCapture,
  listCaptureFrames,
  replaceCaptureFrames,
} from "../captures/capture-repository";
import { DatabaseSync } from "node:sqlite";
import { closeDatabase, getDatabase } from "../db/database";
import {
  createInventoryVehicle,
  deleteInventoryVehicle,
  getInventoryVehicle,
  listInventoryVehicles,
  updateInventoryStatus,
  updateInventoryVehicle,
} from "./inventory-repository";
import {
  createVehicleForBusiness,
  deleteEmptyVehicleForBusiness,
  getVehicle,
  getVehicleForBusiness,
  hasVehicleCaptures,
  listVehicles,
  listVehiclesForBusiness,
} from "./vehicle-repository";

function getEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error(".env.local not found");
  }
  const content = fs.readFileSync(envPath, "utf8");
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx !== -1) {
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }
  return env;
}

const env = getEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const adminClient = createClient<Database>(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

describe("Phase 04 — Vehicle Inventory & Hybrid Linkage Acceptance Suite", () => {
  const testRunId = Math.random().toString(36).slice(2, 8);
  const userAEmail = `inv.user.a.${testRunId}@acceptance-v360.com`;
  const userBEmail = `inv.user.b.${testRunId}@acceptance-v360.com`;
  const memberAEmail = `inv.member.a.${testRunId}@acceptance-v360.com`;
  const dualUserEmail = `inv.dual.user.${testRunId}@acceptance-v360.com`;
  const testPassword = "Password123!Secure";

  let userAId: string;
  let userBId: string;
  let memberAId: string;
  let dualUserId: string;

  let clientA: SupabaseClient<Database>;
  let clientB: SupabaseClient<Database>;
  let clientMemberA: SupabaseClient<Database>;
  let clientDualUser: SupabaseClient<Database>;

  let businessAId: string;
  let businessBId: string;

  // Track created vehicle IDs for cleanup
  const createdVehicleIds: string[] = [];

  beforeAll(async () => {
    // Isolate SQLite database and storage for test execution
    process.env.SQLITE_DB_PATH = path.join("data", "test", `test-inv-${testRunId}.sqlite`);
    process.env.STORAGE_ROOT = path.join("storage", "test", `test-inv-${testRunId}`);
    closeDatabase();

    // 1. Create User A
    const { data: uA, error: errA } = await adminClient.auth.admin.createUser({
      email: userAEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: "Alice Inventory Admin" },
    });
    if (errA) throw errA;
    userAId = uA.user.id;

    // 2. Create User B
    const { data: uB, error: errB } = await adminClient.auth.admin.createUser({
      email: userBEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: "Bob Inventory Admin" },
    });
    if (errB) throw errB;
    userBId = uB.user.id;

    // 3. Create Member A (regular member in Dealership A)
    const { data: uMemA, error: errMem } = await adminClient.auth.admin.createUser({
      email: memberAEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: "Charlie Dealer Member" },
    });
    if (errMem) throw errMem;
    memberAId = uMemA.user.id;

    // 4. Create Dual-Membership User (belongs to Business A and Business B)
    const { data: uDual, error: errDual } = await adminClient.auth.admin.createUser({
      email: dualUserEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: "Dana Dual Dealer" },
    });
    if (errDual) throw errDual;
    dualUserId = uDual.user.id;

    // Initialize authenticated clients
    clientA = createClient<Database>(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await clientA.auth.signInWithPassword({ email: userAEmail, password: testPassword });

    clientB = createClient<Database>(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await clientB.auth.signInWithPassword({ email: userBEmail, password: testPassword });

    clientMemberA = createClient<Database>(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await clientMemberA.auth.signInWithPassword({ email: memberAEmail, password: testPassword });

    clientDualUser = createClient<Database>(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await clientDualUser.auth.signInWithPassword({ email: dualUserEmail, password: testPassword });

    // 5. Create Dealership A via RPC
    const { data: bizA, error: bizAErr } = await clientA.rpc("create_dealership", {
      dealership_name: `Inventory Dealer A ${testRunId}`,
      dealership_slug: `inv-dealer-a-${testRunId}`,
    });
    if (bizAErr) throw bizAErr;
    businessAId = bizA.business_id;

    // 6. Create Dealership B via RPC
    const { data: bizB, error: bizBErr } = await clientB.rpc("create_dealership", {
      dealership_name: `Inventory Dealer B ${testRunId}`,
      dealership_slug: `inv-dealer-b-${testRunId}`,
    });
    if (bizBErr) throw bizBErr;
    businessBId = bizB.business_id;

    // 7. Add Member A to Business A (DEALER_MEMBER)
    await clientA.from("business_memberships").insert({
      business_id: businessAId,
      user_id: memberAId,
      role: "DEALER_MEMBER",
      status: "ACTIVE",
    });

    // 8. Add Dual User to Business A and Business B
    await clientA.from("business_memberships").insert({
      business_id: businessAId,
      user_id: dualUserId,
      role: "DEALER_MEMBER",
      status: "ACTIVE",
    });
    await clientB.from("business_memberships").insert({
      business_id: businessBId,
      user_id: dualUserId,
      role: "DEALER_MEMBER",
      status: "ACTIVE",
    });
  });

  afterAll(async () => {
    // Cleanup created test vehicles from Supabase
    for (const vid of createdVehicleIds) {
      try {
        await adminClient.from("vehicles").delete().eq("id", vid);
      } catch {}
    }

    // Cleanup test users and cascade-delete businesses
    if (userAId) await adminClient.auth.admin.deleteUser(userAId);
    if (userBId) await adminClient.auth.admin.deleteUser(userBId);
    if (memberAId) await adminClient.auth.admin.deleteUser(memberAId);
    if (dualUserId) await adminClient.auth.admin.deleteUser(dualUserId);
    if (businessAId) await adminClient.from("businesses").delete().eq("id", businessAId);
    if (businessBId) await adminClient.from("businesses").delete().eq("id", businessBId);

    // Close and remove isolated test SQLite DB and storage
    closeDatabase();
    const testDbFile = path.resolve(process.cwd(), "data", "test", `test-inv-${testRunId}.sqlite`);
    try {
      if (fs.existsSync(testDbFile)) fs.unlinkSync(testDbFile);
      if (fs.existsSync(`${testDbFile}-wal`)) fs.unlinkSync(`${testDbFile}-wal`);
      if (fs.existsSync(`${testDbFile}-shm`)) fs.unlinkSync(`${testDbFile}-shm`);
    } catch {}
    const testStorageDir = path.resolve(process.cwd(), "storage", "test", `test-inv-${testRunId}`);
    try {
      if (fs.existsSync(testStorageDir)) {
        fs.rmSync(testStorageDir, { recursive: true, force: true });
      }
    } catch {}
    delete process.env.SQLITE_DB_PATH;
    delete process.env.STORAGE_ROOT;
  });

  describe("Test A — Vehicle Creation & Tenant Ownership Authority", () => {
    it("creates a canonical inventory vehicle in Supabase and provisions SQLite with matching UUID", async () => {
      const vehicle = await createInventoryVehicle(
        clientA,
        {
          make: "Porsche",
          model: "911 GT3",
          year: 2024,
          price: 225000,
          mileage: 1200,
          vin: `WP0AC2A98RS${testRunId.toUpperCase()}`.slice(0, 17),
          stockNumber: `STK-A-${testRunId}`,
          status: "DRAFT",
        },
        businessAId,
      );

      createdVehicleIds.push(vehicle.id);

      expect(vehicle.id).toBeDefined();
      expect(vehicle.businessId).toBe(businessAId);
      expect(vehicle.make).toBe("Porsche");
      expect(vehicle.model).toBe("911 GT3");
      expect(vehicle.year).toBe(2024);
      expect(vehicle.price).toBe(225000);
      expect(vehicle.status).toBe("DRAFT");

      // Verify matching SQLite processing stub exists with identical UUID and businessId
      const localVehicle = getVehicleForBusiness(vehicle.id, businessAId);
      expect(localVehicle).not.toBeNull();
      expect(localVehicle?.id).toBe(vehicle.id);
      expect(localVehicle?.businessId).toBe(businessAId);
      expect(localVehicle?.make).toBe("Porsche");
    });

    it("rejects client attempts to create a vehicle for another dealership (RLS rejection)", async () => {
      // User A attempts to insert directly with business_id = businessBId
      const { data, error } = await clientA
        .from("vehicles")
        .insert({
          business_id: businessBId,
          make: "Spoofed",
          model: "Vehicle",
          year: 2024,
          status: "DRAFT",
        })
        .select();

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });
  });

  describe("Test B — Inventory Read Isolation (RLS)", () => {
    let vehicleAId: string;
    let vehicleBId: string;

    beforeAll(async () => {
      const vA = await createInventoryVehicle(
        clientA,
        { make: "BMW", model: "M4", year: 2024, stockNumber: `BMW-${testRunId}` },
        businessAId,
      );
      vehicleAId = vA.id;
      createdVehicleIds.push(vehicleAId);

      const vB = await createInventoryVehicle(
        clientB,
        { make: "Audi", model: "RS6", year: 2024, stockNumber: `AUDI-${testRunId}` },
        businessBId,
      );
      vehicleBId = vB.id;
      createdVehicleIds.push(vehicleBId);
    });

    it("prevents User A from reading Vehicle B in Supabase", async () => {
      const { data, error } = await clientA
        .from("vehicles")
        .select("*")
        .eq("id", vehicleBId);

      expect(error).toBeNull();
      expect(data).toHaveLength(0); // RLS filtered
    });

    it("prevents User B from reading Vehicle A in Supabase", async () => {
      const { data, error } = await clientB
        .from("vehicles")
        .select("*")
        .eq("id", vehicleAId);

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("isolates repository listing by businessId", async () => {
      const listA = await listInventoryVehicles(clientA, businessAId);
      const idsA = listA.map((v) => v.id);
      expect(idsA).toContain(vehicleAId);
      expect(idsA).not.toContain(vehicleBId);

      const listB = await listInventoryVehicles(clientB, businessBId);
      const idsB = listB.map((v) => v.id);
      expect(idsB).toContain(vehicleBId);
      expect(idsB).not.toContain(vehicleAId);
    });
  });

  describe("Test C — Cross-Tenant Write Isolation (RLS)", () => {
    let vehicleAId: string;
    let vehicleBId: string;

    beforeAll(async () => {
      const vA = await createInventoryVehicle(
        clientA,
        { make: "Mercedes", model: "AMG GT", year: 2024 },
        businessAId,
      );
      vehicleAId = vA.id;
      createdVehicleIds.push(vehicleAId);

      const vB = await createInventoryVehicle(
        clientB,
        { make: "Lexus", model: "LC500", year: 2024 },
        businessBId,
      );
      vehicleBId = vB.id;
      createdVehicleIds.push(vehicleBId);
    });

    it("prevents User A from updating Vehicle B metadata", async () => {
      const { data } = await clientA
        .from("vehicles")
        .update({ make: "Hacked Make" })
        .eq("id", vehicleBId)
        .select();

      expect(data).toHaveLength(0);

      // Verify Vehicle B untouched
      const vB = await getInventoryVehicle(clientB, vehicleBId, businessBId);
      expect(vB?.make).toBe("Lexus");
    });

    it("prevents User A from changing Vehicle B lifecycle status", async () => {
      const { data } = await clientA
        .from("vehicles")
        .update({ status: "SOLD" })
        .eq("id", vehicleBId)
        .select();

      expect(data).toHaveLength(0);

      const vB = await getInventoryVehicle(clientB, vehicleBId, businessBId);
      expect(vB?.status).toBe("DRAFT");
    });

    it("prevents User B from deleting Vehicle A in Supabase", async () => {
      const { data } = await clientB
        .from("vehicles")
        .delete()
        .eq("id", vehicleAId)
        .select();

      expect(data).toHaveLength(0);

      const vA = await getInventoryVehicle(clientA, vehicleAId, businessAId);
      expect(vA?.id).toBe(vehicleAId);
    });
  });

  describe("Test D — Vehicle Lifecycle Management", () => {
    it("transitions through DRAFT -> PUBLISHED -> SOLD lifecycle", async () => {
      const vehicle = await createInventoryVehicle(
        clientA,
        {
          make: "Ford",
          model: "Mustang Dark Horse",
          year: 2024,
          status: "DRAFT",
        },
        businessAId,
      );
      createdVehicleIds.push(vehicle.id);
      expect(vehicle.status).toBe("DRAFT");

      // Transition to PUBLISHED
      const published = await updateInventoryStatus(
        clientA,
        vehicle.id,
        "PUBLISHED",
        businessAId,
      );
      expect(published.status).toBe("PUBLISHED");

      // Transition to SOLD
      const sold = await updateInventoryStatus(
        clientA,
        vehicle.id,
        "SOLD",
        businessAId,
      );
      expect(sold.status).toBe("SOLD");
    });

    it("rejects invalid status values via DB check constraint", async () => {
      const { error } = await clientA
        .from("vehicles")
        .insert({
          business_id: businessAId,
          make: "Invalid",
          model: "Status",
          year: 2024,
          status: "ARCHIVED" as unknown as "DRAFT",
        });

      expect(error).not.toBeNull();
    });
  });

  describe("Test E — Search & Filtering Isolation", () => {
    let car1Id: string;
    let car2Id: string;

    beforeAll(async () => {
      const c1 = await createInventoryVehicle(
        clientA,
        {
          make: "Toyota",
          model: "Supra Turbo",
          year: 2024,
          vin: `SUPRA${testRunId}`.slice(0, 17),
          stockNumber: `STK-SUPRA-${testRunId}`,
          status: "PUBLISHED",
        },
        businessAId,
      );
      car1Id = c1.id;
      createdVehicleIds.push(car1Id);

      const c2 = await createInventoryVehicle(
        clientA,
        {
          make: "Honda",
          model: "Civic Type R",
          year: 2024,
          vin: `CIVIC${testRunId}`.slice(0, 17),
          stockNumber: `STK-CIVIC-${testRunId}`,
          status: "DRAFT",
        },
        businessAId,
      );
      car2Id = c2.id;
      createdVehicleIds.push(car2Id);
    });

    it("filters vehicles by search query within caller dealership", async () => {
      const searchSupra = await listInventoryVehicles(clientA, businessAId, {
        query: "Supra",
      });
      expect(searchSupra.some((v) => v.id === car1Id)).toBe(true);
      expect(searchSupra.some((v) => v.id === car2Id)).toBe(false);

      const searchCivic = await listInventoryVehicles(clientA, businessAId, {
        query: "Civic",
      });
      expect(searchCivic.some((v) => v.id === car2Id)).toBe(true);
      expect(searchCivic.some((v) => v.id === car1Id)).toBe(false);
    });

    it("filters vehicles by status within caller dealership", async () => {
      const drafts = await listInventoryVehicles(clientA, businessAId, {
        status: "DRAFT",
      });
      expect(drafts.some((v) => v.id === car2Id)).toBe(true);
      expect(drafts.some((v) => v.id === car1Id)).toBe(false);

      const published = await listInventoryVehicles(clientA, businessAId, {
        status: "PUBLISHED",
      });
      expect(published.some((v) => v.id === car1Id)).toBe(true);
      expect(published.some((v) => v.id === car2Id)).toBe(false);
    });

    it("prevents manipulated search queries from revealing other dealerships", async () => {
      const crossSearch = await listInventoryVehicles(clientB, businessBId, {
        query: "Supra",
      });
      expect(crossSearch.some((v) => v.id === car1Id)).toBe(false);
    });
  });

  describe("Test F — Inventory ↔ Processing Identity & Immutability", () => {
    it("guarantees identical UUID between Supabase inventory and SQLite processing record", async () => {
      const vehicle = await createInventoryVehicle(
        clientA,
        { make: "Chevrolet", model: "Corvette Z06", year: 2024 },
        businessAId,
      );
      createdVehicleIds.push(vehicle.id);

      const localRecord = getVehicle(vehicle.id);
      expect(localRecord).not.toBeNull();
      expect(localRecord?.id).toBe(vehicle.id);
      expect(localRecord?.businessId).toBe(businessAId);
    });

    it("prevents changing vehicle id or transferring business_id even for dual-membership user (Immutable Invariant)", async () => {
      const vehicle = await createInventoryVehicle(
        clientA,
        { make: "Tesla", model: "Model S Plaid", year: 2024 },
        businessAId,
      );
      createdVehicleIds.push(vehicle.id);

      // Dual User belongs to both Business A and Business B
      // Attempting to change business_id from A to B must trigger DB exception / RLS failure
      const { error } = await clientDualUser
        .from("vehicles")
        .update({ business_id: businessBId })
        .eq("id", vehicle.id);

      // Trigger or RLS must reject mutation
      expect(error).not.toBeNull();

      // Verify business ownership was NOT altered
      const verify = await getInventoryVehicle(clientA, vehicle.id, businessAId);
      expect(verify?.businessId).toBe(businessAId);
    });
  });

  describe("Test G — Capture Ownership & Cross-Tenant Protection", () => {
    it("associates captures deterministically to vehicle processing identity", () => {
      const vehicle = createVehicleForBusiness(
        {
          name: "Test Spin Car",
          make: "Mazda",
          model: "MX-5",
          year: 2024,
          stockIdentifier: "MIATA-01",
        },
        businessAId,
      );
      createdVehicleIds.push(vehicle.id);

      const captureId = `cap-${Math.random().toString(36).slice(2, 8)}`;
      createCapture({
        id: captureId,
        vehicleId: vehicle.id,
        sourceVideoPath: `vehicles/${vehicle.id}/captures/${captureId}/source/video.mp4`,
        sourceFilename: "video.mp4",
        sourceMimeType: "video/mp4",
        targetFrameCount: 48,
      });

      const capture = getCapture(captureId);
      expect(capture?.vehicleId).toBe(vehicle.id);
      expect(hasVehicleCaptures(vehicle.id)).toBe(true);
    });

    it("prevents cross-business vehicle retrieval in local repository", () => {
      const vehicle = createVehicleForBusiness(
        {
          name: "Local Tenant B Car",
          make: "Subaru",
          model: "BRZ",
          year: 2024,
          stockIdentifier: null,
        },
        businessBId,
      );
      createdVehicleIds.push(vehicle.id);

      const crossCheck = getVehicleForBusiness(vehicle.id, businessAId);
      expect(crossCheck).toBeNull();

      const validCheck = getVehicleForBusiness(vehicle.id, businessBId);
      expect(validCheck?.id).toBe(vehicle.id);
    });
  });

  describe("Test H — Safe Non-Destructive Delete & Partial Failure Compensation", () => {
    it("Case A: allows deletion of a vehicle with NO captures when both planes succeed", async () => {
      const vehicle = await createInventoryVehicle(
        clientA,
        { make: "Nissan", model: "Z Performance", year: 2024 },
        businessAId,
      );

      const delResult = await deleteInventoryVehicle(clientA, vehicle.id, businessAId);
      expect(delResult.success).toBe(true);

      // Verify deleted in Supabase
      const checkSupabase = await getInventoryVehicle(clientA, vehicle.id, businessAId);
      expect(checkSupabase).toBeNull();

      // Verify deleted in SQLite
      const checkSqlite = getVehicle(vehicle.id);
      expect(checkSqlite).toBeNull();
    });

    it("Case B: prevents Supabase deletion if local SQLite delete fails", async () => {
      const vehicle = await createInventoryVehicle(
        clientA,
        { make: "Subaru", model: "WRX TR", year: 2024 },
        businessAId,
      );
      createdVehicleIds.push(vehicle.id);

      // Spy on SQLite prepare to simulate a local database failure on DELETE FROM vehicles
      const db = getDatabase();
      const originalPrepare = db.prepare.bind(db);
      const prepareSpy = vi.spyOn(db, "prepare").mockImplementation((sql: string) => {
        if (sql.includes("DELETE FROM vehicles")) {
          throw new Error("Simulated SQLite disk I/O error during deletion");
        }
        return originalPrepare(sql);
      });

      try {
        await expect(
          deleteInventoryVehicle(clientA, vehicle.id, businessAId),
        ).rejects.toThrow("Simulated SQLite disk I/O error during deletion");
      } finally {
        prepareSpy.mockRestore();
      }

      // Supabase record in Business A MUST remain intact
      const verifySupabase = await getInventoryVehicle(clientA, vehicle.id, businessAId);
      expect(verifySupabase?.id).toBe(vehicle.id);

      // SQLite record MUST remain intact
      const verifySqlite = getVehicleForBusiness(vehicle.id, businessAId);
      expect(verifySqlite?.id).toBe(vehicle.id);
    });

    it("Case C: compensates and restores local SQLite vehicle if Supabase delete fails", async () => {
      const vehicle = await createInventoryVehicle(
        clientA,
        { make: "Alfa Romeo", model: "Giulia Quadrifoglio", year: 2024 },
        businessAId,
      );
      createdVehicleIds.push(vehicle.id);

      // Verify initial state: present in both Supabase and SQLite with identical UUID
      expect(getVehicleForBusiness(vehicle.id, businessAId)).not.toBeNull();
      const initialSupabase = await getInventoryVehicle(clientA, vehicle.id, businessAId);
      expect(initialSupabase?.id).toBe(vehicle.id);

      // Create a mocked Supabase client whose delete operation rejects/fails
      const failingSupabase = {
        ...clientA,
        from: (table: string) => {
          const builder = clientA.from(table as never);
          if (table === "vehicles") {
            return {
              ...builder,
              delete: () => ({
                eq: () => ({
                  eq: async () => ({
                    error: { message: "Simulated network failure on cloud delete" },
                  }),
                }),
              }),
            };
          }
          return builder;
        },
      } as unknown as SupabaseClient<Database>;

      // Attempt deletion with failing Supabase client
      await expect(
        deleteInventoryVehicle(failingSupabase, vehicle.id, businessAId),
      ).rejects.toThrow("Simulated network failure on cloud delete");

      // Verify Compensation: The local SQLite vehicle MUST be restored with the exact same UUID and metadata!
      const restoredSqlite = getVehicleForBusiness(vehicle.id, businessAId);
      expect(restoredSqlite).not.toBeNull();
      expect(restoredSqlite?.id).toBe(vehicle.id);
      expect(restoredSqlite?.businessId).toBe(businessAId);
      expect(restoredSqlite?.make).toBe("Alfa Romeo");
      expect(restoredSqlite?.model).toBe("Giulia Quadrifoglio");

      // Verify Supabase canonical record remains intact
      const verifySupabase = await getInventoryVehicle(clientA, vehicle.id, businessAId);
      expect(verifySupabase?.id).toBe(vehicle.id);

      // Verify shared UUID invariant is preserved across both planes
      expect(restoredSqlite?.id).toBe(verifySupabase?.id);
    });

    it("Case D: blocks deletion of a vehicle with linked captures and preserves evidence", async () => {
      const vehicle = await createInventoryVehicle(
        clientA,
        { make: "Hyundai", model: "Ioniq 5 N", year: 2024 },
        businessAId,
      );
      createdVehicleIds.push(vehicle.id);

      // Attach a capture in SQLite
      const captureId = `cap-${Math.random().toString(36).slice(2, 8)}`;
      createCapture({
        id: captureId,
        vehicleId: vehicle.id,
        sourceVideoPath: `vehicles/${vehicle.id}/captures/${captureId}/source/video.mp4`,
        sourceFilename: "walkaround.mp4",
        sourceMimeType: "video/mp4",
        targetFrameCount: 48,
      });

      // Attempting to delete must throw an error protecting evidence
      await expect(
        deleteInventoryVehicle(clientA, vehicle.id, businessAId),
      ).rejects.toThrow("Cannot delete vehicle with attached captures");

      // Verify vehicle still exists in Supabase and SQLite
      const verifySupabase = await getInventoryVehicle(clientA, vehicle.id, businessAId);
      expect(verifySupabase?.id).toBe(vehicle.id);

      const verifySqlite = getVehicle(vehicle.id);
      expect(verifySqlite?.id).toBe(vehicle.id);

      const verifyCapture = getCapture(captureId);
      expect(verifyCapture?.id).toBe(captureId);
    });
  });

  describe("Test I — Dealership Role Boundaries", () => {
    it("allows DEALER_MEMBER to create and update inventory vehicles in their own business", async () => {
      const vehicle = await createInventoryVehicle(
        clientMemberA,
        { make: "Kia", model: "EV6 GT", year: 2024 },
        businessAId,
      );
      createdVehicleIds.push(vehicle.id);

      expect(vehicle.id).toBeDefined();

      const updated = await updateInventoryVehicle(
        clientMemberA,
        vehicle.id,
        { price: 62000 },
        businessAId,
      );
      expect(updated.price).toBe(62000);
    });

    it("prevents DEALER_MEMBER in Business A from accessing Business B", async () => {
      const listB = await listInventoryVehicles(clientMemberA, businessBId);
      expect(listB).toHaveLength(0);
    });
  });

  describe("Test J — Legacy Historical Processing Evidence Verification", () => {
    it("preserves authoritative local evidence baseline without modification", () => {
      const authoritativeDb = new DatabaseSync(
        path.join(process.cwd(), "data", "vehicle-360.sqlite"),
      );
      const vehicleCount = (
        authoritativeDb.prepare("SELECT count(*) as count FROM vehicles").get() as { count: number }
      ).count;
      const captureCount = (
        authoritativeDb.prepare("SELECT count(*) as count FROM captures").get() as { count: number }
      ).count;
      const frameCount = (
        authoritativeDb.prepare("SELECT count(*) as count FROM frames").get() as { count: number }
      ).count;

      // Evidence counts must be exactly 18 vehicles, 19 captures, 732 frames
      expect(vehicleCount).toBe(18);
      expect(captureCount).toBe(19);
      expect(frameCount).toBe(732);
    });

    it("preserves Quick Check A vehicle and ready 48-frame capture intact", () => {
      const quickCheckVehicleId = "5167cc7a-9ded-4079-97e0-9e72627361fe";
      const quickCheckCaptureId = "471d03a6-21b9-4000-a25c-a48ce6a1e226";

      const authoritativeDb = new DatabaseSync(
        path.join(process.cwd(), "data", "vehicle-360.sqlite"),
      );
      const vehicle = authoritativeDb
        .prepare("SELECT * FROM vehicles WHERE id = ?")
        .get(quickCheckVehicleId) as { id: string; business_id: string | null } | undefined;
      expect(vehicle).toBeDefined();
      expect(vehicle?.business_id).toBeNull(); // Untouched unassigned legacy

      const capture = authoritativeDb
        .prepare("SELECT * FROM captures WHERE id = ?")
        .get(quickCheckCaptureId) as {
        id: string;
        status: string;
        target_frame_count: number;
        frame_count: number;
      } | undefined;
      expect(capture).toBeDefined();
      expect(capture?.status).toBe("READY");
      expect(capture?.target_frame_count).toBe(48);
      expect(capture?.frame_count).toBe(48);

      const frames = authoritativeDb
        .prepare("SELECT * FROM frames WHERE capture_id = ? ORDER BY frame_index ASC")
        .all(quickCheckCaptureId) as { frame_index: number }[];
      expect(frames).toHaveLength(48);
      expect(frames[0].frame_index).toBe(0);
      expect(frames[47].frame_index).toBe(47);
    });
  });
});
