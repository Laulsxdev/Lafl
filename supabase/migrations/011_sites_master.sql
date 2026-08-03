-- Lafl TMS · Migration 011 · Sites master (home bases + customer delivery points)
-- Applied to project hmmkebxbmnftxxkkkrqc via Supabase MCP on 2026-08-01.
-- Site = a named real-world location keyed by (GSTIN + pincode + address) for
-- customers, or a yard for home bases. Each site owns a geofences row so the
-- existing geofence_events machinery works unchanged.

create type site_kind as enum ('home_base','customer');
create type site_source as enum ('manual','cluster','learned','geocoded');

create table sites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  kind site_kind not null,
  name text not null,
  customer_gstin text,          -- customer sites: who
  pincode text,                 -- customer sites: which branch area
  address_text text,            -- EWB address string for exact matching
  geofence_id uuid not null references geofences(id),
  center_lat double precision not null,
  center_lng double precision not null,
  radius_m int not null default 400,
  source site_source not null default 'manual',
  confidence int not null default 0,   -- grows as trips confirm the pin
  sample_count int not null default 0,
  confirmed boolean not null default false, -- human said "yes this is right"
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_sites_org_kind on sites (org_id, kind) where active;
create index idx_sites_customer_lookup on sites (org_id, customer_gstin, pincode) where active;

create trigger trg_sites_touch before update on sites for each row execute function touch_updated_at();

alter table sites enable row level security;
create policy org_staff_all on sites for all to authenticated
  using (is_super_admin() or (is_staff() and org_id = current_org_id()))
  with check (is_super_admin() or (is_staff() and org_id = current_org_id()));
