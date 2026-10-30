-- ==============================================================================
-- Motori360 — Phase 06 Pre-Deployment Baseline Verification
-- Step 1 in Deployment Sequence
-- Target Database: ilebbqeknviaqhyvpygv
-- ==============================================================================

SELECT 'vehicles_count' AS metric, COUNT(*)::text AS val FROM public.vehicles
UNION ALL
SELECT 'captures_count', COUNT(*)::text FROM public.cloud_captures
UNION ALL
SELECT 'frames_count', COUNT(*)::text FROM public.cloud_capture_frames
UNION ALL
SELECT 'tables_existing', COALESCE(NULLIF(STRING_AGG(table_name, ', '), ''), 'NONE')
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('super_admins', 'vehicle_listings')
UNION ALL
SELECT 'bucket_status',
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'vehicle-spins') THEN 'MISSING'
    WHEN (SELECT public FROM storage.buckets WHERE id = 'vehicle-spins') = false THEN 'PRIVATE'
    ELSE 'PUBLIC'
  END;
