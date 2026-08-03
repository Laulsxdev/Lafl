# Lafl TMS

Vehicle Transportation Management System for Indian road logistics (E-Way Bills,
trips, GPS tracking, PODs, driver settlements). Upstream master data comes from
the MarketPe API; operational data lives in Supabase.

## Stack & layout

pnpm workspace monorepo:

- `apps/web` — Next.js 15 (App Router, TS, Tailwind v4). Portal for admin/supervisor/accountant + API layer.
- `packages/core` — pure domain package: generated DB types, enums, trip state machine, money math, geo helpers, zod input schemas. **No I/O allowed here.**
- `packages/marketpe` — typed MarketPe API client. Server-only consumer.
- `supabase/migrations` — SQL source of truth. Applied to project `hmmkebxbmnftxxkkkrqc` (org Lauls).

## Multi-tenancy (core design — never violate)

This is a multi-tenant SaaS. Lauls is tenant #1, not the product.

- `organizations` is the tenant root; every tenant table carries `org_id` (NOT NULL).
- Roles: `super_admin` is PLATFORM level (profiles.org_id = null, creates/manages orgs);
  admin/supervisor/accountant/driver are ORG level.
- RLS: staff access requires `org_id = current_org_id()`; super_admin bypasses.
- Per-org integration credentials (MarketPe key/GSTIN, GPS webhook token, settings)
  live in `org_integrations` — RLS enabled with ZERO policies (service-role only).
  Use `marketpeForOrg(orgId)` / `getOrgIntegrations(orgId)`; NEVER put tenant
  credentials in env vars.
- GPS webhook: the token identifies the org (each org gets its own webhook URL).
- Uniques are org-scoped: (org_id, reg_no), (org_id, phone), (org_id, ewb_no), etc.
- Every new table MUST have org_id + the org_staff_all RLS policy pattern.

## Architecture rules (enforce in review)

1. Layering: `app/` routes → `server/services` → `server/repositories` → Supabase. UI never queries the DB directly.
2. Business rules (status transitions, settlement math, tolerances) live in `packages/core`, not in services or components.
3. `process.env` is only read in `apps/web/src/lib/env.ts`.
4. Service-role client (`lib/supabase/admin.ts`) only for system jobs/webhooks; user-facing reads go through the RLS-scoped server client.
5. Trip is the aggregate root — vehicles/EWBs/drivers/money link through `trip_id`. Vehicle↔EWB has no direct link.
6. Trip has 4 status tracks: operational `status` (state machine in `core/domain/trip-state.ts`), plus parallel `pod_status`, `settlement_status`, `billing_status`.
7. Every status change must write to `activity_logs`.

## Key domain invariants (also enforced by DB)

- One live trip per vehicle (`one_live_trip_per_vehicle` partial unique index).
- One live trip per E-Way Bill (`one_live_trip_per_ewb` on `trip_eway_bills.is_active`).
- Advances are a ledger (many rows), never a single field.
- PODs are per-EWB (consignment), not per-trip.
- Charge edits beyond `CHARGE_DEVIATION_TOLERANCE` (10%) of master rate need admin approval.

## MarketPe integration

- Base URL `https://marketpe-api.azurewebsites.net/app-api`, header `Authorization: <api_key>`.
- Endpoints: `vendor/list`, `vehicle/list`, `trip-simple/list`, `payment/list`, `eway/get` (needs `gstin`).
- List windows max 32 days — use `chunkRange()` from `@lafl/marketpe` in sync jobs.
- Synced rows keep MarketPe ids in `marketpe_id` and full payloads in `*_raw`/`raw_json`.
- Insurance/permit expiry are NOT in MarketPe's documented response — Lafl maintains them on `vehicles`.

## Commands

- `pnpm dev` — run web app
- `pnpm typecheck` / `pnpm build` — all workspaces
- DB types: regenerate via Supabase MCP `generate_typescript_types` after every migration → `packages/core/src/database.types.ts`
- Migrations: apply via Supabase MCP `apply_migration` AND mirror the SQL into `supabase/migrations/` so the repo stays the source of truth.

## Environment

Secrets in `apps/web/.env.local` (gitignored): `SUPABASE_SERVICE_ROLE_KEY`,
`MARKETPE_API_KEY`, `MARKETPE_GSTIN`. Template in `.env.example`.
