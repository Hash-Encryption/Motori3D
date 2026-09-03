import { readFile } from "node:fs/promises";

import { getCapture, getCaptureFrame } from "@/server/captures/capture-repository";
import { resolveStoredPath } from "@/server/storage/local-storage";
import { getAuthContext } from "@/server/auth/auth-context";
import { getVehicle } from "@/server/vehicles/vehicle-repository";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: RouteContext<"/api/captures/[id]/frames/[index]">,
) {
  const { id, index: indexText } = await context.params;
  const index = Number(indexText);
  if (!Number.isInteger(index) || index < 0) {
    return Response.json({ error: "Invalid frame index." }, { status: 400 });
  }

  const capture = getCapture(id);
  if (!capture) {
    return Response.json({ error: "Capture not found." }, { status: 404 });
  }

  const frame = getCaptureFrame(id, index);
  if (!frame) {
    return Response.json({ error: "Frame not found." }, { status: 404 });
  }

  // Tenant Authorization: Authenticated User -> Dealership Membership -> Capture -> Vehicle -> business_id -> Frame
  const vehicle = getVehicle(capture.vehicleId);
  if (vehicle?.businessId) {
    const authContext = await getAuthContext().catch(() => null);
    const isMember = authContext?.allMemberships.some(
      (m) => m.businessId === vehicle.businessId,
    );
    const isSuperAdmin = authContext?.isSuperAdmin;

    if (!isMember && !isSuperAdmin) {
      // Check if vehicle is public published
      let isPublished = false;
      try {
        const { createClient } = await import("@/lib/supabase/server");
        const supabase = await createClient();
        const { data: inv } = await supabase
          .from("vehicles")
          .select("status")
          .eq("id", vehicle.id)
          .maybeSingle();
        if (inv?.status === "PUBLISHED") {
          isPublished = true;
        }
      } catch {
        isPublished = false;
      }

      if (!isPublished) {
        if (!authContext) {
          return Response.json(
            { error: "Authentication required to access private vehicle capture frames." },
            { status: 401 },
          );
        }
        return Response.json(
          { error: "Access denied. You do not have permission to view private capture frames for this dealership." },
          { status: 403 },
        );
      }
    }
  }

  const useThumbnail = new URL(request.url).searchParams.get("thumb") === "1";
  const storedPath = useThumbnail ? frame.thumbnailPath : frame.path;
  const resolved = resolveStoredPath(storedPath);

  try {
    const image = await readFile(resolved.absolutePath);
    return new Response(image, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(image.byteLength),
      },
    });
  } catch (error) {
    console.error("Failed to read processed frame", { id, index, error });
    return Response.json({ error: "Processed frame file is unavailable." }, { status: 404 });
  }
}
