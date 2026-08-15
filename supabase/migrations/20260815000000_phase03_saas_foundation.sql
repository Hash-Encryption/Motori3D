-- ==============================================================================
-- Vehicle 360 — Phase 03: SaaS Foundation Migration
-- 20260815000000_phase03_saas_foundation.sql
-- ==============================================================================

-- 1. Profiles Table (linked 1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Businesses (Dealerships) Table
CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- 3. Business Memberships Table
CREATE TABLE IF NOT EXISTS public.business_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('DEALER_ADMIN', 'DEALER_MEMBER')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (business_id, user_id)
);

CREATE INDEX IF NOT EXISTS business_memberships_business_id_idx ON public.business_memberships(business_id);
CREATE INDEX IF NOT EXISTS business_memberships_user_id_idx ON public.business_memberships(user_id);

ALTER TABLE public.business_memberships ENABLE ROW LEVEL SECURITY;

-- 4. Non-Recursive Security Definer Helper Functions
CREATE OR REPLACE FUNCTION public.is_business_member(target_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_memberships
    WHERE business_id = target_business_id
      AND user_id = auth.uid()
      AND status = 'ACTIVE'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_business_admin(target_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_memberships
    WHERE business_id = target_business_id
      AND user_id = auth.uid()
      AND role = 'DEALER_ADMIN'
      AND status = 'ACTIVE'
  );
$$;

-- 5. Row Level Security Policies

-- Profiles Policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

-- Businesses Policies
DROP POLICY IF EXISTS "Members can view their businesses" ON public.businesses;
CREATE POLICY "Members can view their businesses"
ON public.businesses FOR SELECT TO authenticated
USING (public.is_business_member(id));

DROP POLICY IF EXISTS "Dealer admins can update their business" ON public.businesses;
CREATE POLICY "Dealer admins can update their business"
ON public.businesses FOR UPDATE TO authenticated
USING (public.is_business_admin(id))
WITH CHECK (public.is_business_admin(id));

-- Memberships Policies
DROP POLICY IF EXISTS "Users can view memberships in their businesses" ON public.business_memberships;
CREATE POLICY "Users can view memberships in their businesses"
ON public.business_memberships FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_business_member(business_id));

DROP POLICY IF EXISTS "Dealer admins can insert memberships" ON public.business_memberships;
CREATE POLICY "Dealer admins can insert memberships"
ON public.business_memberships FOR INSERT TO authenticated
WITH CHECK (public.is_business_admin(business_id));

DROP POLICY IF EXISTS "Dealer admins can update memberships" ON public.business_memberships;
CREATE POLICY "Dealer admins can update memberships"
ON public.business_memberships FOR UPDATE TO authenticated
USING (public.is_business_admin(business_id))
WITH CHECK (public.is_business_admin(business_id));

DROP POLICY IF EXISTS "Dealer admins can delete memberships" ON public.business_memberships;
CREATE POLICY "Dealer admins can delete memberships"
ON public.business_memberships FOR DELETE TO authenticated
USING (public.is_business_admin(business_id));

-- 6. Atomic Dealership Onboarding Function (RPC)
CREATE OR REPLACE FUNCTION public.create_dealership(
  dealership_name TEXT,
  dealership_slug TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_business_id UUID;
  new_membership_id UUID;
  current_user_id UUID;
  result JSONB;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF trim(dealership_name) = '' THEN
    RAISE EXCEPTION 'Dealership name is required';
  END IF;

  IF trim(dealership_slug) = '' THEN
    RAISE EXCEPTION 'Dealership slug is required';
  END IF;

  -- Create business
  INSERT INTO public.businesses (name, slug, status)
  VALUES (trim(dealership_name), lower(trim(dealership_slug)), 'ACTIVE')
  RETURNING id INTO new_business_id;

  -- Create DEALER_ADMIN membership for auth.uid()
  INSERT INTO public.business_memberships (business_id, user_id, role, status)
  VALUES (new_business_id, current_user_id, 'DEALER_ADMIN', 'ACTIVE')
  RETURNING id INTO new_membership_id;

  SELECT jsonb_build_object(
    'business_id', new_business_id,
    'membership_id', new_membership_id,
    'name', trim(dealership_name),
    'slug', lower(trim(dealership_slug)),
    'role', 'DEALER_ADMIN'
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_dealership(TEXT, TEXT) TO authenticated;

-- 7. Automatic Profile Provisioning on User Creation Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, created_at, updated_at)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
