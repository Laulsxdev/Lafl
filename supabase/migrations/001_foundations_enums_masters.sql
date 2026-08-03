-- Lafl TMS · Migration 001 · extensions, enums, master tables
-- Applied to project hmmkebxbmnftxxkkkrqc via Supabase MCP on 2026-08-01.
create extension if not exists cube;
create extension if not exists earthdistance;

-- ── Enums ─────────────────────────────────────────────
create type user_role as enum ('admin','supervisor','accountant','driver');
create type vehicle_ownership as enum ('OWNED','MARKET','ATTACHED'); -- matches MarketPe vehicleOwnerType
create type vehicle_status as enum ('available','on_trip','maintenance','inactive');
create type driver_status as enum ('available','on_trip','off_duty','blacklisted');
create type customer_kind as enum ('consignor','consignee','both');
create type trip_status as enum ('draft','planned','ready','in_transit','at_destination','unloaded','ops_closed','completed','cancelled','aborted');
create type pod_track_status as enum ('awaited','uploaded','verified','rejected');
create type settlement_track_status as enum ('pending','processing','partially_paid','paid');
create type billing_track_status as enum ('unbilled','invoiced','partially_received','received');
create type ewb_status as enum ('active','extended','expired','cancelled');
create type trip_driver_role as enum ('primary','secondary','helper');
create type charge_source as enum ('master','manual');
create type pay_mode as enum ('cash','upi','bank','fuel_card','fastag','cheque');
create type pod_source as enum ('app','whatsapp','manual_upload');
create type geofence_kind as enum ('pickup','destination','checkpoint');
create type geofence_event_kind as enum ('enter','exit');
create type notif_channel as enum ('whatsapp','sms','push');
create type notif_status as enum ('queued','sent','delivered','failed');
create type settlement_row_status as enum ('pending','processing','paid');

-- ── Profiles (app users, linked to Supabase auth) ────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  role user_role not null default 'supervisor',
  driver_id uuid, -- FK added in 002 after drivers exists
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── Masters ───────────────────────────────────────────
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gstin text,
  kind customer_kind not null default 'both',
  billing_address text,
  contact_person text,
  phone text,
  credit_days int not null default 0,
  marketpe_id text unique,
  created_at timestamptz not null default now()
);

create table routes (
  id uuid primary key default gen_random_uuid(),
  origin_city text not null,
  dest_city text not null,
  distance_km numeric(8,1),
  expected_hours numeric(6,1),
  created_at timestamptz not null default now(),
  unique (origin_city, dest_city)
);

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  reg_no text not null unique,
  vehicle_type text not null,
  capacity_kg numeric(10,1),
  ownership vehicle_ownership not null default 'OWNED',
  status vehicle_status not null default 'available',
  gps_device_id text,
  insurance_expiry date,
  permit_expiry date,
  fitness_expiry date,
  puc_expiry date,
  registration_date date,
  trailer_type text,
  manufacturer text,
  purchase_date date,
  marketpe_id text unique,
  marketpe_raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  alt_phone text,
  license_no text,
  license_expiry date,
  status driver_status not null default 'available',
  bank_acc text,
  ifsc text,
  upi_id text,
  photo_url text,
  marketpe_id text unique, -- vendor/list id (type=DRIVER)
  marketpe_raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table master_trip_rates (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes(id),
  vehicle_type text not null,
  freight numeric(12,2) not null default 0,
  diesel numeric(12,2) not null default 0,
  driver_allowance numeric(12,2) not null default 0,
  toll numeric(12,2) not null default 0,
  fastag numeric(12,2) not null default 0,
  loading_charges numeric(12,2) not null default 0,
  unloading_charges numeric(12,2) not null default 0,
  misc numeric(12,2) not null default 0,
  effective_from date not null default current_date,
  effective_to date, -- null = current version
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_rates_lookup on master_trip_rates (route_id, vehicle_type, effective_from desc);

create table geofences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind geofence_kind not null default 'destination',
  center_lat double precision not null,
  center_lng double precision not null,
  radius_m int not null default 500,
  created_at timestamptz not null default now()
);
