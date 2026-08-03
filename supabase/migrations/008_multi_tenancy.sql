-- Lafl TMS · Migration 008 · multi-tenancy: organizations, per-org config, org-scoped RLS
-- Applied to project hmmkebxbmnftxxkkkrqc via Supabase MCP on 2026-08-01.
-- Seed data (Lauls org + its integration credentials) was inserted separately —
-- secrets are never committed to this repo.

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active', -- active | suspended
  created_at timestamptz not null default now()
);

-- Per-org integration credentials & settings. Service-role access ONLY:
-- RLS enabled with zero policies, so no client can ever read secrets.
create table org_integrations (
  org_id uuid primary key references organizations(id) on delete cascade,
  marketpe_api_key text,
  marketpe_gstin text,
  marketpe_base_url text,
  gps_webhook_token text unique,
  settings jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table org_integrations enable row level security;

-- ── org_id on every tenant table (all empty, so NOT NULL is safe) ──
alter table profiles add column org_id uuid references organizations(id); -- null = super_admin (platform level)
alter table customers add column org_id uuid not null references organizations(id);
alter table routes add column org_id uuid not null references organizations(id);
alter table vehicles add column org_id uuid not null references organizations(id);
alter table drivers add column org_id uuid not null references organizations(id);
alter table master_trip_rates add column org_id uuid not null references organizations(id);
alter table geofences add column org_id uuid not null references organizations(id);
alter table eway_bills add column org_id uuid not null references organizations(id);
alter table trips add column org_id uuid not null references organizations(id);
alter table trip_eway_bills add column org_id uuid not null references organizations(id);
alter table trip_drivers add column org_id uuid not null references organizations(id);
alter table trip_charges add column org_id uuid not null references organizations(id);
alter table trip_expenses add column org_id uuid not null references organizations(id);
alter table advances add column org_id uuid not null references organizations(id);
alter table driver_settlements add column org_id uuid not null references organizations(id);
alter table customer_invoices add column org_id uuid not null references organizations(id);
alter table pods add column org_id uuid not null references organizations(id);
alter table gps_logs add column org_id uuid not null references organizations(id);
alter table geofence_events add column org_id uuid not null references organizations(id);
alter table notifications add column org_id uuid not null references organizations(id);
alter table activity_logs add column org_id uuid not null references organizations(id);

-- ── re-scope uniques from global to per-org ──
alter table vehicles drop constraint vehicles_reg_no_key;
alter table vehicles add constraint vehicles_org_reg_no_key unique (org_id, reg_no);
alter table vehicles drop constraint vehicles_marketpe_id_key;
alter table vehicles add constraint vehicles_org_marketpe_key unique (org_id, marketpe_id);
alter table drivers drop constraint drivers_phone_key;
alter table drivers add constraint drivers_org_phone_key unique (org_id, phone);
alter table drivers drop constraint drivers_marketpe_id_key;
alter table drivers add constraint drivers_org_marketpe_key unique (org_id, marketpe_id);
alter table customers drop constraint customers_marketpe_id_key;
alter table customers add constraint customers_org_marketpe_key unique (org_id, marketpe_id);
alter table routes drop constraint routes_origin_city_dest_city_key;
alter table routes add constraint routes_org_od_key unique (org_id, origin_city, dest_city);
alter table eway_bills drop constraint eway_bills_ewb_no_key;
alter table eway_bills add constraint eway_bills_org_ewb_no_key unique (org_id, ewb_no);
alter table trips drop constraint trips_marketpe_id_key;
alter table trips add constraint trips_org_marketpe_key unique (org_id, marketpe_id);

create index idx_trips_org_status on trips (org_id, status);
create index idx_vehicles_org on vehicles (org_id);
create index idx_drivers_org on drivers (org_id);

-- ── helpers ──
create or replace function public.current_org_id() returns uuid
language sql stable security definer set search_path = public as
$$ select org_id from profiles where id = auth.uid() $$;

create or replace function public.is_super_admin() returns boolean
language sql stable as
$$ select current_app_role() = 'super_admin' $$;

-- ── RLS v2: staff access is now org-scoped; super_admin sees all ──
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','customers','routes','vehicles','drivers','master_trip_rates','geofences',
    'eway_bills','trips','trip_eway_bills','trip_drivers',
    'trip_charges','trip_expenses','advances','driver_settlements','customer_invoices',
    'pods','gps_logs','geofence_events','notifications','activity_logs'
  ] loop
    execute format('drop policy if exists staff_all on %I', t);
    execute format(
      'create policy org_staff_all on %I for all to authenticated
         using (is_super_admin() or (is_staff() and org_id = current_org_id()))
         with check (is_super_admin() or (is_staff() and org_id = current_org_id()))', t);
  end loop;
end $$;

create policy org_member_read on organizations for select to authenticated
  using (is_super_admin() or id = current_org_id());
alter table organizations enable row level security;
create policy org_super_all on organizations for all to authenticated
  using (is_super_admin()) with check (is_super_admin());
