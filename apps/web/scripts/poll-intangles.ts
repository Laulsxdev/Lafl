/**
 * Intangles GPS poller — pulls live vehicle data and feeds it into Lafl's
 * existing GPS webhook pipeline (same dedup/geofence/status engine).
 *
 * usage: tsx scripts/poll-intangles.ts <orgId> [webhookBase]
 *   webhookBase default: http://localhost:3000
 * env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Behaviour:
 * 1. Reads Intangles config + gps webhook token from org_integrations.
 * 2. Fetches vendor/vehicle/list.
 * 3. Upserts vehicles: known plates get gps_device_id linked; unknown plates
 *    are created (OWNED trailers — Intangles devices sit on own fleet).
 * 4. Converts each fresh GPS fix into the webhook payload shape and POSTs it.
 *    refid = intangles-<vehicleId>-<timestamp> so re-polling never duplicates.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@lafl/core";

const [orgIdArg, webhookBaseArg] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!orgIdArg || !url || !key) {
  console.error("usage: tsx scripts/poll-intangles.ts <orgId> [webhookBase]");
  process.exit(1);
}
const ORG_ID = orgIdArg;
const WEBHOOK_BASE = webhookBaseArg ?? "http://localhost:3000";
/** Fixes older than this are history, not live — don't replay them. */
const MAX_FIX_AGE_MS = 24 * 60 * 60 * 1000;

const db = createClient<Database>(url, key, { auth: { persistSession: false } });

interface IntanglesVehicle {
  id?: string;
  plate?: string;
  gps_info?: {
    timestamp?: number;
    sp?: number;
    hd?: number;
    fix?: number;
    loc?: { lat?: number; lng?: number };
  };
  [k: string]: unknown;
}

async function main() {
  const { data: integ } = await db
    .from("org_integrations")
    .select("settings, gps_webhook_token")
    .eq("org_id", ORG_ID)
    .single();
  const cfg = (integ?.settings as Record<string, any> | null)?.intangles;
  if (!cfg?.vendor_access_token || !integ?.gps_webhook_token) {
    throw new Error("Intangles config or GPS webhook token missing in org_integrations");
  }

  const res = await fetch(
    `${cfg.base_url}/api/v1/vendor/vehicle/list/?${cfg.account_id}`,
    { headers: { "vendor-access-token": cfg.vendor_access_token } },
  );
  if (!res.ok) throw new Error(`Intangles HTTP ${res.status}`);
  const json = (await res.json()) as { result?: { vehicles?: IntanglesVehicle[] } };
  const vehicles = (json.result?.vehicles ?? (json.result as unknown as IntanglesVehicle[]) ?? []).filter(
    (v) => v.plate,
  );
  console.log(`intangles: ${vehicles.length} vehicles fetched`);

  // ── vehicle upsert / device link ──
  const { data: existing } = await db
    .from("vehicles")
    .select("id, reg_no, gps_device_id")
    .eq("org_id", ORG_ID);
  const byReg = new Map((existing ?? []).map((v) => [v.reg_no, v]));

  let linked = 0;
  let created = 0;
  for (const v of vehicles) {
    const plate = v.plate!.trim().toUpperCase();
    const known = byReg.get(plate);
    if (known) {
      if (known.gps_device_id !== v.id) {
        await db.from("vehicles").update({ gps_device_id: v.id }).eq("id", known.id);
        linked++;
      }
    } else {
      const { error } = await db.from("vehicles").insert({
        org_id: ORG_ID,
        reg_no: plate,
        vehicle_type: "TRAILER",
        ownership: "OWNED",
        gps_device_id: v.id,
      });
      if (!error) created++;
    }
  }
  console.log(`vehicles: ${linked} device-linked, ${created} newly created`);

  // ── push fresh fixes through the standard webhook ──
  const now = Date.now();
  let pushed = 0;
  let stale = 0;
  for (const v of vehicles) {
    const g = v.gps_info;
    if (!g?.timestamp || g.loc?.lat === undefined || g.loc?.lng === undefined) continue;
    if (now - g.timestamp > MAX_FIX_AGE_MS) {
      stale++;
      continue;
    }
    const payload = {
      t: "G",
      time: g.timestamp,
      device_id: v.id,
      hd: g.hd,
      sp: g.sp,
      refid: `intangles-${v.id}-${g.timestamp}`,
      geo: { lat: g.loc.lat, lng: g.loc.lng, acc: g.fix ?? 2 },
      vehicle_id: v.plate,
    };
    const r = await fetch(
      `${WEBHOOK_BASE}/api/webhooks/gps?token=${integ.gps_webhook_token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (r.ok) pushed++;
  }
  console.log(`gps fixes: ${pushed} pushed, ${stale} skipped (older than 24h)`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("intangles poll failed:", e.message);
    process.exit(1);
  });
