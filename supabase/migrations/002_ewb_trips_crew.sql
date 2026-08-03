-- Lafl TMS · Migration 002 · e-way bills, trips (aggregate root), crew
-- Applied to project hmmkebxbmnftxxkkkrqc via Supabase MCP on 2026-08-01.

create table eway_bills (
  id uuid primary key default gen_random_uuid(),
  ewb_no text not null unique,
  consignor_id uuid references customers(id),
  consignee_id uuid references customers(id),
  consignor_name text,
  consignee_name text,
  origin text,
  destination text,
  material text,
  weight_kg numeric(10,1),
  invoice_no text,
  invoice_value numeric(14,2),
  generated_at timestamptz,
  valid_until timestamptz,
  status ewb_status not null default 'active',
  raw_json jsonb, -- full MarketPe eway/get payload
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index idx_ewb_validity on eway_bills (valid_until) where status in ('active','extended');

create sequence trip_no_seq;
create table trips (
  id uuid primary key default gen_random_uuid(),
  trip_no text not null unique default ('T' || to_char(now(),'YYMM') || '-' || lpad(nextval('trip_no_seq')::text, 5, '0')),
  vehicle_id uuid not null references vehicles(id),
  route_id uuid references routes(id),
  status trip_status not null default 'draft',
  pod_status pod_track_status not null default 'awaited',
  settlement_status settlement_track_status not null default 'pending',
  billing_status billing_track_status not null default 'unbilled',
  planned_start timestamptz,
  eta timestamptz,
  actual_start timestamptz,
  arrived_at timestamptz,
  unloaded_at timestamptz,
  ops_closed_at timestamptz,
  completed_at timestamptz,
  total_weight_kg numeric(10,1),
  consolidated_ewb_no text, -- EWB-02 when multiple consignments
  dest_geofence_id uuid references geofences(id),
  last_lat double precision,
  last_lng double precision,
  last_gps_at timestamptz,
  notes text,
  cancelled_reason text,
  marketpe_id text unique, -- when synced from trip/list
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- BUSINESS RULE: one live trip per vehicle
create unique index one_live_trip_per_vehicle on trips (vehicle_id)
  where status in ('planned','ready','in_transit','at_destination','unloaded');
create index idx_trips_status on trips (status);

create table trip_eway_bills (
  trip_id uuid not null references trips(id) on delete cascade,
  ewb_id uuid not null references eway_bills(id),
  is_active boolean not null default true, -- set false when trip cancelled/aborted
  attached_at timestamptz not null default now(),
  primary key (trip_id, ewb_id)
);
-- BUSINESS RULE: one EWB on max one live trip
create unique index one_live_trip_per_ewb on trip_eway_bills (ewb_id) where is_active;

create table trip_drivers (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  driver_id uuid not null references drivers(id),
  role trip_driver_role not null default 'primary',
  assigned_at timestamptz not null default now(),
  released_at timestamptz, -- null = currently on this trip
  leg_start_location text,
  leg_end_location text,
  handover_lat double precision,
  handover_lng double precision
);
create index idx_trip_drivers_trip on trip_drivers (trip_id);
create index idx_trip_drivers_driver on trip_drivers (driver_id) where released_at is null;

-- deferred FK from 001
alter table profiles add constraint profiles_driver_fk foreign key (driver_id) references drivers(id);
