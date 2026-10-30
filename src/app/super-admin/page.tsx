import { redirect } from "next/navigation";
import { requireSuperAdminContext } from "@/server/auth/auth-context";

export const dynamic = "force-dynamic";

export default async function SuperAdminRootPage() {
  // Server-side authorization check before redirecting
  await requireSuperAdminContext();
  redirect("/super-admin/clients");
}
