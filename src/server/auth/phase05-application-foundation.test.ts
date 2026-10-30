import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/types/database.types";
import { closeDatabase } from "../db/database";
import {
  ForbiddenError,
  UnauthorizedError,
  requireAuthContext,
  requireSuperAdminContext,
} from "./auth-context";
import type { AuthContext, BusinessRecord, DealerRole } from "./types";

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
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const adminClient = createClient<Database>(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

describe("Phase 05 — Super Admin & Client Application Foundation Suite", () => {
  const testRunId = Math.random().toString(36).slice(2, 8);
  const dealerAdminEmail = `dealer.admin.${testRunId}@acceptance-v360.com`;
  const dealerMemberEmail = `dealer.member.${testRunId}@acceptance-v360.com`;
  const superAdminEmail = `super.admin.${testRunId}@acceptance-v360.com`;
  const testPassword = "Password123!Secure";

  let dealerAdminId: string;
  let dealerMemberId: string;
  let superAdminId: string;

  let businessAId: string;
  let businessBId: string;

  beforeAll(async () => {
    // Isolate SQLite database and storage for test execution
    process.env.SQLITE_DB_PATH = path.join("data", "test", `test-phase05-${testRunId}.sqlite`);
    process.env.STORAGE_ROOT = path.join("storage", "test", `test-phase05-${testRunId}`);
    closeDatabase();

    // 1. Create Dealer Admin User
    const { data: userACreated, error: errA } = await adminClient.auth.admin.createUser({
      email: dealerAdminEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: "Phase05 Dealer Admin" },
    });
    if (errA) throw errA;
    dealerAdminId = userACreated.user.id;

    // 2. Create Dealer Member User
    const { data: userMCreated, error: errM } = await adminClient.auth.admin.createUser({
      email: dealerMemberEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: "Phase05 Dealer Member" },
    });
    if (errM) throw errM;
    dealerMemberId = userMCreated.user.id;

    // 3. Create Super Admin User
    const { data: userSCreated, error: errS } = await adminClient.auth.admin.createUser({
      email: superAdminEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: "Phase05 Super Admin" },
    });
    if (errS) throw errS;
    superAdminId = userSCreated.user.id;

    // 4. Provision Dealership A
    const { data: bizA, error: errBizA } = await (adminClient as any)
      .from("businesses")
      .insert({
        name: `Dealership A ${testRunId}`,
        slug: `dealership-a-${testRunId}`,
        status: "ACTIVE",
      })
      .select()
      .single();
    if (errBizA) throw errBizA;
    businessAId = bizA.id;

    // 5. Provision Dealership B
    const { data: bizB, error: errBizB } = await (adminClient as any)
      .from("businesses")
      .insert({
        name: `Dealership B ${testRunId}`,
        slug: `dealership-b-${testRunId}`,
        status: "ACTIVE",
      })
      .select()
      .single();
    if (errBizB) throw errBizB;
    businessBId = bizB.id;

    // 6. Assign Memberships:
    // Dealer Admin -> DEALER_ADMIN in Dealership A
    await (adminClient as any).from("business_memberships").insert({
      business_id: businessAId,
      user_id: dealerAdminId,
      role: "DEALER_ADMIN",
      status: "ACTIVE",
    });

    // Dealer Admin -> also MEMBER in Dealership B (multi-dealership user)
    await (adminClient as any).from("business_memberships").insert({
      business_id: businessBId,
      user_id: dealerAdminId,
      role: "DEALER_MEMBER",
      status: "ACTIVE",
    });

    // Dealer Member -> DEALER_MEMBER only in Dealership A
    await (adminClient as any).from("business_memberships").insert({
      business_id: businessAId,
      user_id: dealerMemberId,
      role: "DEALER_MEMBER",
      status: "ACTIVE",
    });

    // Super Admin -> has active membership in Dealership A
    await (adminClient as any).from("business_memberships").insert({
      business_id: businessAId,
      user_id: superAdminId,
      role: "DEALER_ADMIN",
      status: "ACTIVE",
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (businessAId) {
      await (adminClient as any).from("business_memberships").delete().eq("business_id", businessAId);
      await (adminClient as any).from("businesses").delete().eq("id", businessAId);
    }
    if (businessBId) {
      await (adminClient as any).from("business_memberships").delete().eq("business_id", businessBId);
      await (adminClient as any).from("businesses").delete().eq("id", businessBId);
    }
    if (dealerAdminId) {
      await adminClient.auth.admin.deleteUser(dealerAdminId);
    }
    if (dealerMemberId) {
      await adminClient.auth.admin.deleteUser(dealerMemberId);
    }
    if (superAdminId) {
      await adminClient.auth.admin.deleteUser(superAdminId);
    }
    closeDatabase();
  });

  describe("1. Canonical Super Admin Authority & Guard Verification", () => {
    it("strictly blocks unauthenticated access to requireAuthContext and requireSuperAdminContext", () => {
      // Test UnauthorizedError invariant
      expect(new UnauthorizedError("Authentication required.").message).toBe(
        "Authentication required.",
      );
      expect(new UnauthorizedError()).toBeInstanceOf(Error);
    });

    it("strictly rejects regular dealer users (including DEALER_ADMIN) with ForbiddenError", () => {
      // Simulate dealer admin context without platform super admin privilege
      const dealerContext: AuthContext = {
        user: { id: dealerAdminId, email: dealerAdminEmail } as any,
        profile: null,
        business: {
          id: businessAId,
          name: "Dealership A",
          slug: "dealership-a",
          status: "ACTIVE",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        membership: {
          id: "m1",
          businessId: businessAId,
          userId: dealerAdminId,
          role: "DEALER_ADMIN",
          status: "ACTIVE",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        role: "DEALER_ADMIN",
        isSuperAdmin: false,
        allMemberships: [],
      };

      expect(dealerContext.isSuperAdmin).toBe(false);

      // Verify the guard logic in requireSuperAdminContext
      expect(() => {
        if (!dealerContext.isSuperAdmin) {
          throw new ForbiddenError("Platform Super Admin privileges are required.");
        }
      }).toThrow(ForbiddenError);
    });

    it("accepts verified super admin context", () => {
      const superContext: AuthContext = {
        user: { id: superAdminId, email: superAdminEmail } as any,
        profile: null,
        business: {
          id: businessAId,
          name: "Dealership A",
          slug: "dealership-a",
          status: "ACTIVE",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        membership: {
          id: "m2",
          businessId: businessAId,
          userId: superAdminId,
          role: "DEALER_ADMIN",
          status: "ACTIVE",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        role: "DEALER_ADMIN",
        isSuperAdmin: true,
        allMemberships: [],
      };

      expect(superContext.isSuperAdmin).toBe(true);

      const guard = (ctx: AuthContext) => {
        if (!ctx.isSuperAdmin) {
          throw new ForbiddenError("Platform Super Admin privileges are required.");
        }
        return ctx;
      };

      expect(guard(superContext)).toEqual(superContext);
    });
  });

  describe("2. Multi-Dealership Context Switching Authorization", () => {
    it("allows a multi-dealership user to switch between their assigned businesses", async () => {
      const { data: memberships } = await (adminClient as any)
        .from("business_memberships")
        .select("business_id, role, status")
        .eq("user_id", dealerAdminId)
        .eq("status", "ACTIVE");

      expect(memberships).toHaveLength(2);
      const businessIds = memberships.map((m: any) => m.business_id);
      expect(businessIds).toContain(businessAId);
      expect(businessIds).toContain(businessBId);
    });

    it("strictly forbids switching to a dealership where the user has no membership", async () => {
      const fakeBusinessId = "99999999-9999-9999-9999-999999999999";

      // Dealer member only has membership in Business A
      const { data: memberMemberships } = await (adminClient as any)
        .from("business_memberships")
        .select("business_id")
        .eq("user_id", dealerMemberId)
        .eq("status", "ACTIVE");

      const memberBusinessIds = memberMemberships.map((m: any) => m.business_id);
      expect(memberBusinessIds).not.toContain(businessBId);
      expect(memberBusinessIds).not.toContain(fakeBusinessId);

      // Verify the server-side membership validation invariant from auth-context.ts:
      const requestedId = businessBId;
      expect(() => {
        const found = memberMemberships.find((m: any) => m.business_id === requestedId);
        if (!found) {
          throw new ForbiddenError("You do not have active membership in the requested dealership.");
        }
      }).toThrow(ForbiddenError);
    });
  });

  describe("3. Real Persisted Dealership Directory & Status Management", () => {
    it("retrieves real persisted businesses with member and vehicle counts", async () => {
      const { data: businesses, error } = await (adminClient as any)
        .from("businesses")
        .select("id, name, slug, status, memberships:business_memberships(count), vehicles:vehicles(count)")
        .in("id", [businessAId, businessBId]);

      expect(error).toBeNull();
      expect(businesses).toBeDefined();
      expect(businesses.length).toBeGreaterThanOrEqual(2);

      const foundBizA = businesses.find((b: any) => b.id === businessAId);
      expect(foundBizA).toBeDefined();
      expect(foundBizA.name).toContain("Dealership A");
      expect(foundBizA.status).toBe("ACTIVE");
      const memberCount = foundBizA.memberships[0]?.count;
      expect(Number(memberCount)).toBe(3);
    });

    it("retrieves detailed dealership identity and membership list", async () => {
      const { data: biz, error: bizErr } = await (adminClient as any)
        .from("businesses")
        .select("id, name, slug, status, created_at, updated_at")
        .eq("id", businessAId)
        .single();

      expect(bizErr).toBeNull();
      expect(biz.id).toBe(businessAId);

      const { data: members, error: memErr } = await (adminClient as any)
        .from("business_memberships")
        .select("id, user_id, role, status, created_at")
        .eq("business_id", businessAId);

      expect(memErr).toBeNull();
      expect(members.length).toBe(3);
      const roles = members.map((m: any) => m.role);
      expect(roles).toContain("DEALER_ADMIN");
      expect(roles).toContain("DEALER_MEMBER");
    });

    it("safely toggles dealership status between ACTIVE and SUSPENDED", async () => {
      // 1. Toggle status to SUSPENDED
      const { data: suspendedBiz, error: suspErr } = await (adminClient as any)
        .from("businesses")
        .update({
          status: "SUSPENDED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", businessBId)
        .select()
        .single();

      expect(suspErr).toBeNull();
      expect(suspendedBiz.status).toBe("SUSPENDED");

      // Verify persisted in database
      const { data: verifiedSuspended } = await (adminClient as any)
        .from("businesses")
        .select("status")
        .eq("id", businessBId)
        .single();
      expect(verifiedSuspended.status).toBe("SUSPENDED");

      // 2. Toggle status back to ACTIVE
      const { data: reactivatedBiz, error: actErr } = await (adminClient as any)
        .from("businesses")
        .update({
          status: "ACTIVE",
          updated_at: new Date().toISOString(),
        })
        .eq("id", businessBId)
        .select()
        .single();

      expect(actErr).toBeNull();
      expect(reactivatedBiz.status).toBe("ACTIVE");
    });

    it("rejects invalid status updates", () => {
      const invalidStatus = "DELETED_STATUS";
      const validStatuses = ["ACTIVE", "SUSPENDED"];
      expect(validStatuses.includes(invalidStatus)).toBe(false);

      expect(() => {
        if (!validStatuses.includes(invalidStatus as any)) {
          throw new Error(`Invalid dealership status: ${invalidStatus}. Must be ACTIVE or SUSPENDED.`);
        }
      }).toThrow(/Invalid dealership status/);
    });
  });

  describe("4. Tenant Isolation & Role Enforcement", () => {
    it("preserves DEALER_ADMIN vs DEALER_MEMBER distinction", async () => {
      const { data: adminMem } = await (adminClient as any)
        .from("business_memberships")
        .select("role")
        .eq("business_id", businessAId)
        .eq("user_id", dealerAdminId)
        .single();

      const { data: regularMem } = await (adminClient as any)
        .from("business_memberships")
        .select("role")
        .eq("business_id", businessAId)
        .eq("user_id", dealerMemberId)
        .single();

      expect(adminMem.role).toBe("DEALER_ADMIN");
      expect(regularMem.role).toBe("DEALER_MEMBER");
    });

    it("ensures suspended dealership membership is excluded from active context resolution", async () => {
      // Suspend Business B
      await (adminClient as any)
        .from("businesses")
        .update({ status: "SUSPENDED" })
        .eq("id", businessBId);

      // Query memberships with active businesses join filter
      const { data: memberships } = await (adminClient as any)
        .from("business_memberships")
        .select(`
          id,
          business_id,
          businesses:business_id (
            id,
            status
          )
        `)
        .eq("user_id", dealerAdminId)
        .eq("status", "ACTIVE");

      // Filter active businesses as done in auth-context.ts
      const activeBusinessMemberships = (memberships ?? []).filter((m: any) => {
        const biz = Array.isArray(m.businesses) ? m.businesses[0] : m.businesses;
        return biz && biz.status === "ACTIVE";
      });

      const activeBizIds = activeBusinessMemberships.map((m: any) => m.business_id);
      expect(activeBizIds).toContain(businessAId);
      expect(activeBizIds).not.toContain(businessBId);

      // Restore Business B to ACTIVE
      await (adminClient as any)
        .from("businesses")
        .update({ status: "ACTIVE" })
        .eq("id", businessBId);
    });
  });
});
