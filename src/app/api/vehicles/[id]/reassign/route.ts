import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/server/auth/auth-context";
import { reassignPhysicalUnit } from "@/server/vehicles/inventory-repository";
import { validateReassignUnit } from "@/server/vehicles/vehicle-validation";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: RouteContext<"/api/vehicles/[id]/reassign">,
) {
  const authContext = await getAuthContext().catch(() => null);
  if (!authContext) {
    return Response.json(
      { error: "Authentication required to reassign physical units." },
      { status: 401 },
    );
  }

  const { id: unitId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const validation = validateReassignUnit({
    ...(typeof body === "object" && body !== null ? body : {}),
    unitId,
  });

  if (!validation.ok) {
    return Response.json(
      {
        error: "Check reassignment parameters.",
        fieldErrors: validation.errors,
      },
      { status: 422 },
    );
  }

  const supabase = await createClient();

  try {
    const result = await reassignPhysicalUnit(
      supabase,
      unitId,
      validation.value.targetListingId,
      authContext.business.id,
    );

    return Response.json(result);
  } catch (error) {
    console.error("Failed to reassign physical unit", error);
    const message =
      error instanceof Error ? error.message : "Failed to reassign physical unit.";
    return Response.json({ error: message }, { status: 400 });
  }
}
