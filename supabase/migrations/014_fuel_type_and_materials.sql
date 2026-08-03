-- Lafl TMS · Migration 014 · Fuel-aware masters + materials
-- Applied to project hmmkebxbmnftxxkkkrqc via Supabase MCP on 2026-08-03.
-- Team master sheets (2026-08-03): vehicles carry Diesel/CNG + tyre count,
-- trip budgets differ by fuel type (stored as litres + rupee estimate),
-- materials master carries HSN codes for GST invoicing.

alter table vehicles
  add column fuel_type text,
  add column tyre_count integer;

alter table master_trip_rates
  add column fuel_type text,
  add column fuel_liters numeric(7,1);

create table materials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  name text not null,
  hsn_code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);
alter table materials enable row level security;
create policy org_staff_all on materials for all to authenticated
  using (is_super_admin() or (is_staff() and org_id = current_org_id()))
  with check (is_super_admin() or (is_staff() and org_id = current_org_id()));
