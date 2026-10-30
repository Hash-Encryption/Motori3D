import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SpinViewer } from "@/components/spin-viewer";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/server/auth/auth-context";
import {
  getLatestCloudCaptureForVehicle,
  getCloudCaptureFrameUrls,
} from "@/server/captures/cloud-capture-repository";
import {
  getLatestCaptureForVehicle,
  listCaptureFrames,
} from "@/server/captures/capture-repository";
import { getInventoryVehicle } from "@/server/vehicles/inventory-repository";
import { getVehicle } from "@/server/vehicles/vehicle-repository";

export const metadata = {
  title: "360 viewer",
};

export const dynamic = "force-dynamic";

export default async function ViewerPage(props: PageProps<"/vehicles/[id]/viewer">) {
  const { id } = await props.params;

  let vehicle: {
    id: string;
    name: string;
    make?: string | null;
    model?: string | null;
    year?: number | null;
    businessId?: string | null;
    status?: string | null;
  } | null = null;

  const authContext = await getAuthContext().catch(() => null);

  // 1. Check Supabase inventory first if authenticated
  if (authContext) {
    try {
      const supabase = await createClient();
      const inventoryVehicle = await getInventoryVehicle(
        supabase,
        id,
        authContext.business.id,
      );
      if (inventoryVehicle) {
        vehicle = {
          id: inventoryVehicle.id,
          name: `${inventoryVehicle.year} ${inventoryVehicle.make} ${inventoryVehicle.model}`,
          make: inventoryVehicle.make,
          model: inventoryVehicle.model,
          year: inventoryVehicle.year,
          businessId: inventoryVehicle.businessId,
          status: inventoryVehicle.status,
        };
      }
    } catch {
      // Continue to local lookup
    }
  }

  // 2. Fallback to local SQLite database if not found in Supabase
  if (!vehicle) {
    try {
      const localVehicle = getVehicle(id);
      if (localVehicle) {
        vehicle = {
          ...localVehicle,
          status: "status" in localVehicle && typeof (localVehicle as Record<string, unknown>).status === "string"
            ? ((localVehicle as Record<string, unknown>).status as string)
            : "DRAFT",
        };
      }
    } catch {
      // Ignored if SQLite is unavailable on edge
    }
  }

  // 3. Fallback: Query Supabase server-side for remote or anonymous public viewing
  if (!vehicle) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();
      const { data: v } = await admin
        .from("vehicles")
        .select("id, make, model, year, business_id, status")
        .eq("id", id)
        .maybeSingle();

      if (v) {
        vehicle = {
          id: v.id,
          name: `${v.year} ${v.make} ${v.model}`,
          make: v.make,
          model: v.model,
          year: v.year,
          businessId: v.business_id,
          status: v.status,
        };
      } else {
        // Also check if id is a vehicle listing ID
        const { data: l } = await admin
          .from("vehicle_listings")
          .select("id, make, model, year, business_id, status")
          .eq("id", id)
          .maybeSingle();

        if (l) {
          // Find first published physical unit attached to this listing
          const { data: unit } = await admin
            .from("vehicles")
            .select("id, make, model, year, business_id, status")
            .eq("listing_id", l.id)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (unit) {
            vehicle = {
              id: unit.id,
              name: `${l.year} ${l.make} ${l.model}`,
              make: l.make,
              model: l.model,
              year: l.year,
              businessId: l.business_id,
              status: l.status === "PUBLISHED" && unit.status === "PUBLISHED" ? "PUBLISHED" : unit.status,
            };
          }
        }
      }
    } catch {
      // Ignored if admin client not configured
    }
  }

  if (!vehicle) {
    notFound();
  }

  // Tenant security boundary:
  // - Dealership members of this vehicle can view
  // - Super Admins can view
  // - Public anonymous users can view ONLY IF the vehicle is PUBLISHED
  if (vehicle.businessId) {
    const isMember =
      authContext &&
      authContext.allMemberships.some((m) => m.businessId === vehicle.businessId);
    const isSuperAdmin = authContext?.isSuperAdmin;
    const isPublished = vehicle.status === "PUBLISHED";

    if (!isMember && !isSuperAdmin && !isPublished) {
      if (!authContext) {
        redirect("/auth/sign-in");
      }
      notFound();
    }
  }

  // 1. Check Cloud 360 Spin Captures first (query with server Supabase client)
  let frameUrls: string[] = [];
  let spinWidth = 1920;
  let spinHeight = 1080;
  let captureId = vehicle.id;

  try {
    const supabase = await createClient();
    const targetBusinessId = vehicle.businessId || authContext?.business.id;
    const cloudCapture = await getLatestCloudCaptureForVehicle(supabase, vehicle.id, targetBusinessId ?? undefined);
    if (cloudCapture && (cloudCapture.status === "READY" || cloudCapture.status === "PROCESSING")) {
      captureId = cloudCapture.id;
      spinWidth = cloudCapture.width || 1920;
      spinHeight = cloudCapture.height || 1080;

      frameUrls = await getCloudCaptureFrameUrls(
        supabase,
        cloudCapture.id,
        targetBusinessId ?? undefined,
      );
      if (frameUrls.length === 0) {
        // Construct canonical storage URLs directly
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (!supabaseUrl) {
          throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable.");
        }
        const bId =
          cloudCapture.business_id || vehicle.businessId || "default-dealership";
        frameUrls = Array.from({ length: cloudCapture.frame_count || 48 }).map(
          (_, i) =>
            `${supabaseUrl}/storage/v1/object/public/vehicle-spins/${bId}/${vehicle.id}/${cloudCapture.id}/frame_${String(i).padStart(3, "0")}.webp`,
        );
      }
    }
    // Fallback: Scan Supabase Storage bucket directly if database record was not yet returned
    if (frameUrls.length === 0) {
      const bId = vehicle.businessId || "public";
      const folderPath = `${bId}/${vehicle.id}`;
      const { data: captureFolders } = await supabase.storage
        .from("vehicle-spins")
        .list(folderPath);

      if (captureFolders && captureFolders.length > 0) {
        // Find most recent subfolder
        const latestFolder = captureFolders[captureFolders.length - 1]?.name;
        if (latestFolder) {
          const { data: frameFiles } = await supabase.storage
            .from("vehicle-spins")
            .list(`${folderPath}/${latestFolder}`);

          if (frameFiles && frameFiles.length > 0) {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            if (!supabaseUrl) {
              throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable.");
            }
            frameUrls = frameFiles
              .filter((f) => f.name.endsWith(".webp"))
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(
                (f) =>
                  `${supabaseUrl}/storage/v1/object/public/vehicle-spins/${folderPath}/${latestFolder}/${f.name}`,
              );
          }
        }
      }
    }
  } catch (err) {
    console.warn("Cloud capture retrieval note:", err);
  }

  // 2. Fallback to local capture frames if no cloud frames
  if (frameUrls.length === 0) {
    try {
      const localCapture = getLatestCaptureForVehicle(id);
      if (localCapture && localCapture.status === "READY") {
        captureId = localCapture.id;
        const localFrames = listCaptureFrames(localCapture.id);
        if (localFrames.length > 0) {
          spinWidth = localFrames[0].width;
          spinHeight = localFrames[0].height;
          frameUrls = localFrames.map(
            (frame) => `/api/captures/${localCapture.id}/frames/${frame.frameIndex}`,
          );
        }
      }
    } catch {
      // Ignored
    }
  }

  const isReady = frameUrls.length > 0;

  return (
    <AppShell>
      <section className="page-heading viewer-heading">
        <div>
          <p className="eyebrow">Interactive 360 Spin Asset</p>
          <h1>{vehicle.name}</h1>
          <p className="page-description">
            Swipe or drag horizontally to rotate the vehicle. Pinch or double-click to zoom.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link className="button button-secondary" href={`/vehicles/${vehicle.id}`}>
            Vehicle Details
          </Link>
          <Link className="button button-secondary" href="/">
            Inventory
          </Link>
        </div>
      </section>

      {isReady ? (
        <SpinViewer
          captureId={captureId}
          vehicleName={vehicle.name}
          frameUrls={frameUrls}
          width={spinWidth}
          height={spinHeight}
        />
      ) : (
        <section className="panel">
          <div className="viewer-placeholder">
            <div>
              <h2>No 360 Spin Available</h2>
              <p>Upload a walkaround video to generate an interactive 360 turntable.</p>
            </div>
          </div>
          <div className="form-actions">
            <Link className="button button-primary" href={`/vehicles/${vehicle.id}/processing`}>
              Open 360 Processing
            </Link>
          </div>
        </section>
      )}
    </AppShell>
  );
}
