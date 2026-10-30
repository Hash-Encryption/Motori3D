"use server";

import { updateDealershipStatus } from "@/server/admin/super-admin-repository";
import { revalidatePath } from "next/cache";
import type { BusinessStatus } from "@/server/auth/types";

export async function toggleDealershipStatusAction(
  businessId: string,
  newStatus: BusinessStatus,
) {
  // Authorization is enforced inside updateDealershipStatus()
  await updateDealershipStatus(businessId, newStatus);
  revalidatePath(`/super-admin/clients/${businessId}`);
  revalidatePath("/super-admin/clients");
  return { success: true, status: newStatus };
}
