-- Lafl TMS · Migration 009 · customer freight contracts (revenue side)
-- Applied to project hmmkebxbmnftxxkkkrqc via Supabase MCP on 2026-08-01.
-- Per-tonne rates from customer contracts (e.g. Tata Steel contract 4700144497):
-- origin stockyard x destination city x vehicle category -> Rs/MT.
-- Trip billing = rate_per_mt x actual MT carried.
-- Data imported separately from '17860 0626.XLS' (268 rate lines, valid 2026-06-01 to 2028-08-31).

create table freight_contracts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  contract_no text not null,
  customer_name text,
  origin_code text,
  origin_name text not null,
  dest_code text,
  dest_city text not null,
  category text not null, -- CATA / CATB per contract terms
  rate_per_mt numeric(10,2) not null,
  transit_days int,
  valid_from date,
  valid_to date,
  source_file text,
  created_at timestamptz not null default now(),
  unique (org_id, contract_no, origin_code, dest_code, category)
);
create index idx_freight_contracts_lookup on freight_contracts (org_id, dest_city, category);

alter table freight_contracts enable row level security;
create policy org_staff_all on freight_contracts for all to authenticated
  using (is_super_admin() or (is_staff() and org_id = current_org_id()))
  with check (is_super_admin() or (is_staff() and org_id = current_org_id()));
