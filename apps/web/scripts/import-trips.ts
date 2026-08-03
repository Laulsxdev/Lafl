/**
 * Import MarketPe trips for an org, then stage a realistic live state so the
 * dashboard reflects a working day (a few live trips + GPS, POD queue, dues).
 *
 * usage: tsx scripts/import-trips.ts <orgId> <fromISO> <toISO>
 * env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@lafl/core";
import { syncOrgTrips } from "../src/server/services/marketpe-sync.service";

const [orgId, from, to] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!orgId || !from || !to || !url || !key) {
  console.error("usage: tsx scripts/import-trips.ts <orgId> <fromISO> <toISO>");
  process.exit(1);
}

// narrowed copies usable inside closures
const ORG_ID = orgId;
const FROM = from;
const TO = to;

const db = createClient<Database>(url, key, { auth: { persistSession: false } });

// Faridabad-area anchor for demo GPS positions.
const BASE_LAT = 28.4089;
const BASE_LNG = 77.3178;

async function stageLiveState() {
  const { data: candidates } = await db
    .from("trips")
    .select("id, vehicle_id")
    .eq("org_id", ORG_ID)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(60);

  const distinct: { id: string; vehicle_id: string }[] = [];
  const seen = new Set<string>();
  for (const t of candidates ?? []) {
    if (seen.has(t.vehicle_id)) continue;
    seen.add(t.vehicle_id);
    distinct.push(t);
    if (distinct.length === 8) break;
  }

  const now = Date.now();
  const hours = (h: number) => new Date(now - h * 3600_000).toISOString();
  const future = (h: number) => new Date(now + h * 3600_000).toISOString();

  const plans = [
    { status: "in_transit", n: 4 },
    { status: "at_destination", n: 2 },
    { status: "unloaded", n: 1 },
    { status: "ready", n: 1 },
  ] as const;

  let i = 0;
  for (const plan of plans) {
    for (let k = 0; k < plan.n && i < distinct.length; k++, i++) {
      const trip = distinct[i]!;
      const lat = BASE_LAT + (i + 1) * 0.03;
      const lng = BASE_LNG + (i + 1) * 0.02;
      const live = plan.status === "in_transit";

      await db
        .from("trips")
        .update({
          status: plan.status,
          pod_status: "awaited",
          settlement_status: "pending",
          billing_status: "unbilled",
          actual_start: plan.status === "ready" ? null : hours(5),
          arrived_at:
            plan.status === "at_destination" || plan.status === "unloaded"
              ? hours(1)
              : null,
          unloaded_at: plan.status === "unloaded" ? hours(0.5) : null,
          ops_closed_at: null,
          completed_at: null,
          eta: future(3),
          last_lat: live ? lat : null,
          last_lng: live ? lng : null,
          last_gps_at: live ? hours(0.1) : null,
        })
        .eq("id", trip.id);

      await db
        .from("vehicles")
        .update({ status: plan.status === "ready" ? "available" : "on_trip" })
        .eq("id", trip.vehicle_id);

      if (live) {
        const fixes = [0.5, 0.3, 0.1].map((h, j) => ({
          org_id: ORG_ID,
          vehicle_id: trip.vehicle_id,
          trip_id: trip.id,
          ts: hours(h),
          lat: lat - (2 - j) * 0.01,
          lng: lng - (2 - j) * 0.008,
          speed_kmh: 42 + j * 5,
          refid: `demo-${trip.id}-${j}`,
          acc: 3,
        }));
        await db.from("gps_logs").upsert(fixes, { onConflict: "refid" });
      }
    }
  }

  // A settlement/POD backlog: 10 recent completed trips still waiting on paperwork.
  const { data: backlog } = await db
    .from("trips")
    .select("id")
    .eq("org_id", ORG_ID)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(10);
  for (const t of backlog ?? []) {
    await db
      .from("trips")
      .update({ pod_status: "awaited", settlement_status: "pending", billing_status: "invoiced" })
      .eq("id", t.id);
  }

  return { live: i, backlog: (backlog ?? []).length };
}

async function main() {
  const sync = await syncOrgTrips(db, ORG_ID, {
    createdTimeFrom: FROM,
    createdTimeTo: TO,
  });
  console.log(
    `imported: ${sync.trips} trips, ${sync.customers} customers, ${sync.routes} routes, ${sync.crew} crew links`,
  );
  const staged = await stageLiveState();
  console.log(`staged live state: ${staged.live} live trips, ${staged.backlog} in POD/payment backlog`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("import failed:", e);
    process.exit(1);
  });
