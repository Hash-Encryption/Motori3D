# Development Status — Phase 03: SaaS Foundation

## Authoritative Hybrid Architecture

Vehicle 360 operates on an authoritative **Hybrid SaaS Architecture**:

```text
SUPABASE CONTROL PLANE (Cloud)
  ├── Supabase Auth (Identity authority, server-side JWT verification via getUser())
  ├── Supabase PostgreSQL (Multi-tenant control plane)
  │     ├── profiles (1:1 with auth.users)
  │     ├── businesses (Dealership tenants: id, name, slug, status)
  │     └── business_memberships (Dealership roles: DEALER_ADMIN, DEALER_MEMBER)
  └── PostgreSQL Row Level Security (RLS)
        ├── Server/Database-enforced cross-tenant isolation
        ├── Non-recursive security-definer helper functions (is_business_member, is_business_admin)
        └── Atomic dealership onboarding function (create_dealership RPC)

LOCAL PROCESSING PLANE (Edge/Local Ledger)
  ├── node:sqlite (data/vehicle-360.sqlite with WAL mode)
  │     ├── vehicles (with business_id tenant ownership bridge)
  │     ├── captures (processing metadata, dimensions, fps, codec)
  │     ├── frames (ordered WebP frames & thumbnails manifest)
  │     └── schema_migrations (ordered local schema tracking)
  ├── ffmpeg-static & ffprobe-static (local video analysis & frame extraction)
  └── local filesystem (storage/vehicles/<vehicleId>/captures/<captureId>/)
```

---

## Working & Verified Capabilities

- **Supabase Control Plane & Identity**:
  - Full integration with `@supabase/supabase-js` and `@supabase/ssr` on Next.js 16 App Router using secure `getUser()` server validation.
  - Automatic profile generation on signup via database trigger `on_auth_user_created`.
  - Atomic dealership creation RPC (`create_dealership`) provisioning business tenant and `DEALER_ADMIN` membership transactionally.
- **Strict Row Level Security & Multi-Tenant Isolation**:
  - Proven database-level boundary: User A cannot read, update, insert, or delete records in Business B.
  - Hardened non-recursive RLS helper functions with explicit `SET search_path = public`.
  - Anonymous requests are rejected by RLS across all tenant tables.
- **Dealership Role Security**:
  - Explicit dealership-local roles: `DEALER_ADMIN` (management/membership permissions) and `DEALER_MEMBER` (standard tenant operations).
  - Role escalation prevention: `DEALER_MEMBER` cannot promote themselves or alter dealership settings.
  - Scoped authority: dealership administration confers zero platform-wide privileges.
- **Server Authorization Boundary**:
  - Reusable server context helper `getAuthContext()` / `requireAuthContext()` resolving authenticated user, verified active membership, authorized dealership, and role.
  - Active business context selection preference (`vehicle360_business` cookie) re-validated against current membership on every protected request.
- **Tenant Ownership Bridge & Local Coexistence**:
  - Added nullable `business_id` to local SQLite `vehicles` table via safe ordered migrations.
  - Complete preservation of all 26 legacy vehicles, 27 captures, and 1,044 frames from Phase 01/02 without data loss or corruption.
  - Scoped repository methods (`listVehiclesForBusiness`, `getVehicleForBusiness`, `createVehicleForBusiness`) ensuring zero tenant data leakage.
- **Proven 360 Pipeline & Viewer**:
  - 100% preservation of 48-frame default and 36/48/72 frame sequence support.
  - All 26 core pipeline acceptance tests and viewer interaction tests remain passing.

---

## Changed Files in Phase 03

