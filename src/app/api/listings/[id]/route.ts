import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/server/auth/auth-context";
import {
  deleteVehicleListing,
  getVehicleListingWithUnits,
  updateVehicleListing,
} from "@/server/vehicles/inventory-repository";
import { validateUpdateVehicleListing } from "@/server/vehicles/vehicle-validation";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/listings/[id]">,
) {
  const authContext = await getAuthContext().catch(() => null);
  if (!authContext) {
    return Response.json(
      { error: "Authentication required to access listing details." },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const supabase = await createClient();

  try {
    const listingDetail = await getVehicleListingWithUnits(
      supabase,
      id,
      authContext.business.id,
    );

    if (!listingDetail) {
      return Response.json({ error: "Vehicle listing not found." }, { status: 404 });
    }

    return Response.json(listingDetail);
  } catch (error) {
    console.error("Failed to get vehicle listing", error);
    return Response.json(
      { error: "Failed to load vehicle listing details." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/listings/[id]">,
) {
  const authContext = await getAuthContext().catch(() => null);
  if (!authContext) {
    return Response.json(
      { error: "Authentication required to update vehicle listings." },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  // Reject explicit attempts to change immutable identity properties
  if (body && typeof body === "object") {
    const candidate = body as Record<string, unknown>;
    if (candidate.id !== undefined && candidate.id !== id) {
      return Response.json(
        { error: "Listing ID is immutable and cannot be changed." },
        { status: 400 },
      );
    }
    if (candidate.business_id !== undefined || candidate.businessId !== undefined) {
      const targetBiz = candidate.business_id ?? candidate.businessId;
      if (targetBiz !== authContext.business.id) {
        return Response.json(
          { error: "Listing business ownership is immutable and cannot be transferred." },
          { status: 400 },
        );
      }
    }
  }

  const validation = validateUpdateVehicleListing(body);
  if (!validation.ok) {
    return Response.json(
      {
        error: "Check the highlighted listing details.",
        fieldErrors: validation.errors,
      },
      { status: 422 },
    );
  }

  const supabase = await createClient();

  try {
    const updated = await updateVehicleListing(
      supabase,
      id,
      validation.value,
      authContext.business.id,
    );

    return Response.json({ listing: updated });
  } catch (error) {
    console.error("Failed to update vehicle listing", error);
    const message =
      error instanceof Error ? error.message : "Failed to update listing.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/listings/[id]">,
) {
  const authContext = await getAuthContext().catch(() => null);
  if (!authContext) {
    return Response.json(
      { error: "Authentication required to delete listings." },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const supabase = await createClient();

  try {
    await deleteVehicleListing(supabase, id, authContext.business.id);
    return Response.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete listing.";
    const isConflict = message.includes("Cannot delete listing with");
    return Response.json(
      { error: message },
      { status: isConflict ? 409 : 500 },
    );
  }
}
