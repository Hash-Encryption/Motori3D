# Development Status — Phase 04: Vehicle Inventory

## 1. Starting State

- **Starting Branch**: `phase/03-saas-foundation`
- **Starting Checkpoint SHA**: `05d4d455b1271a5fe87d8bb2face41538cedd7e9`
- **Phase 04 Branch**: `phase/04-vehicle-inventory`
- **Supabase Project**: Verified dedicated instance (`https://ilebbqeknviaqhyvpygv.supabase.co`)

---

## 2. Authoritative Hybrid Architecture

Vehicle 360 operates on an authoritative **Hybrid SaaS Architecture**:

```text
SUPABASE CONTROL PLANE (Cloud Authority)
  ├── Supabase Auth (Identity authority, server-side JWT verification via getUser())
  ├── Supabase PostgreSQL (Multi-tenant control plane)
  │     ├── profiles (1:1 with auth.users)
  │     ├── businesses (Dealership tenants: id, name, slug, status)
  │     ├── business_memberships (Dealership roles: DEALER_ADMIN, DEALER_MEMBER)
  │     └── vehicles (Canonical dealership inventory metadata & tenant ownership)
  └── PostgreSQL Row Level Security (RLS)
        ├── Server/Database-enforced cross-tenant isolation (is_business_member, is_business_admin)
        ├── Immutable identity & business ownership trigger (prevent_vehicle_identity_mutation)
        └── Atomic dealership onboarding function (create_dealership RPC)

LOCAL PROCESSING PLANE (Edge/Local Ledger & Media Engine)
  ├── node:sqlite (data/vehicle-360.sqlite with WAL mode)
  │     ├── vehicles (Deterministic 1:1 matching UUID with Supabase vehicles, business_id bridge)
  │     ├── captures (Processing metadata, dimensions, fps, codec, targetFrameCount, status)
  │     ├── frames (Ordered WebP frames & thumbnails manifest)
  │     └── schema_migrations (Ordered local schema tracking)
  ├── ffmpeg-static & ffprobe-static (Local video analysis & frame extraction)
  └── local filesystem (storage/vehicles/<vehicleId>/captures/<captureId>/)
```

---

## 3. Vehicle Identity & Hybrid Linkage

```text
Business (Supabase UUID)
        ↓
Inventory Vehicle (Supabase UUID)
        ↓ (Deterministic 1:1 Shared UUID: inventory.id === processing.id)
Processing Vehicle (SQLite UUID)
        ↓
Capture (SQLite UUID)
        ↓
Ordered Frames & Thumbnails (SQLite & Local Disk)
        ↓
360 Spin Viewer
```

- **Canonical Authority**: Supabase `public.vehicles` is the authoritative source for dealership-facing inventory metadata (`make`, `model`, `year`, `price`, `mileage`, `vin`, `stock_number`, `trim`, `colors`, `body_style`, `transmission`, `fuel_type`, `status`).
- **Processing Identity**: Local SQLite `vehicles` record uses the **exact same stable UUID string** as Supabase `vehicles.id`, with `business_id` set to the authorized dealership UUID.
- **Identity Invariants**:
  - `vehicles.id` and `vehicles.business_id` are immutable after creation, enforced at the database layer via PostgreSQL trigger `prevent_vehicle_identity_mutation()`.
  - Reassignment of ownership across businesses is blocked even for users holding memberships in multiple dealerships.
- **Legacy Processing Records**:
  - Historical Phase 01/02 records with `business_id = NULL` remain unassigned and untouched.

---

## 4. Schema & Migrations

