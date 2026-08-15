import { getAuthContext } from "@/server/auth/auth-context";
import {
  createVehicle,
  createVehicleForBusiness,
  listVehicles,
  listVehiclesForBusiness,
} from "@/server/vehicles/vehicle-repository";
import { validateCreateVehicle } from "@/server/vehicles/vehicle-validation";

export const runtime = "nodejs";

export async function GET() {
  const authContext = await getAuthContext().catch(() => null);

  if (authContext) {
    return Response.json({
      vehicles: listVehiclesForBusiness(authContext.business.id),
      business: {
        id: authContext.business.id,
        name: authContext.business.name,
      },
    });
  }

  // Fallback to legacy unassigned vehicles for local test / prototype pipelines
  return Response.json({ vehicles: listVehicles() });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const validation = validateCreateVehicle(body);
  if (!validation.ok) {
    return Response.json(
      {
        error: "Check the highlighted vehicle details.",
        fieldErrors: validation.errors,
      },
      { status: 422 },
    );
  }

  const authContext = await getAuthContext().catch(() => null);

  try {
    const vehicle = authContext
      ? createVehicleForBusiness(validation.value, authContext.business.id)
      : createVehicle(validation.value);

    return Response.json({ vehicle }, { status: 201 });
  } catch (error) {
    console.error("Failed to create vehicle", error);
    return Response.json(
      { error: "The vehicle could not be saved. Try again." },
      { status: 500 },
    );
  }
}
