import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { gpsWebhookSchema, ingestGpsFix } from "./gps-ingest.service";

/** Fixes older than this are history, not live — don't replay them. */
const MAX_FIX_AGE_MS = 24 * 60 * 60 * 1000;

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

export interface IntanglesPollResult {
  fetched: number;
  deviceLinked: number;
  vehiclesCreated: number;
  fixesIngested: number;
  staleSkipped: number;
}

/**
 * Server-side twin of scripts/poll-intangles.ts — same upsert/dedup behaviour,
 * but feeds fixes straight into ingestGpsFix instead of HTTP-posting to our own
 * webhook (a serverless function calling itself would waste time and money).
 * refid = intangles-<vehicleId>-<timestamp>, so re-polling never duplicates.
 */
export async function pollIntanglesOrg(orgId: string): Promise<IntanglesPollResult> {
  const db = createSupabaseAdminClient();
  const { data: integ } = await db
    .from("org_integrations")
    .select("settings")
    .eq("org_id", orgId)
    .maybeSingle();
  const cfg = (integ?.settings as Record<string, any> | null)?.intangles;
  if (!cfg?.vendor_access_token || !cfg?.base_url || !cfg?.account_id) {
    throw new Error("Intangles is not configured for this organization");
  }

  const res = await fetch(`${cfg.base_url}/api/v1/vendor/vehicle/list/?${cfg.account_id}`, {
    headers: { "vendor-access-token": cfg.vendor_access_token },
  });
  if (!res.ok) throw new Error(`Intangles HTTP ${res.status}`);
  const json = (await res.json()) as { result?: { vehicles?: IntanglesVehicle[] } };
  const vehicles = (
    json.result?.vehicles ??
    (json.result as unknown as IntanglesVehicle[]) ??
    []
  ).filter((v) => v.plate);

  const { data: existing } = await db
    .from("vehicles")
    .select("id, reg_no, gps_device_id")
    .eq("org_id", orgId);
  const byReg = new Map((existing ?? []).map((v) => [v.reg_no, v]));

  let deviceLinked = 0;
  let vehiclesCreated = 0;
  for (const v of vehicles) {
    const plate = v.plate!.trim().toUpperCase();
    const known = byReg.get(plate);
    if (known) {
      if (known.gps_device_id !== v.id) {
        await db.from("vehicles").update({ gps_device_id: v.id }).eq("id", known.id);
        deviceLinked++;
      }
    } else {
      const { error } = await db.from("vehicles").insert({
        org_id: orgId,
        reg_no: plate,
        vehicle_type: "TRAILER",
        ownership: "OWNED",
        gps_device_id: v.id,
      });
      if (!error) vehiclesCreated++;
    }
  }

  const now = Date.now();
  let fixesIngested = 0;
  let staleSkipped = 0;
  for (const v of vehicles) {
    const g = v.gps_info;
    if (!g?.timestamp || g.loc?.lat === undefined || g.loc?.lng === undefined) continue;
    if (now - g.timestamp > MAX_FIX_AGE_MS) {
      staleSkipped++;
      continue;
    }
    const parsed = gpsWebhookSchema.safeParse({
      t: "G",
      time: g.timestamp,
      device_id: v.id,
      hd: g.hd,
      sp: g.sp,
      refid: `intangles-${v.id}-${g.timestamp}`,
      geo: { lat: g.loc.lat, lng: g.loc.lng, acc: g.fix ?? 2 },
      vehicle_id: v.plate,
    });
    if (!parsed.success) continue;
    await ingestGpsFix(orgId, parsed.data);
    fixesIngested++;
  }

  return {
    fetched: vehicles.length,
    deviceLinked,
    vehiclesCreated,
    fixesIngested,
    staleSkipped,
  };
}
