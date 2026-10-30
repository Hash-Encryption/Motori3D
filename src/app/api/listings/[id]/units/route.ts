import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/server/auth/auth-context";
import { addPhysicalUnitToListing } from "@/server/vehicles/inventory-repository";
import { validateCreatePhysicalUnit } from "@/server/vehicles/vehicle-validation";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: RouteContext<"/api/listings/[id]/units">,
) {
  const authContext = await getAuthContext().catch(() => null);
  if (!authContext) {
    return Response.json(
      { error: "Authentication required to add physical units." },
      { status: 401 },
    );
  }

  const { id: listingId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const validation = validateCreatePhysicalUnit(body);
  if (!validation.ok) {
    return Response.json(
      {
        error: "Check the highlighted physical unit details.",
        fieldErrors: validation.errors,
      },
      { status: 422 },
    );
  }

  const supabase = await createClient();

  try {
    const unit = await addPhysicalUnitToListing(
      supabase,
      listingId,
      validation.value,
      authContext.business.id,
    );

    return Response.json({ unit }, { status: 201 });
  } catch (error) {
    console.error("Failed to add physical unit to listing", error);
    const message =
      error instanceof Error ? error.message : "Failed to add physical unit.";
    return Response.json({ error: message }, { status: 500 });
  }
}
