-- ==============================================================================
-- Motori360 — Phase 06 Checkpoint 1: Post-Migration Database Verification
-- Step 5 in Deployment Sequence (Run immediately after migrations 3, 4, 5)
-- Target Database: ilebbqeknviaqhyvpygv
-- ==============================================================================

SELECT 'vehicle_listings_created' AS check_name, COUNT(*)::text AS result FROM public.vehicle_listings
UNION ALL
SELECT 'unlinked_vehicles', COUNT(*)::text FROM public.vehicles WHERE listing_id IS NULL
UNION ALL
SELECT 'original_vehicles_preserved', COUNT(*)::text FROM public.vehicles
  WHERE id IN (
    '10f35412-b037-4d38-869a-7a78477bfede',
    'cd19bce1-2bb6-4a00-ba95-8437ef2300b7',
    '61d675e5-9c6c-4ac8-890b-5c7e92c7447e',
    'a2b5a998-9476-4baa-8629-4eb58f085c6d'
  )
UNION ALL
SELECT 'original_captures_preserved', COUNT(*)::text FROM public.cloud_captures
  WHERE id IN (
    '00793d56-72ea-4f04-a77c-1a15907c4ae8',
    '730923e1-9506-49af-985f-981b4b397996',
    '3158e8d2-b9b7-4a76-aba6-d61c2da07005',
    'dcf3adee-3499-43bb-9edb-3627ade75b0b'
  )
UNION ALL
SELECT 'super_admin_fn', (to_regprocedure('public.is_super_admin()') IS NOT NULL)::text
UNION ALL
SELECT 'is_vehicle_published_fn', (to_regprocedure('public.is_vehicle_published(uuid)') IS NOT NULL)::text
UNION ALL
SELECT 'create_listing_rpc', (to_regprocedure('public.create_listing_with_unit(jsonb,jsonb)') IS NOT NULL)::text
UNION ALL
SELECT 'reassign_unit_rpc', (to_regprocedure('public.reassign_vehicle_unit(uuid,uuid,uuid)') IS NOT NULL)::text
UNION ALL
SELECT 'composite_fk_exists', (
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.vehicles'::regclass
      AND conname IN ('vehicles_listing_business_fkey', 'fk_vehicles_listing_business')
  )
)::text;
