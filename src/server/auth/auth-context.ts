import "server-only";

import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import type {
  AuthContext,
  BusinessRecord,
  DealerRole,
  MembershipWithBusiness,
  ProfileRecord,
} from "./types";

export const BUSINESS_PREFERENCE_COOKIE = "vehicle360_business";

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Access denied for this dealership.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NoDealershipError extends Error {
  constructor(message = "User has no active dealership memberships.") {
    super(message);
    this.name = "NoDealershipError";
  }
}

type AuthContextOptions = {
  requestedBusinessId?: string;
  requiredRole?: DealerRole;
};

export async function getAuthContext(
  options?: AuthContextOptions,
): Promise<AuthContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  // Load active memberships and associated business data
  const { data: rawMemberships, error: membershipError } = await supabase
    .from("business_memberships")
    .select(`
      id,
      business_id,
      user_id,
      role,
      status,
      created_at,
      updated_at,
      businesses:business_id (
        id,
        name,
        slug,
        status,
        created_at,
        updated_at
      )
    `)
    .eq("user_id", user.id)
    .eq("status", "ACTIVE");

  if (membershipError) {
    console.error("Failed to load user memberships", membershipError);
    return null;
  }

  // Load profile
  const { data: rawProfile } = await supabase
    .from("profiles")
    .select("id, full_name, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  const profile: ProfileRecord | null = rawProfile
    ? {
        id: rawProfile.id,
        fullName: rawProfile.full_name,
        createdAt: rawProfile.created_at,
        updatedAt: rawProfile.updated_at,
      }
    : null;

  const validMemberships: MembershipWithBusiness[] = [];
  for (const m of rawMemberships ?? []) {
    const rawBiz = Array.isArray(m.businesses) ? m.businesses[0] : m.businesses;
    if (rawBiz && rawBiz.status === "ACTIVE") {
      const business: BusinessRecord = {
        id: rawBiz.id,
        name: rawBiz.name,
        slug: rawBiz.slug,
        status: rawBiz.status,
        createdAt: rawBiz.created_at,
        updatedAt: rawBiz.updated_at,
      };
      validMemberships.push({
        id: m.id,
        businessId: m.business_id,
        userId: m.user_id,
        role: m.role as DealerRole,
        status: m.status,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
        business,
      });
    }
  }

  if (validMemberships.length === 0) {
    // Auto-provision initial dealership for authenticated user who doesn't have one yet
    const nameSeed =
      profile?.fullName ||
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "Dealership";
    const defaultName = `${nameSeed}'s Motors`;
    const defaultSlug = `motors-${user.id.slice(0, 8)}`;

    const { data: rpcResult } = await supabase.rpc("create_dealership", {
      dealership_name: defaultName,
      dealership_slug: defaultSlug,
    });

    if (rpcResult?.business_id) {
      const newBusiness: BusinessRecord = {
        id: rpcResult.business_id,
        name: rpcResult.name || defaultName,
        slug: rpcResult.slug || defaultSlug,
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      validMemberships.push({
        id: rpcResult.business_id,
        businessId: rpcResult.business_id,
        userId: user.id,
        role: "DEALER_ADMIN",
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        business: newBusiness,
      });
    } else {
      return null;
    }
  }

  // Determine requested or preferred business context
  const cookieStore = await cookies();
  const preferredBusinessId = cookieStore.get(BUSINESS_PREFERENCE_COOKIE)?.value;

  let activeMembership: MembershipWithBusiness | undefined;

  if (options?.requestedBusinessId) {
    // Explicit client request — MUST be validated against actual membership
    activeMembership = validMemberships.find(
      (m) => m.businessId === options.requestedBusinessId,
    );
    if (!activeMembership) {
      throw new ForbiddenError(
        "You do not have active membership in the requested dealership.",
      );
    }
  } else if (preferredBusinessId) {
    activeMembership = validMemberships.find(
      (m) => m.businessId === preferredBusinessId,
    );
  }

  // Fallback to first active membership
  if (!activeMembership) {
    activeMembership = validMemberships[0];
  }

  // Verify required role
  if (options?.requiredRole === "DEALER_ADMIN" && activeMembership.role !== "DEALER_ADMIN") {
    throw new ForbiddenError("Dealership administrator privileges are required.");
  }

  return {
    user,
    profile,
    business: activeMembership.business,
    membership: {
      id: activeMembership.id,
      businessId: activeMembership.businessId,
      userId: activeMembership.userId,
      role: activeMembership.role,
      status: activeMembership.status,
      createdAt: activeMembership.createdAt,
      updatedAt: activeMembership.updatedAt,
    },
    role: activeMembership.role,
    allMemberships: validMemberships,
  };
}

export async function requireAuthContext(
  options?: AuthContextOptions,
): Promise<AuthContext> {
  const context = await getAuthContext(options);
  if (!context) {
    throw new UnauthorizedError("Authentication required.");
  }
  return context;
}
