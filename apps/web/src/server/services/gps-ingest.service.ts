import "server-only";

import { z } from "zod";
import type { Json, Tables } from "@lafl/core";
import {
  GEOFENCE_DEBOUNCE_FIXES,
  assertTransition,
  isInsideGeofence,
} from "@lafl/core";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Provider payload (Location/GPS webhook). Docs warn new fields may appear at
 * any time, so parse leniently and keep the full payload in gps_logs.raw.
 */
export const gpsWebhookSchema = z
  .object({
    t: z.string().optional(),
    time: z.number(), // epoch ms
    device_id: z.string().optional(),
    hd: z.number().optional(), // heading deg
    sp: z.number().optional(), // speed km/h
    refid: z.string().optional(),
    ns: z.number().optional(), // satellites
    alt: z.number().optional(), // metres
    geo: z.object({
      lat: z.number(),
      lng: z.number(),
      acc: z.number().optional(), // 1 low .. 3 high
    }),
    vehicle_id: z.string().optional(), // usually the registration number
  })
  .passthrough();

export type GpsWebhookPayload = z.infer<typeof gpsWebhookSchema>;

type Db = ReturnType<typeof createSupabaseAdminClient>;

export async function ingestGpsFix(
  orgId: string,
  payload: GpsWebhookPayload,
): Promise<void> {
  const db = createSupabaseAdminClient();

  const vehicle = await matchVehicle(db, orgId, payload);
  if (!vehicle) {
    console.warn(
      `gps-ingest: no vehicle matched in org ${orgId} (vehicle_id=${payload.vehicle_id}, device_id=${payload.device_id})`,
    );
    return;
  }

  const trip = await findLiveTrip(db, vehicle.id);
  const ts = new Date(payload.time).toISOString();

  const { error: insertError } = await db.from("gps_logs").insert({
    org_id: orgId,
    vehicle_id: vehicle.id,
    trip_id: trip?.id ?? null,
    ts,
    lat: payload.geo.lat,
    lng: payload.geo.lng,
    speed_kmh: payload.sp ?? null,
    heading: payload.hd ?? null,
    refid: payload.refid ?? null,
    device_id: payload.device_id ?? null,
    acc: payload.geo.acc ?? null,
    satellites: payload.ns ?? null,
    alt_m: payload.alt ?? null,
    raw: payload as Json,
  });

  if (insertError) {
    // 23505 on refid = provider retry of an already-processed fix. Done.
    if (insertError.code === "23505") return;
    throw new Error(`gps-ingest insert failed: ${insertError.message}`);
  }

  if (!trip) return;

  await db
    .from("trips")
    .update({ last_lat: payload.geo.lat, last_lng: payload.geo.lng, last_gps_at: ts })
    .eq("id", trip.id);

  await evaluateGeofence(db, orgId, trip, payload, ts);
  await evaluateHomeBase(db, orgId, vehicle.id, trip, payload, ts);
}

/**
 * Home-base automation: a READY trip whose vehicle drives OUT of a home yard
 * starts itself (ready -> in_transit). Yard enter/exit events are logged for
 * detention/utilization analytics. Low-accuracy fixes never trigger.
 */
async function evaluateHomeBase(
  db: Db,
  orgId: string,
  vehicleId: string,
  trip: { id: string; status: string },
  payload: GpsWebhookPayload,
  ts: string,
): Promise<void> {
  if ((payload.geo.acc ?? 3) < 2) return;

  const { data: sites } = await db
    .from("sites")
    .select("id, name, geofence_id, center_lat, center_lng, radius_m")
    .eq("org_id", orgId)
    .eq("kind", "home_base")
    .eq("active", true);
  if (!sites?.length) return;

  const findSite = (p: { lat: number; lng: number }) =>
    sites.find((s) =>
      isInsideGeofence(p, { lat: s.center_lat, lng: s.center_lng }, s.radius_m),
    );

  const current = findSite({ lat: payload.geo.lat, lng: payload.geo.lng });

  // previous fix = the one before the row we just inserted
  const { data: recent } = await db
    .from("gps_logs")
    .select("lat, lng")
    .eq("vehicle_id", vehicleId)
    .order("ts", { ascending: false })
    .limit(2);
  const prevFix = recent?.[1];
  const previous = prevFix ? findSite({ lat: prevFix.lat, lng: prevFix.lng }) : undefined;

  // yard EXIT with a READY trip => trip starts itself
  if (previous && !current && trip.status === "ready") {
    assertTransition("ready", "in_transit");
    await db
      .from("trips")
      .update({ status: "in_transit", actual_start: ts })
      .eq("id", trip.id)
      .eq("status", "ready");
    const { data: crew } = await db
      .from("trip_drivers")
      .select("driver_id")
      .eq("trip_id", trip.id)
      .is("released_at", null);
    for (const c of crew ?? []) {
      await db.from("drivers").update({ status: "on_trip" }).eq("id", c.driver_id);
    }
    await db.from("geofence_events").insert({
      org_id: orgId,
      trip_id: trip.id,
      geofence_id: previous.geofence_id,
      event: "exit",
      ts,
      lat: payload.geo.lat,
      lng: payload.geo.lng,
      auto_status_applied: "in_transit",
    });
    await db.from("activity_logs").insert({
      org_id: orgId,
      entity_type: "trip",
      entity_id: trip.id,
      action: "auto_status_in_transit",
      old_value: { status: "ready" } as Json,
      new_value: { status: "in_transit", trigger: `home_base_exit:${previous.name}` } as Json,
    });
    return;
  }

  // plain enter/exit logging (detention & utilization analytics)
  if (current && !previous) {
    await db.from("geofence_events").insert({
      org_id: orgId,
      trip_id: trip.id,
      geofence_id: current.geofence_id,
      event: "enter",
      ts,
      lat: payload.geo.lat,
      lng: payload.geo.lng,
    });
  } else if (previous && !current) {
    await db.from("geofence_events").insert({
      org_id: orgId,
      trip_id: trip.id,
      geofence_id: previous.geofence_id,
      event: "exit",
      ts,
      lat: payload.geo.lat,
      lng: payload.geo.lng,
    });
  }
}

