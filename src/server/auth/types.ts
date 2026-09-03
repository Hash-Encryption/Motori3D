import type { User } from "@supabase/supabase-js";

export type DealerRole = "DEALER_ADMIN" | "DEALER_MEMBER";
export type MembershipStatus = "ACTIVE" | "SUSPENDED";
export type BusinessStatus = "ACTIVE" | "SUSPENDED";

export type BusinessRecord = {
  id: string;
  name: string;
  slug: string;
  status: BusinessStatus;
  createdAt: string;
  updatedAt: string;
};

export type BusinessMembershipRecord = {
  id: string;
  businessId: string;
  userId: string;
  role: DealerRole;
  status: MembershipStatus;
  createdAt: string;
  updatedAt: string;
};

export type MembershipWithBusiness = BusinessMembershipRecord & {
  business: BusinessRecord;
};

export type ProfileRecord = {
  id: string;
  fullName: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthContext = {
  user: User;
  profile: ProfileRecord | null;
  business: BusinessRecord;
  membership: BusinessMembershipRecord;
  role: DealerRole;
  isSuperAdmin: boolean;
  allMemberships: MembershipWithBusiness[];
};
