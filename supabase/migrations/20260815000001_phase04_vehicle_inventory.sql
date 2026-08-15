-- ==============================================================================
-- Vehicle 360 — Phase 04: Vehicle Inventory Migration
-- 20260815000001_phase04_vehicle_inventory.sql
-- ==============================================================================

-- 1. Vehicles (Dealership Inventory) Table
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  make TEXT NOT NULL CHECK (length(trim(make)) > 0 AND length(trim(make)) <= 60),
  model TEXT NOT NULL CHECK (length(trim(model)) > 0 AND length(trim(model)) <= 60),
  year INTEGER NOT NULL CHECK (year >= 1886 AND year <= 2100),
  price INTEGER CHECK (price IS NULL OR price >= 0),
  mileage INTEGER CHECK (mileage IS NULL OR mileage >= 0),
  vin TEXT CHECK (vin IS NULL OR length(trim(vin)) <= 20),
  stock_number TEXT CHECK (stock_number IS NULL OR length(trim(stock_number)) <= 64),
  trim TEXT,
  exterior_color TEXT,
  interior_color TEXT,
  body_style TEXT,
  transmission TEXT,
  fuel_type TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'SOLD')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Indexes & Unique Constraints
CREATE INDEX IF NOT EXISTS vehicles_business_id_idx ON public.vehicles (business_id);
CREATE INDEX IF NOT EXISTS vehicles_status_idx ON public.vehicles (business_id, status);

-- Per-dealership unique stock number constraint (case-insensitive for non-null/non-empty values)
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_business_id_stock_number_idx
  ON public.vehicles (business_id, upper(trim(stock_number)))
  WHERE stock_number IS NOT NULL AND trim(stock_number) != '';

-- 3. Immutability Trigger for Vehicle ID and Business Ownership
CREATE OR REPLACE FUNCTION public.prevent_vehicle_identity_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id <> OLD.id THEN
    RAISE EXCEPTION 'Vehicle ID is immutable and cannot be changed.';
  END IF;
  IF NEW.business_id <> OLD.business_id THEN
    RAISE EXCEPTION 'Vehicle business ownership is immutable and cannot be transferred.';
  END IF;
  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_vehicle_identity_mutation ON public.vehicles;
CREATE TRIGGER trg_prevent_vehicle_identity_mutation
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_vehicle_identity_mutation();

-- 4. Row Level Security Policies
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view vehicles in their businesses" ON public.vehicles;
CREATE POLICY "Members can view vehicles in their businesses"
ON public.vehicles FOR SELECT TO authenticated
USING (public.is_business_member(business_id));

DROP POLICY IF EXISTS "Members can insert vehicles in their businesses" ON public.vehicles;
CREATE POLICY "Members can insert vehicles in their businesses"
ON public.vehicles FOR INSERT TO authenticated
WITH CHECK (public.is_business_member(business_id));

DROP POLICY IF EXISTS "Members can update vehicles in their businesses" ON public.vehicles;
CREATE POLICY "Members can update vehicles in their businesses"
ON public.vehicles FOR UPDATE TO authenticated
USING (public.is_business_member(business_id))
WITH CHECK (public.is_business_member(business_id));

DROP POLICY IF EXISTS "Members can delete vehicles in their businesses" ON public.vehicles;
CREATE POLICY "Members can delete vehicles in their businesses"
ON public.vehicles FOR DELETE TO authenticated
USING (public.is_business_member(business_id));
