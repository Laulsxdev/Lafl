/**
 * Home-base discovery — clusters currently parked trucks (Intangles) inside
 * the org's home region and proposes yard sites for human confirmation.
 *
 * usage: tsx scripts/discover-sites.ts <orgId>
 * env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Rules:
 * - only stopped trucks (speed < 2 km/h), fix younger than 7 days
 * - only inside the home bounding box (Faridabad belt for Lauls)
 * - a cluster needs >= 2 trucks within 400m to count as a yard candidate
 * - never duplicates: skips candidates within 500m of an existing site
 * - creates sites as UNCONFIRMED — a human names/approves them in the UI
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@lafl/core";
import { haversineMeters } from "@lafl/core";

const [orgIdArg] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!orgIdArg || !url || !key) {
  console.error("usage: tsx scripts/discover-sites.ts <orgId>");
  process.exit(1);
}
const ORG_ID = orgIdArg;

// Home region for yard discovery — NCR belt incl. Faridabad/Ballabgarh,
// Pilkhuwa (biggest loading point, 374 trips/mo) and Sahibabad.
const HOME_BBOX = { latMin: 28.15, latMax: 28.85, lngMin: 77.2, lngMax: 77.75 };
const CLUSTER_RADIUS_M = 400;
const MIN_TRUCKS = 2;
const MAX_FIX_AGE_MS = 7 * 24 * 3600_000;

const db = createClient<Database>(url, key, { auth: { persistSession: false } });

interface Point {
  plate: string;
  lat: number;
  lng: number;
}
interface Cluster {
  lat: number;
  lng: number;
  points: Point[];
}

async function main() {
  const { data: integ } = await db
    .from("org_integrations")
    .select("settings")
    .eq("org_id", ORG_ID)
    .single();
  const cfg = (integ?.settings as Record<string, any> | null)?.intangles;
  if (!cfg?.vendor_access_token) throw new Error("Intangles not configured");

  const res = await fetch(
    `${cfg.base_url}/api/v1/vendor/vehicle/list/?${cfg.account_id}`,
    { headers: { "vendor-access-token": cfg.vendor_access_token } },
  );
  const json = (await res.json()) as { result?: { vehicles?: Array<Record<string, any>> } };
  const now = Date.now();

  const points: Point[] = (json.result?.vehicles ?? [])
    .filter((v) => {
      const g = v.gps_info;
      return (
        v.plate &&
        g?.loc?.lat !== undefined &&
        (g.sp ?? 99) < 2 &&
        g.timestamp &&
        now - g.timestamp < MAX_FIX_AGE_MS &&
        g.loc.lat >= HOME_BBOX.latMin &&
        g.loc.lat <= HOME_BBOX.latMax &&
        g.loc.lng >= HOME_BBOX.lngMin &&
        g.loc.lng <= HOME_BBOX.lngMax
      );
    })
    .map((v) => ({ plate: v.plate, lat: v.gps_info.loc.lat, lng: v.gps_info.loc.lng }));
  console.log(`parked trucks in home region: ${points.length}`);

  // greedy clustering
  const clusters: Cluster[] = [];
  for (const p of points) {
    const hit = clusters.find(
      (c) => haversineMeters({ lat: c.lat, lng: c.lng }, p) <= CLUSTER_RADIUS_M,
    );
    if (hit) {
      hit.points.push(p);
      hit.lat = hit.points.reduce((s, x) => s + x.lat, 0) / hit.points.length;
      hit.lng = hit.points.reduce((s, x) => s + x.lng, 0) / hit.points.length;
    } else {
      clusters.push({ lat: p.lat, lng: p.lng, points: [p] });
    }
  }
  const candidates = clusters.filter((c) => c.points.length >= MIN_TRUCKS);
  console.log(`clusters found: ${clusters.length}, yard candidates (>=${MIN_TRUCKS} trucks): ${candidates.length}`);

  const { data: existing } = await db
    .from("sites")
    .select("center_lat, center_lng")
    .eq("org_id", ORG_ID)
    .eq("active", true);

  let created = 0;
  for (const c of candidates) {
    const dup = (existing ?? []).some(
      (s) =>
        haversineMeters({ lat: s.center_lat, lng: s.center_lng }, { lat: c.lat, lng: c.lng }) < 500,
    );
    if (dup) continue;

    const label = `Yard candidate @ ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`;
    const { data: fence, error: gfErr } = await db
      .from("geofences")
      .insert({
        org_id: ORG_ID,
        name: label,
        kind: "home_base",
        center_lat: c.lat,
        center_lng: c.lng,
        radius_m: CLUSTER_RADIUS_M,
      })
      .select("id")
      .single();
    if (gfErr) throw new Error(gfErr.message);

    await db.from("sites").insert({
      org_id: ORG_ID,
      kind: "home_base",
      name: label,
      geofence_id: fence.id,
      center_lat: c.lat,
      center_lng: c.lng,
      radius_m: CLUSTER_RADIUS_M,
      source: "cluster",
      sample_count: c.points.length,
      confirmed: false,
    });
    created++;
    console.log(
      `  + ${label} — ${c.points.length} trucks: ${c.points.map((p) => p.plate).join(", ")}`,
    );
  }
  console.log(`sites created: ${created} (unconfirmed — name them in the Sites page)`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("discover-sites failed:", e.message);
    process.exit(1);
  });
