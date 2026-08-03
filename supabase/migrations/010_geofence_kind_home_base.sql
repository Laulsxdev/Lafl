-- Lafl TMS · Migration 010 · home_base geofence kind
-- Applied to project hmmkebxbmnftxxkkkrqc via Supabase MCP on 2026-08-01.
-- (separate migration: new enum values can't be used in the same transaction)
alter type geofence_kind add value 'home_base';
