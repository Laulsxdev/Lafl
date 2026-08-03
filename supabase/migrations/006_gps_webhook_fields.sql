-- Lafl TMS · Migration 006 · GPS webhook ingest fields
-- Applied to project hmmkebxbmnftxxkkkrqc via Supabase MCP on 2026-08-01.
-- Provider pushes: t, time, device_id, hd, sp, refid, ns, alt, geo{lat,lng,acc}, vehicle_id.
-- refid is unique per transmission -> idempotency key (provider retries up to 3x).

alter table gps_logs
  add column refid text unique,
  add column device_id text,
  add column acc smallint,      -- 1 low / 2 moderate / 3 high accuracy
  add column satellites smallint,
  add column alt_m numeric(7,1),
  add column raw jsonb;         -- full payload; provider warns fields may be added anytime

create index idx_gps_device on gps_logs (device_id);
