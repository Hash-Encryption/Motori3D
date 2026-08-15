import { createVehicle, listVehicles } from "@/server/vehicles/vehicle-repository";
import { validateCreateVehicle } from "@/server/vehicles/vehicle-validation";

export const runtime = "nodejs";

export function GET() {
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

  try {
    const vehicle = createVehicle(validation.value);
    return Response.json({ vehicle }, { status: 201 });
  } catch (error) {
    console.error("Failed to create vehicle", error);
    return Response.json(
      { error: "The vehicle could not be saved. Try again." },
      { status: 500 },
    );
  }
}
