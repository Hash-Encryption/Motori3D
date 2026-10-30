-- ==============================================================================
-- Vehicle 360 — Phase 06: Vehicle Listings + Physical Inventory Units Migration
-- 20260815000005_phase06_vehicle_listings.sql
-- ==============================================================================

-- 1. Create Vehicle Listings Table (Parent Marketable Vehicle Offer)
CREATE TABLE IF NOT EXISTS public.vehicle_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  make TEXT NOT NULL CHECK (length(trim(make)) > 0 AND length(trim(make)) <= 60),
  model TEXT NOT NULL CHECK (length(trim(model)) > 0 AND length(trim(model)) <= 60),
  year INTEGER NOT NULL CHECK (year >= 1886 AND year <= 2100),
  trim TEXT,
  body_style TEXT,
  transmission TEXT,
  fuel_type TEXT,
  price INTEGER CHECK (price IS NULL OR price >= 0),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT vehicle_listings_id_business_id_key UNIQUE (id, business_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_vehicle_listings_business
  ON public.vehicle_listings (business_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_listings_status
  ON public.vehicle_listings (business_id, status);

CREATE INDEX IF NOT EXISTS idx_vehicle_listings_created
  ON public.vehicle_listings (business_id, created_at DESC);

-- 2. Add listing_id to Vehicles Table (Physical Inventory Units)
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS listing_id UUID;

-- 3. Deterministic Backfill: 1 existing vehicle = 1 listing = 1 physical unit
DO $$
DECLARE
  v_rec RECORD;
  new_listing_id UUID;
BEGIN
  FOR v_rec IN SELECT * FROM public.vehicles WHERE listing_id IS NULL LOOP
    INSERT INTO public.vehicle_listings (
      business_id,
      title,
      make,
      model,
      year,
      trim,
      body_style,
      transmission,
      fuel_type,
      price,
      status,
      created_at,
      updated_at
    ) VALUES (
      v_rec.business_id,
      TRIM(CONCAT_WS(' ', v_rec.year, v_rec.make, v_rec.model, v_rec.trim)),
      v_rec.make,
      v_rec.model,
      v_rec.year,
      v_rec.trim,
      v_rec.body_style,
      v_rec.transmission,
      v_rec.fuel_type,
      v_rec.price,
      CASE WHEN v_rec.status = 'SOLD' THEN 'ARCHIVED' ELSE v_rec.status END,
      v_rec.created_at,
      v_rec.updated_at
    ) RETURNING id INTO new_listing_id;

    UPDATE public.vehicles
    SET listing_id = new_listing_id
    WHERE id = v_rec.id;
  END LOOP;
END $$;

-- Enforce NOT NULL on listing_id now that backfill is complete
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'listing_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.vehicles ALTER COLUMN listing_id SET NOT NULL;
  END IF;
END $$;

-- 4. Composite Foreign Key Constraint for Structural Tenant Consistency
-- Guarantees that a physical unit owned by Business B cannot be attached to a listing owned by Business A
DO $$
DECLARE
  v_cdef TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid)
  INTO v_cdef
  FROM pg_constraint
  WHERE conname = 'vehicles_listing_business_fkey'
    AND conrelid = 'public.vehicles'::regclass;

  IF v_cdef IS NOT NULL THEN
    -- Verify existing constraint definition matches expected composite foreign key
    IF v_cdef NOT ILIKE '%FOREIGN KEY (listing_id, business_id) REFERENCES %vehicle_listings(id, business_id) ON DELETE RESTRICT%' THEN
      RAISE EXCEPTION 'Constraint vehicles_listing_business_fkey exists on public.vehicles with unexpected definition: %', v_cdef;
    END IF;
  ELSE
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_listing_business_fkey
      FOREIGN KEY (listing_id, business_id)
      REFERENCES public.vehicle_listings(id, business_id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vehicles_listing_id
  ON public.vehicles (listing_id);

-- 5. Immutability Trigger for Vehicle Listings (ID and Business Ownership)
CREATE OR REPLACE FUNCTION public.prevent_listing_identity_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id <> OLD.id THEN
    RAISE EXCEPTION 'Listing ID is immutable and cannot be changed.';
  END IF;
  IF NEW.business_id <> OLD.business_id THEN
    RAISE EXCEPTION 'Listing business ownership is immutable and cannot be transferred.';
  END IF;
  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_listing_identity_mutation ON public.vehicle_listings;
CREATE TRIGGER trg_prevent_listing_identity_mutation
  BEFORE UPDATE ON public.vehicle_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_listing_identity_mutation();

-- 6. Row Level Security Policies for Vehicle Listings
-- Strictly NO public / anonymous read access in Phase 06.
-- Dealership members can view their own listings; Super Admins can view all.

-- Ensure is_super_admin() helper exists if migration 000003 was not yet applied
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'is_super_admin' AND pronamespace = 'public'::regnamespace
  ) THEN
    CREATE OR REPLACE FUNCTION public.is_super_admin()
    RETURNS BOOLEAN
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = ''
    STABLE
    AS 'SELECT false;';
  END IF;
END $$;

ALTER TABLE public.vehicle_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view listings in their businesses" ON public.vehicle_listings;
CREATE POLICY "Members can view listings in their businesses"
ON public.vehicle_listings FOR SELECT TO authenticated
USING (public.is_business_member(business_id) OR public.is_super_admin());

DROP POLICY IF EXISTS "Members can insert listings in their businesses" ON public.vehicle_listings;
CREATE POLICY "Members can insert listings in their businesses"
ON public.vehicle_listings FOR INSERT TO authenticated
WITH CHECK (public.is_business_member(business_id));

DROP POLICY IF EXISTS "Members can update listings in their businesses" ON public.vehicle_listings;
CREATE POLICY "Members can update listings in their businesses"
ON public.vehicle_listings FOR UPDATE TO authenticated
USING (public.is_business_member(business_id))
WITH CHECK (public.is_business_member(business_id));

DROP POLICY IF EXISTS "Dealer admins can delete listings in their businesses" ON public.vehicle_listings;
CREATE POLICY "Dealer admins can delete listings in their businesses"
ON public.vehicle_listings FOR DELETE TO authenticated
USING (public.is_business_admin(business_id));

-- 7. Atomic Transactional Listing + Physical Unit Creation (RPC)
CREATE OR REPLACE FUNCTION public.create_listing_with_unit(
  p_listing JSONB,
  p_unit JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_business_id UUID;
  v_listing_id UUID;
  v_unit_id UUID;
  v_result JSONB;
BEGIN
  -- Validate dealership membership server-side
  v_business_id := (p_listing->>'business_id')::UUID;
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'business_id is required.';
  END IF;

  IF NOT (public.is_business_member(v_business_id) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Access denied for this dealership.';
  END IF;

  -- Insert into vehicle_listings
  INSERT INTO public.vehicle_listings (
    business_id,
    title,
    make,
    model,
    year,
    trim,
    body_style,
    transmission,
    fuel_type,
    price,
    description,
    status
  ) VALUES (
    v_business_id,
    TRIM(p_listing->>'title'),
    TRIM(p_listing->>'make'),
    TRIM(p_listing->>'model'),
    (p_listing->>'year')::INTEGER,
    NULLIF(TRIM(p_listing->>'trim'), ''),
    NULLIF(TRIM(p_listing->>'body_style'), ''),
    NULLIF(TRIM(p_listing->>'transmission'), ''),
    NULLIF(TRIM(p_listing->>'fuel_type'), ''),
    NULLIF(p_listing->>'price', '')::INTEGER,
    NULLIF(TRIM(p_listing->>'description'), ''),
    COALESCE(p_listing->>'status', 'DRAFT')
  ) RETURNING id INTO v_listing_id;

  -- Insert into vehicles (physical inventory unit) within the SAME transaction
  v_unit_id := COALESCE(NULLIF(p_unit->>'id', '')::UUID, gen_random_uuid());

  INSERT INTO public.vehicles (
    id,
    business_id,
    listing_id,
    make,
    model,
    year,
    price,
    mileage,
    vin,
    stock_number,
    trim,
    exterior_color,
    interior_color,
    body_style,
    transmission,
    fuel_type,
    status
  ) VALUES (
    v_unit_id,
    v_business_id,
    v_listing_id,
    TRIM(p_listing->>'make'),
    TRIM(p_listing->>'model'),
    (p_listing->>'year')::INTEGER,
    NULLIF(p_listing->>'price', '')::INTEGER,
    NULLIF(p_unit->>'mileage', '')::INTEGER,
    NULLIF(TRIM(p_unit->>'vin'), ''),
    NULLIF(TRIM(p_unit->>'stock_number'), ''),
    NULLIF(TRIM(p_listing->>'trim'), ''),
    NULLIF(TRIM(p_unit->>'exterior_color'), ''),
    NULLIF(TRIM(p_unit->>'interior_color'), ''),
    NULLIF(TRIM(p_listing->>'body_style'), ''),
    NULLIF(TRIM(p_listing->>'transmission'), ''),
    NULLIF(TRIM(p_listing->>'fuel_type'), ''),
    COALESCE(p_unit->>'status', 'PUBLISHED')
  );

  SELECT jsonb_build_object(
    'listing_id', v_listing_id,
    'unit_id', v_unit_id
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_listing_with_unit(JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_listing_with_unit(JSONB, JSONB) TO authenticated;

-- 8. Authorized Physical Unit Reassignment (RPC)
-- Allows moving a physical unit to another listing owned by the SAME dealership
CREATE OR REPLACE FUNCTION public.reassign_vehicle_unit(
  p_unit_id UUID,
  p_target_listing_id UUID,
  p_business_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_unit RECORD;
  v_target_listing RECORD;
BEGIN
  -- Validate caller permission
  IF NOT (public.is_business_member(p_business_id) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Access denied for this dealership.';
  END IF;

  -- Verify physical unit exists and belongs to caller's dealership
  SELECT * INTO v_unit
  FROM public.vehicles
  WHERE id = p_unit_id AND business_id = p_business_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Physical inventory unit not found in authorized dealership.';
  END IF;

  -- Verify target listing exists and belongs to the SAME dealership
  SELECT * INTO v_target_listing
  FROM public.vehicle_listings
  WHERE id = p_target_listing_id AND business_id = p_business_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target listing not found in authorized dealership.';
  END IF;

  -- Update listing_id and mirror specifications from target listing
  UPDATE public.vehicles
  SET
    listing_id = p_target_listing_id,
    make = v_target_listing.make,
    model = v_target_listing.model,
    year = v_target_listing.year,
    trim = v_target_listing.trim,
    body_style = v_target_listing.body_style,
    transmission = v_target_listing.transmission,
    fuel_type = v_target_listing.fuel_type,
    price = v_target_listing.price,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_unit_id AND business_id = p_business_id;

  RETURN jsonb_build_object(
    'success', true,
    'unit_id', p_unit_id,
    'listing_id', p_target_listing_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reassign_vehicle_unit(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reassign_vehicle_unit(UUID, UUID, UUID) TO authenticated;
