import "server-only";

import type { Database, Json } from "@lafl/core";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recomputeTripPodStatus } from "./pod.service";

type TripStatus = Database["public"]["Enums"]["trip_status"];

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024;
const POD_UPLOADABLE: TripStatus[] = ["at_destination", "unloaded", "ops_closed", "completed"];
/** Trip is on its way — the link is real but uploads open after arrival. */
const PRE_ARRIVAL: TripStatus[] = ["planned", "ready", "in_transit"];
const MAX_UPLOADS_PER_HOUR = 25;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PodTokenEwb {
  id: string;
  ewb_no: string;
  consignee_name: string | null;
  material: string | null;
}

export type PodTokenResolution =
  | { kind: "not_found" }
  | { kind: "no_live_trip"; regNo: string }
  | {
      kind: "not_ready" | "uploadable" | "done";
      tripId: string;
      tripNo: string;
      status: string;
      regNo: string;
      destination: string | null;
      orgName: string;
      ewbs: PodTokenEwb[];
    };

/**
 * Resolves a public POD token. Trip tokens map straight to their trip;
 * vehicle tokens (permanent cabin stickers) map to the vehicle's current
 * POD-relevant trip — safe because a vehicle has at most one live trip.
 */
export async function resolvePodToken(token: string): Promise<PodTokenResolution> {
  if (!UUID_RE.test(token)) return { kind: "not_found" };
  const admin = createSupabaseAdminClient();

  const tripCols =
    "id, trip_no, status, pod_status, org_id, vehicle_id, vehicles(reg_no), routes(dest_city)";

  let { data: trip } = await admin
    .from("trips")
    .select(tripCols)
    .eq("pod_token", token)
    .maybeSingle();

  if (!trip) {
    const { data: vehicle } = await admin
      .from("vehicles")
      .select("id, reg_no")
      .eq("pod_token", token)
      .maybeSingle();
    if (!vehicle) return { kind: "not_found" };

    // Prefer the trip currently at/after the destination, then one on the road,
    // then the latest closed trip that is still waiting on its POD.
    const { data: candidates } = await admin
      .from("trips")
      .select(tripCols)
      .eq("vehicle_id", vehicle.id)
      .in("status", [...POD_UPLOADABLE, ...PRE_ARRIVAL])
      .order("created_at", { ascending: false })
      .limit(10);
    const pool = candidates ?? [];
    trip =
      pool.find((t) => ["at_destination", "unloaded"].includes(t.status)) ??
      pool.find((t) => PRE_ARRIVAL.includes(t.status)) ??
      pool.find((t) => t.status === "ops_closed" && t.pod_status !== "verified") ??
      null;
    if (!trip) return { kind: "no_live_trip", regNo: vehicle.reg_no };
  }

  const [{ data: org }, { data: links }] = await Promise.all([
    admin.from("organizations").select("name").eq("id", trip.org_id).single(),
    admin
      .from("trip_eway_bills")
      .select("eway_bills(id, ewb_no, consignee_name, material)")
      .eq("trip_id", trip.id),
  ]);

  const base = {
    tripId: trip.id,
    tripNo: trip.trip_no,
    status: trip.status,
    regNo: trip.vehicles?.reg_no ?? "—",
    destination: trip.routes?.dest_city ?? null,
    orgName: org?.name ?? "Lafl",
    ewbs: (links ?? [])
      .map((l) => l.eway_bills)
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .map((e) => ({
        id: e.id,
        ewb_no: e.ewb_no,
        consignee_name: e.consignee_name,
        material: e.material,
      })),
  };

  if (trip.pod_status === "verified") return { kind: "done", ...base };
  if (PRE_ARRIVAL.includes(trip.status)) return { kind: "not_ready", ...base };
  if (POD_UPLOADABLE.includes(trip.status)) return { kind: "uploadable", ...base };
  // draft / cancelled / aborted — behave like a dead link.
  return { kind: "not_found" };
}

/** Token-authenticated public upload — the QR/link IS the credential. */
export async function uploadPodViaToken(
  token: string,
  ewbId: string | null,
  file: File,
  capture: { lat: number; lng: number } | null,
): Promise<void> {
  const resolved = await resolvePodToken(token);
  if (resolved.kind === "not_found" || resolved.kind === "no_live_trip") {
    throw new Error("This link is not valid anymore");
  }
  if (resolved.kind === "not_ready") {
    throw new Error("The trip has not arrived yet — POD upload opens after arrival");
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Only JPG, PNG, WEBP or PDF files are allowed");
  }
  if (file.size === 0) throw new Error("File is empty");
  if (file.size > MAX_BYTES) throw new Error("File is larger than 10 MB");
  if (ewbId && !resolved.ewbs.some((e) => e.id === ewbId)) {
    throw new Error("That consignment does not belong to this trip");
  }

  const admin = createSupabaseAdminClient();

  // Abuse guard: a QR floating around must not be able to flood the queue.
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await admin
    .from("pods")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", resolved.tripId)
    .gte("uploaded_at", oneHourAgo);
  if ((count ?? 0) >= MAX_UPLOADS_PER_HOUR) {
    throw new Error("Too many uploads for this trip — please try again later");
  }

  const { data: trip } = await admin
    .from("trips")
    .select("org_id")
    .eq("id", resolved.tripId)
    .single();
  if (!trip) throw new Error("Trip not found");

  const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
  const path = `${trip.org_id}/${resolved.tripId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await admin.storage.from("pods").upload(path, file, {
    contentType: file.type,
  });
  if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

  const { error } = await admin.from("pods").insert({
    org_id: trip.org_id,
    trip_id: resolved.tripId,
    ewb_id: ewbId,
    file_url: path,
    source: "qr",
    status: "uploaded",
    uploaded_by: null,
    capture_lat: capture?.lat ?? null,
    capture_lng: capture?.lng ?? null,
  });
  if (error) throw new Error(error.message);

  await recomputeTripPodStatus(resolved.tripId);
  await admin.from("activity_logs").insert({
    org_id: trip.org_id,
    entity_type: "trip",
    entity_id: resolved.tripId,
    action: "pod_uploaded",
    new_value: { path, ewbId, via: "qr", capture } as Json,
    actor_id: null,
  });
}
