-- Lafl TMS · Migration 004 · PODs, GPS, geofence events, notifications, audit
-- Applied to project hmmkebxbmnftxxkkkrqc via Supabase MCP on 2026-08-01.

create table pods (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  ewb_id uuid references eway_bills(id), -- POD is per consignment
  file_url text not null,
  source pod_source not null default 'app',
  status pod_track_status not null default 'uploaded',
  rejection_reason text,
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz not null default now(),
  verified_by uuid references profiles(id),
  verified_at timestamptz
);
create index idx_pods_trip on pods (trip_id);
create index idx_pods_pending on pods (status) where status = 'uploaded';

create table gps_logs (
  id bigint generated always as identity primary key,
  vehicle_id uuid not null references vehicles(id),
  trip_id uuid references trips(id),
  ts timestamptz not null,
  lat double precision not null,
  lng double precision not null,
  speed_kmh numeric(5,1),
  heading numeric(5,1),
  received_at timestamptz not null default now()
);
create index idx_gps_vehicle_ts on gps_logs (vehicle_id, ts desc);
create index idx_gps_ts_brin on gps_logs using brin (ts);

create table geofence_events (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  geofence_id uuid not null references geofences(id),
  event geofence_event_kind not null,
  ts timestamptz not null default now(),
  lat double precision,
  lng double precision,
  auto_status_applied trip_status -- which status change this event triggered, if any
);
create index idx_geofence_events_trip on geofence_events (trip_id);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_type text not null, -- driver | user | customer
  recipient_id uuid,
  channel notif_channel not null,
  template text not null,
  payload jsonb not null default '{}',
  status notif_status not null default 'queued',
  sent_at timestamptz,
  delivered_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
create index idx_notifications_queue on notifications (status, created_at) where status = 'queued';

create table activity_logs (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  actor_id uuid references profiles(id),
  ts timestamptz not null default now()
);
create index idx_activity_entity on activity_logs (entity_type, entity_id, ts desc);
