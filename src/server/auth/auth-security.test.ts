import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/types/database.types";
import {
  createVehicleForBusiness,
  getVehicleForBusiness,
  listVehicles,
  listVehiclesForBusiness,
} from "../vehicles/vehicle-repository";

// Load .env.local for Supabase credentials in tests
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

const anonClient = createClient<Database>(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

describe("Phase 03 — SaaS Foundation & Tenant Isolation Acceptance Suite", () => {
  const testRunId = Math.random().toString(36).slice(2, 8);
  const userAEmail = `test.user.a.${testRunId}@acceptance-v360.com`;
  const userBEmail = `test.user.b.${testRunId}@acceptance-v360.com`;
  const memberAEmail = `test.member.a.${testRunId}@acceptance-v360.com`;
  const testPassword = "Password123!Secure";

  let userAId: string;
  let userBId: string;
  let memberAId: string;

  let clientA: SupabaseClient<Database>;
  let clientB: SupabaseClient<Database>;
  let clientMemberA: SupabaseClient<Database>;

  let businessAId: string;
  let businessBId: string;

  beforeAll(async () => {
    // 1. Create User A
    const { data: userACreated, error: errA } = await adminClient.auth.admin.createUser({
      email: userAEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: "Alice Admin A" },
    });
    if (errA) throw errA;
    userAId = userACreated.user.id;

    // 2. Create User B
    const { data: userBCreated, error: errB } = await adminClient.auth.admin.createUser({
      email: userBEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: "Bob Admin B" },
    });
    if (errB) throw errB;
    userBId = userBCreated.user.id;

    // 3. Create Member A (regular member in Business A)
    const { data: memberACreated, error: errMem } = await adminClient.auth.admin.createUser({
      email: memberAEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: "Charlie Member A" },
    });
    if (errMem) throw errMem;
    memberAId = memberACreated.user.id;

    // Initialize authenticated clients for User A, User B, Member A
    clientA = createClient<Database>(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signinA } = await clientA.auth.signInWithPassword({
      email: userAEmail,
      password: testPassword,
    });
    expect(signinA.user?.id).toBe(userAId);

    clientB = createClient<Database>(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signinB } = await clientB.auth.signInWithPassword({
      email: userBEmail,
      password: testPassword,
    });
    expect(signinB.user?.id).toBe(userBId);

    clientMemberA = createClient<Database>(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signinMem } = await clientMemberA.auth.signInWithPassword({
      email: memberAEmail,
      password: testPassword,
    });
    expect(signinMem.user?.id).toBe(memberAId);

    // 4. Create Business A via atomic RPC as User A
    const { data: bizA, error: bizAErr } = await clientA.rpc("create_dealership", {
      dealership_name: `Dealership A ${testRunId}`,
      dealership_slug: `dealership-a-${testRunId}`,
    });
    if (bizAErr) throw bizAErr;
    businessAId = bizA.business_id;

    // 5. Create Business B via atomic RPC as User B
    const { data: bizB, error: bizBErr } = await clientB.rpc("create_dealership", {
      dealership_name: `Dealership B ${testRunId}`,
      dealership_slug: `dealership-b-${testRunId}`,
    });
    if (bizBErr) throw bizBErr;
    businessBId = bizB.business_id;

    // 6. User A adds Member A to Business A with DEALER_MEMBER role
    const { error: addMemErr } = await clientA.from("business_memberships").insert({
      business_id: businessAId,
      user_id: memberAId,
      role: "DEALER_MEMBER",
      status: "ACTIVE",
    });
    if (addMemErr) throw addMemErr;
  });

  afterAll(async () => {
    // Clean up test users and cascade-delete their test businesses/memberships
    if (userAId) await adminClient.auth.admin.deleteUser(userAId);
    if (userBId) await adminClient.auth.admin.deleteUser(userBId);
    if (memberAId) await adminClient.auth.admin.deleteUser(memberAId);
    if (businessAId) await adminClient.from("businesses").delete().eq("id", businessAId);
    if (businessBId) await adminClient.from("businesses").delete().eq("id", businessBId);
  });

  describe("Test A — Authentication & Identity", () => {
    it("recognizes authenticated identity and user metadata server-side", async () => {
      const { data: userRes, error } = await clientA.auth.getUser();
      expect(error).toBeNull();
      expect(userRes.user?.id).toBe(userAId);
      expect(userRes.user?.email).toBe(userAEmail);
    });

    it("automatically creates a profile record for new user via trigger", async () => {
      const { data: profile, error } = await clientA
        .from("profiles")
        .select("*")
        .eq("id", userAId)
        .single();

      expect(error).toBeNull();
      expect(profile?.id).toBe(userAId);
      expect(profile?.full_name).toBe("Alice Admin A");
    });

    it("rejects unauthorized access for anonymous client on profiles table", async () => {
      const { data: anonProfiles } = await anonClient
        .from("profiles")
        .select("*");

      // RLS returns empty list for anonymous
      expect(anonProfiles).toHaveLength(0);
    });
  });

  describe("Test B — Business Membership & Roles", () => {
    it("creates DEALER_ADMIN membership for business creator", async () => {
      const { data: memberships, error } = await clientA
        .from("business_memberships")
        .select("*")
        .eq("business_id", businessAId);

      expect(error).toBeNull();
      expect(memberships?.length).toBeGreaterThanOrEqual(1);
      const adminMem = memberships?.find((m) => m.user_id === userAId);
      expect(adminMem?.role).toBe("DEALER_ADMIN");
      expect(adminMem?.status).toBe("ACTIVE");
    });

    it("allows DEALER_ADMIN to read all members in their dealership", async () => {
      const { data: memberships, error } = await clientA
        .from("business_memberships")
        .select("*")
        .eq("business_id", businessAId);

      expect(error).toBeNull();
      expect(memberships?.length).toBe(2); // User A (admin) + Member A (member)
    });

    it("allows DEALER_MEMBER to read memberships in their dealership", async () => {
      const { data: memberships, error } = await clientMemberA
        .from("business_memberships")
        .select("*")
        .eq("business_id", businessAId);

      expect(error).toBeNull();
      expect(memberships?.length).toBe(2);
    });
  });

  describe("Test C — Cross-Tenant Read Isolation (RLS)", () => {
    it("prevents User A from reading Business B private record", async () => {
      const { data: bizBFromA, error } = await clientA
        .from("businesses")
        .select("*")
        .eq("id", businessBId);

      expect(error).toBeNull();
      // RLS policy scopes select to is_business_member(id) -> User A gets 0 rows
      expect(bizBFromA).toHaveLength(0);
    });

    it("prevents User B from reading Business A private record", async () => {
      const { data: bizAFromB, error } = await clientB
        .from("businesses")
        .select("*")
        .eq("id", businessAId);

      expect(error).toBeNull();
      expect(bizAFromB).toHaveLength(0);
    });

    it("prevents User A from reading Business B memberships", async () => {
      const { data: memBFromA, error } = await clientA
        .from("business_memberships")
        .select("*")
        .eq("business_id", businessBId);

      expect(error).toBeNull();
      expect(memBFromA).toHaveLength(0);
    });

    it("prevents User B from reading Business A memberships", async () => {
      const { data: memAFromB, error } = await clientB
        .from("business_memberships")
        .select("*")
        .eq("business_id", businessAId);

      expect(error).toBeNull();
      expect(memAFromB).toHaveLength(0);
    });
  });

  describe("Test D — Cross-Tenant Write Isolation (RLS)", () => {
    it("prevents User A from updating Business B", async () => {
      const { data } = await clientA
        .from("businesses")
        .update({ name: "HACKED BY A" })
        .eq("id", businessBId)
        .select();

      // RLS blocks update: 0 rows modified
      expect(data).toHaveLength(0);

      // Verify Business B unchanged
      const { data: verifyB } = await clientB
        .from("businesses")
        .select("name")
        .eq("id", businessBId)
        .single();
      expect(verifyB?.name).not.toBe("HACKED BY A");
    });

    it("prevents User B from updating Business A", async () => {
      const { data } = await clientB
        .from("businesses")
        .update({ name: "HACKED BY B" })
        .eq("id", businessAId)
        .select();

      expect(data).toHaveLength(0);

      const { data: verifyA } = await clientA
        .from("businesses")
        .select("name")
        .eq("id", businessAId)
        .single();
      expect(verifyA?.name).not.toBe("HACKED BY B");
    });

    it("prevents User A from inserting memberships into Business B", async () => {
      const { data, error } = await clientA
        .from("business_memberships")
        .insert({
          business_id: businessBId,
          user_id: userAId,
          role: "DEALER_ADMIN",
          status: "ACTIVE",
        })
        .select();

      // RLS policy requires is_business_admin(business_id) -> User A is not admin of B
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });

    it("prevents User B from deleting memberships in Business A", async () => {
      const { data } = await clientB
        .from("business_memberships")
        .delete()
        .eq("business_id", businessAId)
        .select();

      expect(data).toHaveLength(0);

      // Verify memberships in A still exist
      const { data: membershipsA } = await clientA
        .from("business_memberships")
        .select("*")
        .eq("business_id", businessAId);
      expect(membershipsA?.length).toBe(2);
    });
  });

  describe("Test E — Role Escalation Resistance", () => {
    it("prevents DEALER_MEMBER from escalating their own role to DEALER_ADMIN", async () => {
      const { data } = await clientMemberA
        .from("business_memberships")
        .update({ role: "DEALER_ADMIN" })
        .eq("user_id", memberAId)
        .eq("business_id", businessAId)
        .select();

      // RLS requires is_business_admin(business_id) for updates on business_memberships
      expect(data).toHaveLength(0);

      // Verify role is still DEALER_MEMBER
      const { data: memberCheck } = await clientA
        .from("business_memberships")
        .select("role")
        .eq("user_id", memberAId)
        .eq("business_id", businessAId)
        .single();

      expect(memberCheck?.role).toBe("DEALER_MEMBER");
    });

    it("prevents DEALER_MEMBER from updating business settings", async () => {
      const { data } = await clientMemberA
        .from("businesses")
        .update({ name: "Renamed by Member" })
        .eq("id", businessAId)
        .select();

      expect(data).toHaveLength(0);
    });

    it("prevents DEALER_MEMBER from adding new members", async () => {
      const { data, error } = await clientMemberA
        .from("business_memberships")
        .insert({
          business_id: businessAId,
          user_id: userBId,
          role: "DEALER_MEMBER",
          status: "ACTIVE",
        })
        .select();

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });
  });

  describe("Test F — Anonymous Database Rejection", () => {
    it("rejects anonymous SELECT on businesses", async () => {
      const { data } = await anonClient.from("businesses").select("*");
      expect(data).toHaveLength(0);
    });

    it("rejects anonymous SELECT on business_memberships", async () => {
      const { data } = await anonClient.from("business_memberships").select("*");
      expect(data).toHaveLength(0);
    });

    it("rejects anonymous INSERT on businesses", async () => {
      const { error } = await anonClient.from("businesses").insert({
        name: "Anonymous Dealership",
        slug: "anon-dealership",
      });
      expect(error).not.toBeNull();
    });
  });

  describe("Test G — Local SQLite Tenant Ownership Bridge", () => {
    it("isolates tenant vehicles by businessId in local SQLite", () => {
      const vehicleA = createVehicleForBusiness(
        {
          name: "Tenant A Sedan",
          make: "Toyota",
          model: "Camry",
          year: 2026,
          stockIdentifier: "A-001",
        },
        businessAId,
      );

      const vehicleB = createVehicleForBusiness(
        {
          name: "Tenant B SUV",
          make: "Honda",
          model: "CR-V",
          year: 2026,
          stockIdentifier: "B-001",
        },
        businessBId,
      );

      expect(vehicleA.businessId).toBe(businessAId);
      expect(vehicleB.businessId).toBe(businessBId);

      // Query for Business A
      const listA = listVehiclesForBusiness(businessAId);
      const vehicleIdsA = listA.map((v) => v.id);
      expect(vehicleIdsA).toContain(vehicleA.id);
      expect(vehicleIdsA).not.toContain(vehicleB.id);

      // Query for Business B
      const listB = listVehiclesForBusiness(businessBId);
      const vehicleIdsB = listB.map((v) => v.id);
      expect(vehicleIdsB).toContain(vehicleB.id);
      expect(vehicleIdsB).not.toContain(vehicleA.id);

      // Cross-business single lookup
      const crossLookup = getVehicleForBusiness(vehicleA.id, businessBId);
      expect(crossLookup).toBeNull();

      const validLookup = getVehicleForBusiness(vehicleA.id, businessAId);
      expect(validLookup?.id).toBe(vehicleA.id);
    });

    it("prevents legacy listVehicles from leaking tenant-owned vehicles", () => {
      const legacyList = listVehicles();
      for (const vehicle of legacyList) {
        expect(vehicle.businessId).toBeNull();
      }
    });
  });
});
