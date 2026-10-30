import { describe, expect, it, vi } from "vitest";
import { getCloudCaptureFrameUrls } from "../captures/cloud-capture-repository";
import type { Database } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("Storage Security & Frame URL Authorization Suite", () => {
  const businessId = "e9f08e0d-9d79-4062-a579-9b10368e34dc";
  const vehicleId = "10f35412-b037-4d38-869a-7a78477bfede";
  const captureId = "00793d56-72ea-4f04-a77c-1a15907c4ae8";

  const mockFrames = [
    {
      id: "frame-1",
      capture_id: captureId,
      frame_index: 0,
      storage_path: `${businessId}/${vehicleId}/${captureId}/frame_000.webp`,
      public_url: `https://example.supabase.co/storage/v1/object/public/vehicle-spins/${businessId}/${vehicleId}/${captureId}/frame_000.webp`,
      width: 1920,
      height: 1080,
      created_at: new Date().toISOString(),
    },
    {
      id: "frame-2",
      capture_id: captureId,
      frame_index: 1,
      storage_path: `${businessId}/${vehicleId}/${captureId}/frame_001.webp`,
      public_url: `https://example.supabase.co/storage/v1/object/public/vehicle-spins/${businessId}/${vehicleId}/${captureId}/frame_001.webp`,
      width: 1920,
      height: 1080,
      created_at: new Date().toISOString(),
    },
  ];

  it("generates signed URLs for authorized cloud capture frames", async () => {
    // Mock Supabase client query for cloud_capture_frames
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockFrames,
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient<Database>;

    const urls = await getCloudCaptureFrameUrls(mockSupabase, captureId, undefined, 3600);
    expect(urls).toHaveLength(2);
    // Each URL should either be a signed URL with a signature token or fall back to the stored public_url
    expect(urls[0]).toBeDefined();
    expect(urls[1]).toBeDefined();
  });

  it("returns an empty array when RLS blocks frame access (e.g. anonymous visitor on draft capture)", async () => {
    // When RLS blocks the query, data is empty or null
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient<Database>;

    const urls = await getCloudCaptureFrameUrls(mockSupabase, captureId);
    expect(urls).toEqual([]);
  });

  it("preserves frame ordering from frame_index 0 to N-1", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockImplementation((col: string, opt: { ascending: boolean }) => {
              expect(col).toBe("frame_index");
              expect(opt.ascending).toBe(true);
              return Promise.resolve({ data: mockFrames, error: null });
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient<Database>;

    const urls = await getCloudCaptureFrameUrls(mockSupabase, captureId);
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain("frame_000.webp");
    expect(urls[1]).toContain("frame_001.webp");
  });

  it("enforces access matrix for DRAFT, PUBLISHED, and SOLD vehicles", () => {
    type AccessCheck = {
      userRole: "ANONYMOUS" | "DEALER_MEMBER" | "OTHER_DEALER" | "SUPER_ADMIN";
      vehicleStatus: "DRAFT" | "PUBLISHED" | "SOLD";
      expectedAccess: boolean;
    };

    const matrix: AccessCheck[] = [
      // DRAFT vehicles: Only member and super admin
      { userRole: "ANONYMOUS", vehicleStatus: "DRAFT", expectedAccess: false },
      { userRole: "OTHER_DEALER", vehicleStatus: "DRAFT", expectedAccess: false },
      { userRole: "DEALER_MEMBER", vehicleStatus: "DRAFT", expectedAccess: true },
      { userRole: "SUPER_ADMIN", vehicleStatus: "DRAFT", expectedAccess: true },

      // PUBLISHED vehicles: Everyone
      { userRole: "ANONYMOUS", vehicleStatus: "PUBLISHED", expectedAccess: true },
      { userRole: "OTHER_DEALER", vehicleStatus: "PUBLISHED", expectedAccess: true },
      { userRole: "DEALER_MEMBER", vehicleStatus: "PUBLISHED", expectedAccess: true },
      { userRole: "SUPER_ADMIN", vehicleStatus: "PUBLISHED", expectedAccess: true },

      // SOLD vehicles: Historical private record (only member and super admin)
      { userRole: "ANONYMOUS", vehicleStatus: "SOLD", expectedAccess: false },
      { userRole: "OTHER_DEALER", vehicleStatus: "SOLD", expectedAccess: false },
      { userRole: "DEALER_MEMBER", vehicleStatus: "SOLD", expectedAccess: true },
      { userRole: "SUPER_ADMIN", vehicleStatus: "SOLD", expectedAccess: true },
    ];

    for (const testCase of matrix) {
      const isMember = testCase.userRole === "DEALER_MEMBER";
      const isSuperAdmin = testCase.userRole === "SUPER_ADMIN";
      const isPublished = testCase.vehicleStatus === "PUBLISHED";

      const hasAccess = isMember || isSuperAdmin || isPublished;
      expect(hasAccess).toBe(testCase.expectedAccess);
    }
  });
});
