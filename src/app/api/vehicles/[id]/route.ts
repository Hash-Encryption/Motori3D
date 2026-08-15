import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/server/auth/auth-context";
import {
  deleteInventoryVehicle,
  getInventoryVehicle,
  updateInventoryVehicle,
} from "@/server/vehicles/inventory-repository";
import { validateUpdateInventoryVehicle } from "@/server/vehicles/vehicle-validation";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/vehicles/[id]">,
) {
  const authContext = await getAuthContext().catch(() => null);
  if (!authContext) {
    return Response.json(
      { error: "Authentication required to access vehicle details." },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const supabase = await createClient();

  try {
    const vehicle = await getInventoryVehicle(
      supabase,
      id,
      authContext.business.id,
    );

    if (!vehicle) {
      return Response.json({ error: "Vehicle not found." }, { status: 404 });
    }

    return Response.json({ vehicle });
  } catch (error) {
    console.error("Failed to get vehicle", error);
    return Response.json(
      { error: "Failed to load vehicle details." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/vehicles/[id]">,
) {
  const authContext = await getAuthContext().catch(() => null);
  if (!authContext) {
    return Response.json(
      { error: "Authentication required to update vehicles." },
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
        { error: "Vehicle ID is immutable and cannot be changed." },
        { status: 400 },
      );
    }
    if (
      candidate.business_id !== undefined ||
      candidate.businessId !== undefined
    ) {
      const targetBiz = candidate.business_id ?? candidate.businessId;
      if (targetBiz !== authContext.business.id) {
        return Response.json(
          { error: "Vehicle business ownership is immutable and cannot be transferred." },
          { status: 400 },
        );
      }
    }
  }

  const validation = validateUpdateInventoryVehicle(body);
  if (!validation.ok) {
    return Response.json(
      {
        error: "Check the highlighted vehicle details.",
        fieldErrors: validation.errors,
      },
      { status: 422 },
    );
  }

  const supabase = await createClient();

  try {
    const updated = await updateInventoryVehicle(
      supabase,
      id,
      validation.value,
      authContext.business.id,
    );

    return Response.json({ vehicle: updated });
  } catch (error) {
    console.error("Failed to update vehicle", error);
    const message =
      error instanceof Error ? error.message : "Failed to update vehicle.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/vehicles/[id]">,
) {
  const authContext = await getAuthContext().catch(() => null);
  if (!authContext) {
    return Response.json(
      { error: "Authentication required to delete vehicles." },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const supabase = await createClient();

  try {
    await deleteInventoryVehicle(supabase, id, authContext.business.id);
    return Response.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete vehicle.";
    const isConflict = message.includes("Cannot delete vehicle with attached captures");
    return Response.json(
      { error: message },
      { status: isConflict ? 409 : 500 },
    );
  }
}
