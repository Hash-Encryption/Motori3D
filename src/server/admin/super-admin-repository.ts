import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdminContext } from "@/server/auth/auth-context";
import type { BusinessStatus } from "@/server/auth/types";

export type PlatformClientSummary = {
  id: string;
  name: string;
  slug: string;
  status: BusinessStatus;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  vehicleCount: number;
};

export type PlatformClientMember = {
  id: string;
  userId: string;
  role: string;
  status: string;
  createdAt: string;
  fullName: string | null;
};

export type PlatformClientVehicle = {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number | null;
  mileage: number | null;
  vin: string | null;
  stockNumber: string | null;
  status: string;
  createdAt: string;
};

export type PlatformClientDetail = {
  id: string;
  name: string;
  slug: string;
  status: BusinessStatus;
  createdAt: string;
  updatedAt: string;
  members: PlatformClientMember[];
  vehicles: PlatformClientVehicle[];
};

/**
 * List all real persisted dealership clients across the platform.
 * Mandatory server-side Super Admin authorization check.
 */
export async function listPlatformClients(): Promise<PlatformClientSummary[]> {
  // 1. Enforce platform-level Super Admin authorization
  await requireSuperAdminContext();

  // 2. Server-only privileged data access via adminClient
  const adminClient = createAdminClient();

  const { data: businesses, error: bizError } = await (adminClient as any)
    .from("businesses")
    .select("id, name, slug, status, created_at, updated_at, memberships:business_memberships(count), vehicles:vehicles(count)")
    .order("created_at", { ascending: false });

  if (bizError) {
    console.error("Failed to query platform clients", bizError);
    throw new Error(`Failed to load platform clients: ${bizError.message}`);
  }

  return (businesses ?? []).map((b: any) => {
    const memberCount = Array.isArray(b.memberships) && b.memberships[0]?.count != null
      ? Number(b.memberships[0].count)
      : 0;
    const vehicleCount = Array.isArray(b.vehicles) && b.vehicles[0]?.count != null
      ? Number(b.vehicles[0].count)
      : 0;

    return {
      id: b.id,
      name: b.name,
      slug: b.slug,
      status: b.status as BusinessStatus,
      createdAt: b.created_at,
      updatedAt: b.updated_at,
      memberCount,
      vehicleCount,
    };
  });
}

/**
 * Inspect a specific dealership client.
 * Mandatory server-side Super Admin authorization check.
 */
export async function getPlatformClientDetail(businessId: string): Promise<PlatformClientDetail | null> {
  // 1. Enforce platform-level Super Admin authorization
  await requireSuperAdminContext();

  // 2. Server-only privileged data access via adminClient
  const adminClient = createAdminClient();

  const { data: business, error: bizError } = await (adminClient as any)
    .from("businesses")
    .select("id, name, slug, status, created_at, updated_at")
    .eq("id", businessId)
    .maybeSingle();

  if (bizError || !business) {
    return null;
  }

  // Load memberships belonging to this dealership
  const { data: memberships } = await (adminClient as any)
    .from("business_memberships")
    .select("id, user_id, role, status, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });

  const userIds = (memberships ?? []).map((m: any) => m.user_id);
  const profilesMap = new Map<string, { fullName: string }>();

  if (userIds.length > 0) {
    const { data: profiles } = await (adminClient as any)
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    for (const p of profiles ?? []) {
      profilesMap.set(p.id, { fullName: p.full_name });
    }
  }

  const members: PlatformClientMember[] = (memberships ?? []).map((m: any) => ({
    id: m.id,
    userId: m.user_id,
    role: m.role,
    status: m.status,
    createdAt: m.created_at,
    fullName: profilesMap.get(m.user_id)?.fullName ?? null,
  }));

  // Load vehicles belonging to this dealership
  const { data: vehicles } = await (adminClient as any)
    .from("vehicles")
    .select("id, make, model, year, price, mileage, vin, stock_number, status, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  const clientVehicles: PlatformClientVehicle[] = (vehicles ?? []).map((v: any) => ({
    id: v.id,
    make: v.make,
    model: v.model,
    year: v.year,
    price: v.price,
    mileage: v.mileage,
    vin: v.vin,
    stockNumber: v.stock_number,
    status: v.status,
    createdAt: v.created_at,
  }));

  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    status: business.status as BusinessStatus,
    createdAt: business.created_at,
    updatedAt: business.updated_at,
    members,
    vehicles: clientVehicles,
  };
}

/**
 * Toggle or update dealership status (ACTIVE <-> SUSPENDED).
 * Mandatory server-side Super Admin authorization check.
 */
export async function updateDealershipStatus(
  businessId: string,
  status: BusinessStatus,
): Promise<{ success: boolean; status: BusinessStatus }> {
  // 1. Enforce platform-level Super Admin authorization
  await requireSuperAdminContext();

  if (status !== "ACTIVE" && status !== "SUSPENDED") {
    throw new Error("Invalid dealership status: must be ACTIVE or SUSPENDED.");
  }

  const adminClient = createAdminClient();
  const { error } = await (adminClient as any)
    .from("businesses")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", businessId);

  if (error) {
    throw new Error(`Failed to update dealership status: ${error.message}`);
  }

  return { success: true, status };
}