- [`supabase/migrations/20260815000000_phase03_saas_foundation.sql`](file:///c:/codexprojects/vehicle-360/supabase/migrations/20260815000000_phase03_saas_foundation.sql): Core PostgreSQL migration defining `profiles`, `businesses`, `business_memberships`, RLS policies, and `create_dealership` RPC.
- [`src/types/database.types.ts`](file:///c:/codexprojects/vehicle-360/src/types/database.types.ts): TypeScript type definitions for Supabase schema and functions.
- [`src/lib/supabase/client.ts`](file:///c:/codexprojects/vehicle-360/src/lib/supabase/client.ts): Typed browser Supabase client.
- [`src/lib/supabase/server.ts`](file:///c:/codexprojects/vehicle-360/src/lib/supabase/server.ts): Typed server Supabase SSR client.
- [`src/lib/supabase/admin.ts`](file:///c:/codexprojects/vehicle-360/src/lib/supabase/admin.ts): Typed server-only admin client for test/bootstrap operations.
- [`src/lib/supabase/middleware.ts`](file:///c:/codexprojects/vehicle-360/src/lib/supabase/middleware.ts): Session update middleware helper.
- [`src/proxy.ts`](file:///c:/codexprojects/vehicle-360/src/proxy.ts): Next.js 16 proxy convention for session refreshing.
- [`src/server/auth/types.ts`](file:///c:/codexprojects/vehicle-360/src/server/auth/types.ts): Domain types for auth, business, membership, and context.
- [`src/server/auth/auth-context.ts`](file:///c:/codexprojects/vehicle-360/src/server/auth/auth-context.ts): Reusable server authorization boundary.
- [`src/server/db/database.ts`](file:///c:/codexprojects/vehicle-360/src/server/db/database.ts): Safe SQLite migration runner adopting legacy tables and adding `business_id`.
- [`src/server/vehicles/vehicle-repository.ts`](file:///c:/codexprojects/vehicle-360/src/server/vehicles/vehicle-repository.ts): Added tenant-scoped vehicle methods while preserving legacy unassigned access.
- [`src/app/api/auth/sign-up/route.ts`](file:///c:/codexprojects/vehicle-360/src/app/api/auth/sign-up/route.ts): Dealership signup & onboarding API route.
- [`src/app/api/auth/sign-in/route.ts`](file:///c:/codexprojects/vehicle-360/src/app/api/auth/sign-in/route.ts): Dealership signin API route.
- [`src/app/api/auth/sign-out/route.ts`](file:///c:/codexprojects/vehicle-360/src/app/api/auth/sign-out/route.ts): Dealership signout API route.
- [`src/app/api/auth/context/route.ts`](file:///c:/codexprojects/vehicle-360/src/app/api/auth/context/route.ts): Context read and active dealership switch endpoint.
- [`src/app/api/vehicles/route.ts`](file:///c:/codexprojects/vehicle-360/src/app/api/vehicles/route.ts): Tenant-scoped vehicle API route with legacy fallback.
- [`src/app/api/vehicles/[id]/captures/route.ts`](file:///c:/codexprojects/vehicle-360/src/app/api/vehicles/[id]/captures/route.ts): Added tenant authorization boundary on capture uploads.
- [`src/app/auth/sign-in/page.tsx`](file:///c:/codexprojects/vehicle-360/src/app/auth/sign-in/page.tsx): Minimal sign-in UI.
- [`src/app/auth/sign-up/page.tsx`](file:///c:/codexprojects/vehicle-360/src/app/auth/sign-up/page.tsx): Minimal sign-up & dealership creation UI.
- [`src/app/account/page.tsx`](file:///c:/codexprojects/vehicle-360/src/app/account/page.tsx): Protected account & multi-dealership context management UI.
- [`src/components/app-shell.tsx`](file:///c:/codexprojects/vehicle-360/src/components/app-shell.tsx): Added Account navigation link.
- [`src/server/auth/auth-security.test.ts`](file:///c:/codexprojects/vehicle-360/src/server/auth/auth-security.test.ts): 22 automated acceptance tests covering Auth, RLS, Cross-Tenant Isolation, Role Security, and SQLite ownership.

---

## Known Limitations

- Cloud object storage migration (Supabase Storage / S3 / R2) is intentionally deferred; media remains on local filesystem behind tenant authorization checks.
- Dealership inventory management, filtering, and VIN decoding belong to **Phase 04 — Vehicle Inventory**.
- Guided filming, capture workflow overhaul, and capture queue belong to **Phase 05 — Capture Workflow**.
- Polished dealer portal and analytics belong to **Phase 06 — Dealer Dashboard**.
- Platform-wide multi-dealership administration belongs to **Phase 07 — Platform Admin**.

---

## Next Phase

```text
Phase 04 — Vehicle Inventory
```
*(Phase 04 has NOT been started).*
