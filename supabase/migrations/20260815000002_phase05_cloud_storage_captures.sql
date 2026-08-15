-- Phase 05: Cloud-Native 360 Spin Captures & Storage Infrastructure

-- 1. Create storage bucket for 360 spin frames if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-spins', 'vehicle-spins', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow public read access to vehicle-spins bucket
CREATE POLICY "Public vehicle-spins read access"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'vehicle-spins');

-- Allow authenticated dealership users to upload into vehicle-spins bucket
CREATE POLICY "Authenticated users can upload vehicle-spins"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'vehicle-spins');

-- Allow authenticated dealership users to update/delete their vehicle-spins
CREATE POLICY "Authenticated users can manage vehicle-spins"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'vehicle-spins');

-- 2. Create cloud_captures table
CREATE TABLE IF NOT EXISTS public.cloud_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'READY' CHECK (status IN ('READY', 'PROCESSING', 'FAILED')),
  frame_count INTEGER NOT NULL DEFAULT 48,
  target_frame_count INTEGER NOT NULL DEFAULT 48,
  width INTEGER NOT NULL DEFAULT 1920,
  height INTEGER NOT NULL DEFAULT 1080,
  duration_seconds NUMERIC(6, 2) DEFAULT 0.00,
  fps NUMERIC(5, 2) DEFAULT 30.00,
  source_filename TEXT DEFAULT 'walkaround.mp4',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on vehicle_id and business_id for fast queries
CREATE INDEX IF NOT EXISTS idx_cloud_captures_vehicle ON public.cloud_captures(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_cloud_captures_business ON public.cloud_captures(business_id);

-- 3. Create cloud_capture_frames table
CREATE TABLE IF NOT EXISTS public.cloud_capture_frames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_id UUID NOT NULL REFERENCES public.cloud_captures(id) ON DELETE CASCADE,
  frame_index INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  width INTEGER NOT NULL DEFAULT 1920,
  height INTEGER NOT NULL DEFAULT 1080,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_cloud_capture_frame UNIQUE (capture_id, frame_index)
);

CREATE INDEX IF NOT EXISTS idx_cloud_capture_frames_capture ON public.cloud_capture_frames(capture_id, frame_index);

-- 4. Enable RLS on cloud_captures and cloud_capture_frames
ALTER TABLE public.cloud_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_capture_frames ENABLE ROW LEVEL SECURITY;

-- Allow public read of cloud_captures and frames so 360 viewer is viewable by buyers
CREATE POLICY "Public read cloud_captures"
  ON public.cloud_captures
  FOR SELECT
  USING (true);

CREATE POLICY "Public read cloud_capture_frames"
  ON public.cloud_capture_frames
  FOR SELECT
  USING (true);

-- Allow authenticated dealership members to create captures
CREATE POLICY "Dealers can insert cloud_captures"
  ON public.cloud_captures
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM public.business_memberships
      WHERE user_id = auth.uid() AND status = 'ACTIVE'
    )
  );

CREATE POLICY "Dealers can insert cloud_capture_frames"
  ON public.cloud_capture_frames
  FOR INSERT
  TO authenticated
  WITH CHECK (
    capture_id IN (
      SELECT id FROM public.cloud_captures
      WHERE business_id IN (
        SELECT business_id FROM public.business_memberships
        WHERE user_id = auth.uid() AND status = 'ACTIVE'
      )
    )
  );

CREATE POLICY "Dealers can delete cloud_captures"
  ON public.cloud_captures
  FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM public.business_memberships
      WHERE user_id = auth.uid() AND status = 'ACTIVE' AND role = 'DEALER_ADMIN'
    )
  );