### Supabase PostgreSQL: `supabase/migrations/20260815000001_phase04_vehicle_inventory.sql`
- **Table**: `public.vehicles`
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT`
  - `make TEXT NOT NULL CHECK (length(trim(make)) > 0 AND length(trim(make)) <= 60)`
  - `model TEXT NOT NULL CHECK (length(trim(model)) > 0 AND length(trim(model)) <= 60)`
  - `year INTEGER NOT NULL CHECK (year >= 1886 AND year <= 2100)`
  - `price INTEGER CHECK (price IS NULL OR price >= 0)`
  - `mileage INTEGER CHECK (mileage IS NULL OR mileage >= 0)`
  - `vin TEXT CHECK (vin IS NULL OR length(trim(vin)) <= 20)`
  - `stock_number TEXT CHECK (stock_number IS NULL OR length(trim(stock_number)) <= 64)`
  - `trim TEXT`, `exterior_color TEXT`, `interior_color TEXT`, `body_style TEXT`, `transmission TEXT`, `fuel_type TEXT`
  - `status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'SOLD'))`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
- **Constraints & Indexes**:
  - `vehicles_business_id_idx` on `(business_id)`
  - `vehicles_status_idx` on `(business_id, status)`
  - `vehicles_business_id_stock_number_idx` unique index on `(business_id, upper(trim(stock_number))) WHERE stock_number IS NOT NULL AND trim(stock_number) != ''`
- **Trigger**: `prevent_vehicle_identity_mutation()` preventing alteration of `id` and `business_id` on updates.
- **Row Level Security**:
  - `SELECT`, `INSERT`, `UPDATE`, `DELETE` policies strictly scoped to `public.is_business_member(business_id)`.

---

## 5. Working & Verified Capabilities

- **Dealership Inventory Management**:
  - Create new inventory vehicles with comprehensive specifications.
  - Update vehicle metadata and specifications.
  - Full lifecycle status management: `DRAFT` ➔ `PUBLISHED` ➔ `SOLD`.
  - Instant search and filtering across make, model, year, VIN, stock number, and lifecycle status.
- **Tenant Isolation & Security**:
  - Cross-tenant read, write, status change, and deletion attempts are blocked by PostgreSQL RLS.
  - Client-side `business_id` spoofing is rejected; server authorization resolves active membership via `getAuthContext()`.
  - Both `DEALER_ADMIN` and `DEALER_MEMBER` roles can manage inventory within their dealership, with zero cross-tenant access.
- **Deterministic Supabase ↔ SQLite Hybrid Linkage**:
  - Shared UUID model links Supabase inventory to SQLite local processing records.
  - Two-phase creation with compensation handling: if SQLite provisioning fails, Supabase record is safely rolled back.
  - Cross-tenant capture upload / association is rejected at the API boundary.
- **Safe Non-Destructive Deletion**:
  - Vehicle without captures can be deleted cleanly from both Supabase and SQLite.
  - Vehicle with attached captures/frames/media is **blocked from deletion** with a 409 Conflict error to safeguard physical processing evidence.
- **Legacy Processing Evidence Integrity**:
  - All 18 historical SQLite vehicles, 19 captures, and 732 frames remain intact with `business_id = NULL`.
  - Quick Check A vehicle `5167cc7a-9ded-4079-97e0-9e72627361fe` and capture `471d03a6-21b9-4000-a25c-a48ce6a1e226` are verified intact with `READY` status and 48 frames.

---

## 6. Changed Files in Phase 04

- [`supabase/migrations/20260815000001_phase04_vehicle_inventory.sql`](file:///c:/codexprojects/vehicle-360/supabase/migrations/20260815000001_phase04_vehicle_inventory.sql): Phase 04 PostgreSQL schema for `vehicles` with RLS, triggers, and constraints.
- [`src/types/database.types.ts`](file:///c:/codexprojects/vehicle-360/src/types/database.types.ts): Added `vehicles` table typing to Supabase database types.
- [`src/server/vehicles/inventory-types.ts`](file:///c:/codexprojects/vehicle-360/src/server/vehicles/inventory-types.ts): Domain types for inventory vehicles, lifecycle status, filters, and enriched capture state.
- [`src/server/vehicles/vehicle-validation.ts`](file:///c:/codexprojects/vehicle-360/src/server/vehicles/vehicle-validation.ts): Input validation for inventory creation, updates, and specifications.
- [`src/server/vehicles/inventory-repository.ts`](file:///c:/codexprojects/vehicle-360/src/server/vehicles/inventory-repository.ts): Supabase inventory CRUD with RLS, SQLite synchronization, compensation handling, and safe deletion.
- [`src/server/vehicles/vehicle-repository.ts`](file:///c:/codexprojects/vehicle-360/src/server/vehicles/vehicle-repository.ts): Added explicit UUID support, update, `hasVehicleCaptures`, and safe delete helpers.
- [`src/app/api/vehicles/route.ts`](file:///c:/codexprojects/vehicle-360/src/app/api/vehicles/route.ts): Authenticated inventory listing with search/filter, and vehicle creation.
- [`src/app/api/vehicles/[id]/route.ts`](file:///c:/codexprojects/vehicle-360/src/app/api/vehicles/[id]/route.ts): Authenticated GET, PATCH, and DELETE endpoints with immutable identity guards.
- [`src/app/api/vehicles/[id]/captures/route.ts`](file:///c:/codexprojects/vehicle-360/src/app/api/vehicles/[id]/captures/route.ts): Hardened tenant boundary on capture uploads.
- [`src/components/inventory-dashboard.tsx`](file:///c:/codexprojects/vehicle-360/src/components/inventory-dashboard.tsx): Interactive inventory dashboard with real-time search, status tabs, and 360 badges.
- [`src/components/create-vehicle-form.tsx`](file:///c:/codexprojects/vehicle-360/src/components/create-vehicle-form.tsx): Form component for adding new inventory vehicles.
- [`src/components/vehicle-detail-view.tsx`](file:///c:/codexprojects/vehicle-360/src/components/vehicle-detail-view.tsx): Vehicle detail view with lifecycle switcher, specifications editing, 360 link, and safe delete.
- [`src/app/page.tsx`](file:///c:/codexprojects/vehicle-360/src/app/page.tsx): Updated home page rendering inventory dashboard for authenticated users or welcome view.
- [`src/app/vehicles/new/page.tsx`](file:///c:/codexprojects/vehicle-360/src/app/vehicles/new/page.tsx): Authenticated page for creating new inventory vehicles.
- [`src/app/vehicles/[id]/page.tsx`](file:///c:/codexprojects/vehicle-360/src/app/vehicles/[id]/page.tsx): Authenticated vehicle detail page.
- [`src/app/vehicles/[id]/viewer/page.tsx`](file:///c:/codexprojects/vehicle-360/src/app/vehicles/[id]/viewer/page.tsx): Added tenant authorization check to 360 viewer.
- [`src/app/vehicles/[id]/processing/page.tsx`](file:///c:/codexprojects/vehicle-360/src/app/vehicles/[id]/processing/page.tsx): Added tenant authorization check to capture processing page.
- [`src/server/vehicles/inventory-security.test.ts`](file:///c:/codexprojects/vehicle-360/src/server/vehicles/inventory-security.test.ts): 23 automated acceptance tests covering all Phase 04 criteria (Tests A through J).

---

## 7. Known Limitations

- Physical inventory photos remain deferred; 360 frame sequences are stored locally on disk behind tenant authorization.
- DMS integrations, bulk CSV inventory imports, and external VIN decoding APIs are intentionally deferred.
- Guided filming, capture workflow overhaul, and capture queue belong to **Phase 05 — Capture Workflow**.
- Polished dealer portal and analytics belong to **Phase 06 — Dealer Dashboard**.

---

## 8. Next Step

```text
Quick Check B (dealer account → vehicle → real video → processing → 360)
```
*(Quick Check B has NOT been started).*
*(Phase 05 has NOT been started).*
