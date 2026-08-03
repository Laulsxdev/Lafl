import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface LiveVehicleSnapshot {
  plate: string;
  lat: number | null;
  lng: number | null;
  speedKmh: number | null;
  heading: number | null;
  fixQuality: number | null;
  fixTime: number | null; // epoch ms
  state: string | null; // RUNNING / STOPPED / PARKED / OFFLINE
  health: string | null; // GOOD / MINOR / MAJOR
  fuelLitres: number | null;
  adbluePct: number | null;
  odoKm: number | null;
  connected: boolean | null;
}

/**
 * Live snapshot straight from Intangles for one plate (fuel, health, odo —
 * data we intentionally don't persist). Returns null on any failure so pages
 * degrade gracefully to DB-only data.
 */
export async function getLiveVehicleSnapshot(
  orgId: string,
  regNo: string,
): Promise<LiveVehicleSnapshot | null> {
  try {
    const db = createSupabaseAdminClient();
    const { data: integ } = await db
      .from("org_integrations")
      .select("settings")
      .eq("org_id", orgId)
      .single();
    const cfg = (integ?.settings as Record<string, any> | null)?.intangles;
    if (!cfg?.vendor_access_token) return null;

    const res = await fetch(
      `${cfg.base_url}/api/v1/vendor/vehicle/list/?${cfg.account_id}`,
      {
        headers: { "vendor-access-token": cfg.vendor_access_token },
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 60 }, // cache 1 min — page stays snappy
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: { vehicles?: Array<Record<string, any>> } };
    const v = (json.result?.vehicles ?? []).find(
      (x) => (x.plate ?? "").toUpperCase() === regNo.toUpperCase(),
    );
    if (!v) return null;

    return {
      plate: v.plate,
      lat: v.gps_info?.loc?.lat ?? null,
      lng: v.gps_info?.loc?.lng ?? null,
      speedKmh: v.gps_info?.sp ?? null,
      heading: v.gps_info?.hd ?? null,
      fixQuality: v.gps_info?.fix ?? null,
      fixTime: v.gps_info?.timestamp ?? null,
      state: v.status?.state ?? null,
      health: v.health_info?.health ?? null,
      fuelLitres: v.fuel?.amount ?? null,
      adbluePct: v.ad_blue?.percentage ?? null,
      odoKm: v.odo ?? null,
      connected: v.connection_status?.status ?? null,
    };
  } catch {
    return null;
  }
}
