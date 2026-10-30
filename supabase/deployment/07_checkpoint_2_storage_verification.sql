-- ==============================================================================
-- Motori360 — Phase 06 Checkpoint 2: Storage Privacy Verification
-- Step 8 in Deployment Sequence (Run immediately after storage lockdown)
-- Target Database: ilebbqeknviaqhyvpygv
-- ==============================================================================

SELECT 'bucket_status' AS check_name,
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'vehicle-spins') THEN 'MISSING'
    WHEN (SELECT public FROM storage.buckets WHERE id = 'vehicle-spins') = false THEN 'PRIVATE'
    ELSE 'PUBLIC'
  END AS result;
