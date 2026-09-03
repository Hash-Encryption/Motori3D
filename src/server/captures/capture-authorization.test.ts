import { randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closeDatabase, getDatabase } from "../db/database";
import { createCapture, replaceCaptureFrames } from "./capture-repository";
import { createVehicleForBusiness } from "../vehicles/vehicle-repository";
import { GET as getFrameRoute } from "@/app/api/captures/[id]/frames/[index]/route";
import { GET as getCaptureRoute } from "@/app/api/captures/[id]/route";
import { POST as processCaptureRoute } from "@/app/api/captures/[id]/process/route";

describe("Local Capture & Frame Tenant Authorization Suite", () => {
  const testRunId = Math.random().toString(36).slice(2, 8);
  const businessAId = "11111111-1111-1111-1111-" + testRunId.padEnd(12, "0");
  const businessBId = "22222222-2222-2222-2222-" + testRunId.padEnd(12, "0");

  let vehicleAId: string;
  let vehicleBId: string;
  let captureAId: string;
  let captureBId: string;

  beforeAll(() => {
    process.env.SQLITE_DB_PATH = path.join("data", "test", `test-frame-auth-${testRunId}.sqlite`);
    process.env.STORAGE_ROOT = path.join("storage", "test", `test-frame-auth-${testRunId}`);
    closeDatabase();

    // Create Vehicle A (in Business A)
    const vA = createVehicleForBusiness(
      { name: "Car A", make: "Make A", model: "Model A", year: 2024, stockIdentifier: "STK-A" },
      businessAId,
    );
    vehicleAId = vA.id;

    // Create Vehicle B (in Business B)
    const vB = createVehicleForBusiness(
      { name: "Car B", make: "Make B", model: "Model B", year: 2024, stockIdentifier: "STK-B" },
      businessBId,
    );
    vehicleBId = vB.id;

    // Create Capture A & B
    captureAId = randomUUID();
    captureBId = randomUUID();

    createCapture({
      id: captureAId,
      vehicleId: vehicleAId,
      sourceVideoPath: "sourceA.mov",
      sourceFilename: "sourceA.mov",
      sourceMimeType: "video/quicktime",
      targetFrameCount: 36,
    });

    createCapture({
      id: captureBId,
      vehicleId: vehicleBId,
      sourceVideoPath: "sourceB.mov",
      sourceFilename: "sourceB.mov",
      sourceMimeType: "video/quicktime",
      targetFrameCount: 36,
    });

    // Create dummy frame files on disk
    const frameDirB = path.join(process.cwd(), process.env.STORAGE_ROOT, "framesB");
    mkdirSync(frameDirB, { recursive: true });
    const framePathB = path.join(frameDirB, "frame_000.webp");
    writeFileSync(framePathB, Buffer.from("fake-webp-data"));

    replaceCaptureFrames({
      captureId: captureBId,
      frameCount: 1,
      width: 1920,
      height: 1080,
      paths: [{ path: path.relative(path.join(process.cwd(), process.env.STORAGE_ROOT), framePathB), thumbnailPath: path.relative(path.join(process.cwd(), process.env.STORAGE_ROOT), framePathB) }],
    });
  });

  afterAll(() => {
    closeDatabase();
  });

  it("blocks unauthenticated user from accessing private capture frames (401)", async () => {
    const request = new Request("http://localhost/api/captures/" + captureBId + "/frames/0");
    const response = await getFrameRoute(request, {
      params: Promise.resolve({ id: captureBId, index: "0" }),
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("Authentication required");
  });

  it("blocks unauthenticated user from accessing capture metadata (401)", async () => {
    const request = new Request("http://localhost/api/captures/" + captureBId);
    const response = await getCaptureRoute(request, {
      params: Promise.resolve({ id: captureBId }),
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("Authentication required");
  });

  it("blocks unauthenticated user from triggering processing (401)", async () => {
    const request = new Request("http://localhost/api/captures/" + captureBId + "/process", {
      method: "POST",
    });
    const response = await processCaptureRoute(request, {
      params: Promise.resolve({ id: captureBId }),
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("Authentication required");
  });

  it("rejects invalid frame indices with 400 Bad Request", async () => {
    const request = new Request("http://localhost/api/captures/" + captureBId + "/frames/invalid");
    const response = await getFrameRoute(request, {
      params: Promise.resolve({ id: captureBId, index: "invalid" }),
    });

    expect(response.status).toBe(400);
  });

  it("returns 404 for non-existent captures", async () => {
    const fakeId = randomUUID();
    const request = new Request("http://localhost/api/captures/" + fakeId + "/frames/0");
    const response = await getFrameRoute(request, {
      params: Promise.resolve({ id: fakeId, index: "0" }),
    });

    expect(response.status).toBe(404);
  });

  describe("Published Capture Authorization Boundaries", () => {
    it("allows anonymous buyer to GET frame when vehicle is PUBLISHED (200)", async () => {
      const authModule = await import("@/server/auth/auth-context");
      const supabaseModule = await import("@/lib/supabase/server");
      const { vi } = await import("vitest");

      vi.spyOn(authModule, "getAuthContext").mockResolvedValue(null);
      vi.spyOn(supabaseModule, "createClient").mockResolvedValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { status: "PUBLISHED" }, error: null }),
            }),
          }),
        }),
      } as any);

      const request = new Request("http://localhost/api/captures/" + captureBId + "/frames/0");
      const response = await getFrameRoute(request, {
        params: Promise.resolve({ id: captureBId, index: "0" }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("image/webp");
      vi.restoreAllMocks();
    });

    it("DENIES anonymous user from POST /api/captures/[id]/process even if vehicle is PUBLISHED (401)", async () => {
      const authModule = await import("@/server/auth/auth-context");
      const { vi } = await import("vitest");

      vi.spyOn(authModule, "getAuthContext").mockResolvedValue(null);

      const request = new Request("http://localhost/api/captures/" + captureBId + "/process", {
        method: "POST",
      });
      const response = await processCaptureRoute(request, {
        params: Promise.resolve({ id: captureBId }),
      });

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toContain("Authentication required");
      vi.restoreAllMocks();
    });

    it("DENIES Client A from POST /api/captures/[id]/process on Client B PUBLISHED capture (403)", async () => {
      const authModule = await import("@/server/auth/auth-context");
      const { vi } = await import("vitest");

      vi.spyOn(authModule, "getAuthContext").mockResolvedValue({
        user: { id: "user-a", email: "dealer.a@test.local" } as any,
        business: { id: businessAId, name: "Business A", slug: "ba" },
        membership: { id: "m-a", role: "DEALER_ADMIN", status: "ACTIVE" },
        allMemberships: [{ id: "m-a", businessId: businessAId, role: "DEALER_ADMIN", status: "ACTIVE" }],
        isSuperAdmin: false,
      });

      const request = new Request("http://localhost/api/captures/" + captureBId + "/process", {
        method: "POST",
      });
      const response = await processCaptureRoute(request, {
        params: Promise.resolve({ id: captureBId }),
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toContain("Access denied");
      vi.restoreAllMocks();
    });

    it("ALLOWS authorized Client B employee to POST /api/captures/[id]/process (Authorized)", async () => {
      const authModule = await import("@/server/auth/auth-context");
      const { vi } = await import("vitest");

      vi.spyOn(authModule, "getAuthContext").mockResolvedValue({
        user: { id: "user-b", email: "dealer.b@test.local" } as any,
        business: { id: businessBId, name: "Business B", slug: "bb" },
        membership: { id: "m-b", role: "DEALER_ADMIN", status: "ACTIVE" },
        allMemberships: [{ id: "m-b", businessId: businessBId, role: "DEALER_ADMIN", status: "ACTIVE" }],
        isSuperAdmin: false,
      });

      const request = new Request("http://localhost/api/captures/" + captureBId + "/process", {
        method: "POST",
      });
      const response = await processCaptureRoute(request, {
        params: Promise.resolve({ id: captureBId }),
      });

      // Status is 422 because dummy video file is not on disk, but NOT 401 or 403 (Authorization passed!)
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
      vi.restoreAllMocks();
    });

    it("ALLOWS SUPER_ADMIN to POST /api/captures/[id]/process across dealerships (Authorized)", async () => {
      const authModule = await import("@/server/auth/auth-context");
      const { vi } = await import("vitest");

      vi.spyOn(authModule, "getAuthContext").mockResolvedValue({
        user: { id: "user-sa", email: "admin@platform.local" } as any,
        business: { id: businessAId, name: "Platform Admin", slug: "sa" },
        membership: { id: "m-sa", role: "DEALER_ADMIN", status: "ACTIVE" },
        allMemberships: [{ id: "m-sa", businessId: businessAId, role: "DEALER_ADMIN", status: "ACTIVE" }],
        isSuperAdmin: true,
      });

      const request = new Request("http://localhost/api/captures/" + captureBId + "/process", {
        method: "POST",
      });
      const response = await processCaptureRoute(request, {
        params: Promise.resolve({ id: captureBId }),
      });

      // Authorization passed for Super Admin
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
      vi.restoreAllMocks();
    });

    it("DENIES anonymous GET on /api/captures/[id] metadata even if vehicle is published (401)", async () => {
      const authModule = await import("@/server/auth/auth-context");
      const { vi } = await import("vitest");

      vi.spyOn(authModule, "getAuthContext").mockResolvedValue(null);

      const request = new Request("http://localhost/api/captures/" + captureBId);
      const response = await getCaptureRoute(request, {
        params: Promise.resolve({ id: captureBId }),
      });

      expect(response.status).toBe(401);
      vi.restoreAllMocks();
    });
  });
});