async function matchVehicle(db: Db, orgId: string, payload: GpsWebhookPayload) {
  if (payload.vehicle_id) {
    const { data } = await db
      .from("vehicles")
      .select("id, reg_no")
      .eq("org_id", orgId)
      .eq("reg_no", payload.vehicle_id)
      .maybeSingle();
    if (data) return data;
  }
  if (payload.device_id) {
    const { data } = await db
      .from("vehicles")
      .select("id, reg_no")
      .eq("org_id", orgId)
      .eq("gps_device_id", payload.device_id)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

async function findLiveTrip(db: Db, vehicleId: string) {
  const { data } = await db
    .from("trips")
    .select("id, status, dest_geofence_id, unloaded_at")
    .eq("vehicle_id", vehicleId)
    .in("status", ["planned", "ready", "in_transit", "at_destination", "unloaded"])
    .maybeSingle();
  return data;
}

/**
 * Debounced geofence detection: a transition needs the last
 * GEOFENCE_DEBOUNCE_FIXES fixes to agree, which filters GPS jitter.
 * Low-accuracy fixes (acc=1) never trigger transitions.
 */
async function evaluateGeofence(
  db: Db,
  orgId: string,
  trip: Pick<Tables<"trips">, "id" | "status" | "dest_geofence_id">,
  payload: GpsWebhookPayload,
  ts: string,
): Promise<void> {
  if (!trip.dest_geofence_id) return;
  if (trip.status !== "in_transit" && trip.status !== "unloaded") return;
  if ((payload.geo.acc ?? 3) < 2) return;

  const { data: fence } = await db
    .from("geofences")
    .select("*")
    .eq("id", trip.dest_geofence_id)
    .single();
  if (!fence) return;

  const inside = isInsideGeofence(
    { lat: payload.geo.lat, lng: payload.geo.lng },
    { lat: fence.center_lat, lng: fence.center_lng },
    fence.radius_m,
  );

  const { data: recentFixes } = await db
    .from("gps_logs")
    .select("lat, lng")
    .eq("trip_id", trip.id)
    .order("ts", { ascending: false })
    .limit(GEOFENCE_DEBOUNCE_FIXES);

  const allAgree =
    (recentFixes ?? []).length >= GEOFENCE_DEBOUNCE_FIXES &&
    (recentFixes ?? []).every(
      (f) =>
        isInsideGeofence(
          { lat: f.lat, lng: f.lng },
          { lat: fence.center_lat, lng: fence.center_lng },
          fence.radius_m,
        ) === inside,
    );
  if (!allAgree) return;

  if (inside && trip.status === "in_transit") {
    await applyGeofenceTransition(db, orgId, trip.id, fence.id, "enter", "at_destination", ts, {
      arrived_at: ts,
    });
  } else if (!inside && trip.status === "unloaded") {
    await applyGeofenceTransition(db, orgId, trip.id, fence.id, "exit", "ops_closed", ts, {
      ops_closed_at: ts,
    });
  }
}

async function applyGeofenceTransition(
  db: Db,
  orgId: string,
  tripId: string,
  geofenceId: string,
  event: "enter" | "exit",
  toStatus: "at_destination" | "ops_closed",
  ts: string,
  extraTripFields: Record<string, string>,
): Promise<void> {
  const { data: lastEvent } = await db
    .from("geofence_events")
    .select("event")
    .eq("trip_id", tripId)
    .eq("geofence_id", geofenceId)
    .order("ts", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastEvent?.event === event) return; // already recorded this side

  const { data: current } = await db
    .from("trips")
    .select("status, vehicle_id")
    .eq("id", tripId)
    .single();
  if (!current) return;

  assertTransition(current.status, toStatus);

  await db.from("geofence_events").insert({
    org_id: orgId,
    trip_id: tripId,
    geofence_id: geofenceId,
    event,
    ts,
    auto_status_applied: toStatus,
  });

  await db
    .from("trips")
    .update({ status: toStatus, ...extraTripFields })
    .eq("id", tripId);

  if (toStatus === "ops_closed") {
    await db
      .from("vehicles")
      .update({ status: "available" })
      .eq("id", current.vehicle_id);
  }

  await db.from("activity_logs").insert({
    org_id: orgId,
    entity_type: "trip",
    entity_id: tripId,
    action: `auto_status_${toStatus}`,
    old_value: { status: current.status } as Json,
    new_value: { status: toStatus, trigger: `geofence_${event}` } as Json,
  });
}
