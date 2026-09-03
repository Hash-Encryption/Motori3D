import { getCapture } from "@/server/captures/capture-repository";
import { getAuthContext } from "@/server/auth/auth-context";
import { getVehicle } from "@/server/vehicles/vehicle-repository";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/captures/[id]">,
) {
  const { id } = await context.params;
  const capture = getCapture(id);
  if (!capture) {
    return Response.json({ error: "Capture not found." }, { status: 404 });
  }

  const vehicle = getVehicle(capture.vehicleId);
  if (vehicle?.businessId) {
    const authContext = await getAuthContext().catch(() => null);
    const isMember = authContext?.allMemberships.some(
      (m) => m.businessId === vehicle.businessId,
    );
    const isSuperAdmin = authContext?.isSuperAdmin;

    if (!isMember && !isSuperAdmin) {
      if (!authContext) {
        return Response.json(
          { error: "Authentication required to access capture details." },
          { status: 401 },
        );
      }
      return Response.json(
        { error: "Access denied. You do not have permission to view captures for this dealership." },
        { status: 403 },
      );
    }
  } else {
    // Unassigned legacy captures cannot be read anonymously in production
    const authContext = await getAuthContext().catch(() => null);
    if (!authContext && process.env.NODE_ENV === "production") {
      return Response.json(
        { error: "Authentication required to access capture details." },
        { status: 401 },
      );
    }
  }

  return Response.json({ capture });
}
