-- Lafl TMS · Migration 015 · heading in latest positions (truck icon rotation)
-- Applied to project hmmkebxbmnftxxkkkrqc via Supabase MCP on 2026-08-03.

drop view vehicle_latest_positions;
create view vehicle_latest_positions with (security_invoker = on) as
select distinct on (g.vehicle_id)
  g.vehicle_id, g.org_id, g.lat, g.lng, g.speed_kmh, g.heading, g.ts,
  v.reg_no, v.status as vehicle_status
from gps_logs g
join vehicles v on v.id = g.vehicle_id
order by g.vehicle_id, g.ts desc;
