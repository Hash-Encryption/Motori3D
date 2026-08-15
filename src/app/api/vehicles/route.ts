import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/server/auth/auth-context";
import {
  createInventoryVehicle,
  listInventoryVehicles,
} from "@/server/vehicles/inventory-repository";
import type { VehicleLifecycleStatus } from "@/server/vehicles/inventory-types";
import { validateCreateInventoryVehicle } from "@/server/vehicles/vehicle-validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authContext = await getAuthContext().catch(() => null);

  if (!authContext) {
    return Response.json(
      { error: "Authentication required to access dealership inventory." },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || undefined;
  const rawStatus = searchParams.get("status")?.toUpperCase();
  const status = ["DRAFT", "PUBLISHED", "SOLD"].includes(rawStatus ?? "")
    ? (rawStatus as VehicleLifecycleStatus)
    : undefined;

  const supabase = await createClient();

  try {
    const vehicles = await listInventoryVehicles(
      supabase,
      authContext.business.id,
      { query, status },
    );

    return Response.json({
      vehicles,
      business: {
        id: authContext.business.id,
        name: authContext.business.name,
      },
    });
  } catch (error) {
    console.error("Failed to list inventory vehicles", error);
    return Response.json(
      { error: "Failed to load vehicle inventory." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authContext = await getAuthContext().catch(() => null);

  if (!authContext) {
    return Response.json(
      { error: "Authentication required to create inventory vehicles." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  // Attempting to supply a different business_id in the body is explicitly rejected / ignored
  // Tenant ownership is authoritative from the verified server authContext
  const validation = validateCreateInventoryVehicle(body);
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
    const vehicle = await createInventoryVehicle(
      supabase,
      validation.value,
      authContext.business.id,
    );

    return Response.json({ vehicle }, { status: 201 });
  } catch (error) {
    console.error("Failed to create inventory vehicle", error);
    const message =
      error instanceof Error ? error.message : "The vehicle could not be saved.";
    return Response.json({ error: message }, { status: 500 });
  }
}
