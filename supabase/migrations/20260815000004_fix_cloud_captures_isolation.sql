-- ==============================================================================
-- Vehicle 360 — Phase 04: Cloud Capture Tenant Isolation Migration
-- 20260815000004_fix_cloud_captures_isolation.sql
-- ==============================================================================

-- 1. Replace overly permissive SELECT policy on cloud_captures
DROP POLICY IF EXISTS "Public read cloud_captures" ON public.cloud_captures;
DROP POLICY IF EXISTS "Tenant and published read cloud_captures" ON public.cloud_captures;

CREATE POLICY "Tenant and published read cloud_captures"
ON public.cloud_captures
FOR SELECT
USING (
  public.is_business_member(business_id)
  OR public.is_super_admin()
  OR EXISTS (
    SELECT 1 FROM public.vehicles
    WHERE vehicles.id = cloud_captures.vehicle_id
      AND vehicles.status = 'PUBLISHED'
  )
);

-- 2. Replace overly permissive SELECT policy on cloud_capture_frames
DROP POLICY IF EXISTS "Public read cloud_capture_frames" ON public.cloud_capture_frames;
DROP POLICY IF EXISTS "Tenant and published read cloud_capture_frames" ON public.cloud_capture_frames;

CREATE POLICY "Tenant and published read cloud_capture_frames"
ON public.cloud_capture_frames
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.cloud_captures
    WHERE cloud_captures.id = cloud_capture_frames.capture_id
      AND (
        public.is_business_member(cloud_captures.business_id)
        OR public.is_super_admin()
        OR EXISTS (
          SELECT 1 FROM public.vehicles
          WHERE vehicles.id = cloud_captures.vehicle_id
            AND vehicles.status = 'PUBLISHED'
        )
      )
  )
);

-- 3. Add UPDATE policies (previously missing)
DROP POLICY IF EXISTS "Dealers can update cloud_captures" ON public.cloud_captures;
CREATE POLICY "Dealers can update cloud_captures"
ON public.cloud_captures
FOR UPDATE
TO authenticated
USING (public.is_business_member(business_id))
WITH CHECK (public.is_business_member(business_id));

DROP POLICY IF EXISTS "Dealers can update cloud_capture_frames" ON public.cloud_capture_frames;
CREATE POLICY "Dealers can update cloud_capture_frames"
ON public.cloud_capture_frames
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cloud_captures
    WHERE cloud_captures.id = cloud_capture_frames.capture_id
      AND public.is_business_member(cloud_captures.business_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cloud_captures
    WHERE cloud_captures.id = cloud_capture_frames.capture_id
      AND public.is_business_member(cloud_captures.business_id)
  )
);
