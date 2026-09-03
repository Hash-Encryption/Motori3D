-- ==============================================================================
-- Vehicle 360 — Phase 04: Super Admin Foundation Migration
-- 20260815000003_phase04_super_admin_foundation.sql
-- ==============================================================================

-- 1. Super Admins Table
-- Stored in dedicated table separate from tenant memberships and profiles.
CREATE TABLE IF NOT EXISTS public.super_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- 2. RLS: Authenticated users can only view their own super admin status
DROP POLICY IF EXISTS "Super admins can view super admin status" ON public.super_admins;
CREATE POLICY "Super admins can view super admin status"
ON public.super_admins FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- CRITICAL SECURITY INVARIANT:
-- NO INSERT, UPDATE, OR DELETE POLICIES FOR AUTHENTICATED USERS!
-- Ordinary users CANNOT grant themselves Super Admin status (zero privilege escalation).
-- Only service role / database administrator can assign Super Admin status.

-- 3. Security Definer Helper Function for RLS
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.super_admins
    WHERE user_id = auth.uid()
  );
$$;

-- 4. Cross-Tenant Platform Visibility for Super Admins
DROP POLICY IF EXISTS "Super admins can view all businesses" ON public.businesses;
CREATE POLICY "Super admins can view all businesses"
ON public.businesses FOR SELECT TO authenticated
USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins can view all vehicles" ON public.vehicles;
CREATE POLICY "Super admins can view all vehicles"
ON public.vehicles FOR SELECT TO authenticated
USING (public.is_super_admin());
