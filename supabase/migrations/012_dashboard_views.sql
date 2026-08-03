-- Lafl TMS · Migration 012 · dashboard views (latest positions + financial rollups)
-- Applied to project hmmkebxbmnftxxkkkrqc via Supabase MCP on 2026-08-01.
-- security_invoker: underlying RLS applies, so each org only sees its own rows.

create view vehicle_latest_positions with (security_invoker = on) as
select distinct on (g.vehicle_id)
  g.vehicle_id, g.org_id, g.lat, g.lng, g.speed_kmh, g.ts,
  v.reg_no, v.status as vehicle_status
from gps_logs g
join vehicles v on v.id = g.vehicle_id
order by g.vehicle_id, g.ts desc;

create view org_invoice_summary with (security_invoker = on) as
select org_id,
  count(*) as invoices,
  coalesce(sum(total), 0) as invoiced_total,
  coalesce(sum(received_amount), 0) as received_total,
  coalesce(sum(total - received_amount), 0) as outstanding
from customer_invoices
group by org_id;

create view org_cost_summary with (security_invoker = on) as
select org_id,
  coalesce(sum(approved_amount), 0) as approved_costs
from trip_charges
group by org_id;
