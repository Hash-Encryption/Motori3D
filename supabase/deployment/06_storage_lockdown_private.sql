-- ==============================================================================
-- Motori360 — Phase 06 Storage Lockdown: Set vehicle-spins to Private
-- Step 7 in Deployment Sequence (Run after application deployment is verified)
-- Target Database: ilebbqeknviaqhyvpygv
-- ==============================================================================

UPDATE storage.buckets
SET public = false
WHERE id = 'vehicle-spins';
