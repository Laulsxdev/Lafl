-- Lafl TMS · Migration 013 · QR-POD upload tokens
-- Applied to project hmmkebxbmnftxxkkkrqc via Supabase MCP on 2026-08-03.
-- Public, unguessable tokens that let a driver (or consignee clerk) upload a POD
-- photo for exactly one trip — no login. Vehicle tokens back permanent cabin
-- stickers and resolve to the vehicle's single live trip.

alter type pod_source add value if not exists 'qr';

alter table trips add column pod_token uuid not null default gen_random_uuid();
create unique index idx_trips_pod_token on trips (pod_token);

alter table vehicles add column pod_token uuid not null default gen_random_uuid();
create unique index idx_vehicles_pod_token on vehicles (pod_token);

-- Where the phone was when the POD photo was uploaded (proof of capture point).
alter table pods
  add column capture_lat double precision,
  add column capture_lng double precision;
