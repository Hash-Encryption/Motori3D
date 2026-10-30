-- ==============================================================================
-- Vehicle 360 — Phase 04: Cloud Capture Tenant Isolation Migration
-- 20260815000004_fix_cloud_captures_isolation.sql
-- ==============================================================================

-- 1. Narrowly scoped SECURITY DEFINER helper to check published status
-- Bypasses caller RLS on public.vehicles solely to return a boolean published state.
CREATE OR REPLACE FUNCTION public.is_vehicle_published(target_vehicle_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vehicles
    WHERE id = target_vehicle_id
      AND status = 'PUBLISHED'
  );
$$;

-- Explicitly revoke from PUBLIC and grant solely to roles needing evaluation
REVOKE EXECUTE ON FUNCTION public.is_vehicle_published(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_vehicle_published(UUID) TO anon, authenticated;

-- 2. Replace overly permissive SELECT policy on cloud_captures
DROP POLICY IF EXISTS "Public read cloud_captures" ON public.cloud_captures;
DROP POLICY IF EXISTS "Tenant and published read cloud_captures" ON public.cloud_captures;

CREATE POLICY "Tenant and published read cloud_captures"
ON public.cloud_captures
FOR SELECT
USING (
  public.is_business_member(business_id)
  OR public.is_super_admin()
  OR public.is_vehicle_published(vehicle_id)
);

-- 3. Replace overly permissive SELECT policy on cloud_capture_frames
-- Delegates access through parent cloud_captures RLS policy
DROP POLICY IF EXISTS "Public read cloud_capture_frames" ON public.cloud_capture_frames;
DROP POLICY IF EXISTS "Tenant and published read cloud_capture_frames" ON public.cloud_capture_frames;

CREATE POLICY "Tenant and published read cloud_capture_frames"
ON public.cloud_capture_frames
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.cloud_captures
    WHERE cloud_captures.id = cloud_capture_frames.capture_id
  )
);

-- 4. Add UPDATE policies (previously missing)
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
