import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/server/auth/auth-context";
import {
  createVehicleListingWithUnit,
  listVehicleListings,
} from "@/server/vehicles/inventory-repository";
import type { ListingPublicationStatus } from "@/server/vehicles/inventory-types";
import { validateCreateListingWithUnit } from "@/server/vehicles/vehicle-validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authContext = await getAuthContext().catch(() => null);

  if (!authContext) {
    return Response.json(
      { error: "Authentication required to access dealership listings." },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || undefined;
  const rawStatus = searchParams.get("status")?.toUpperCase();
  const status = ["DRAFT", "PUBLISHED", "ARCHIVED", "ALL"].includes(rawStatus ?? "")
    ? (rawStatus as ListingPublicationStatus | "ALL")
    : undefined;

  const supabase = await createClient();

  try {
    const listings = await listVehicleListings(
      supabase,
      authContext.business.id,
      { query, status },
    );

    return Response.json({
      listings,
      business: {
        id: authContext.business.id,
        name: authContext.business.name,
      },
    });
  } catch (error) {
    console.error("Failed to list vehicle listings", error);
    return Response.json(
      { error: "Failed to load vehicle listings." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authContext = await getAuthContext().catch(() => null);

  if (!authContext) {
    return Response.json(
      { error: "Authentication required to create vehicle listings." },
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

  const validation = validateCreateListingWithUnit(body);
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
    const result = await createVehicleListingWithUnit(
      supabase,
      validation.value,
      authContext.business.id,
    );

    return Response.json(result, { status: 201 });
  } catch (error) {
    console.error("Failed to create vehicle listing with unit", error);
    const message =
      error instanceof Error ? error.message : "The vehicle listing could not be saved.";
    return Response.json({ error: message }, { status: 500 });
  }
}
