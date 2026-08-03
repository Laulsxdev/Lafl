import "server-only";

import type { Json } from "@lafl/core";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SessionProfile } from "@/server/auth";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024;

/** Statuses in which a POD may be uploaded — from arrival up to completion. */
const POD_UPLOADABLE = ["at_destination", "unloaded", "ops_closed", "completed"];

export async function uploadPod(
  profile: SessionProfile,
  tripId: string,
  ewbId: string | null,
  file: File,
): Promise<void> {
  const db = await createSupabaseServerClient();
  const { data: trip } = await db
    .from("trips")
    .select("id, status, org_id")
    .eq("id", tripId)
    .single();
  if (!trip) throw new Error("Trip not found");
  if (!POD_UPLOADABLE.includes(trip.status)) {
    throw new Error(
      `POD can only be uploaded after arrival (trip is ${trip.status.replace(/_/g, " ")})`,
    );
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Only JPG, PNG, WEBP or PDF files are allowed");
  }
  if (file.size === 0) throw new Error("File is empty");
  if (file.size > MAX_BYTES) throw new Error("File is larger than 10 MB");

  if (ewbId) {
    const { data: link } = await db
      .from("trip_eway_bills")
      .select("ewb_id")
      .eq("trip_id", tripId)
      .eq("ewb_id", ewbId)
      .maybeSingle();
    if (!link) throw new Error("That E-Way Bill does not belong to this trip");
  }

  // Storage writes go through the service role (private bucket, no client access).
  const admin = createSupabaseAdminClient();
  const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
  const path = `${trip.org_id}/${tripId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await admin.storage.from("pods").upload(path, file, {
    contentType: file.type,
  });
  if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

  const { error } = await db.from("pods").insert({
    org_id: trip.org_id,
    trip_id: tripId,
    ewb_id: ewbId,
    file_url: path,
    source: "manual_upload",
    status: "uploaded",
    uploaded_by: profile.id,
  });
  if (error) throw new Error(error.message);

  await recomputeTripPodStatus(tripId);
  await db.from("activity_logs").insert({
    org_id: trip.org_id,
    entity_type: "trip",
    entity_id: tripId,
    action: "pod_uploaded",
    new_value: { path, ewbId } as Json,
    actor_id: profile.id,
  });
}

export async function verifyPod(profile: SessionProfile, podId: string): Promise<void> {
  const db = await createSupabaseServerClient();
  const { data: pod } = await db.from("pods").select("*").eq("id", podId).single();
  if (!pod) throw new Error("POD not found");
  if (pod.status === "verified") return; // idempotent — double-click safe

  const { error } = await db
    .from("pods")
    .update({
      status: "verified",
      verified_by: profile.id,
      verified_at: new Date().toISOString(),
    })
    .eq("id", podId)
    .eq("status", "uploaded"); // never resurrect a rejected POD by accident
  if (error) throw new Error(error.message);

  await recomputeTripPodStatus(pod.trip_id);
  await db.from("activity_logs").insert({
    org_id: pod.org_id,
    entity_type: "trip",
    entity_id: pod.trip_id,
    action: "pod_verified",
    new_value: { podId } as Json,
    actor_id: profile.id,
  });
  await maybeCompleteTrip(pod.trip_id, profile.id);
}

export async function rejectPod(
  profile: SessionProfile,
  podId: string,
  reason: string,
): Promise<void> {
  if (!reason.trim()) throw new Error("A rejection reason is required");
  const db = await createSupabaseServerClient();
  const { data: pod } = await db.from("pods").select("*").eq("id", podId).single();
  if (!pod) throw new Error("POD not found");
  if (pod.status === "verified") {
    throw new Error("This POD is already verified — it can no longer be rejected");
  }

  const { error } = await db
    .from("pods")
    .update({
      status: "rejected",
      rejection_reason: reason.trim(),
      verified_by: profile.id,
      verified_at: new Date().toISOString(),
    })
    .eq("id", podId);
  if (error) throw new Error(error.message);

  await recomputeTripPodStatus(pod.trip_id);

  // Queue a driver notification (delivery worker sends it later).
  const { data: crew } = await db
    .from("trip_drivers")
    .select("driver_id")
    .eq("trip_id", pod.trip_id)
    .eq("role", "primary")
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (crew) {
    await db.from("notifications").insert({
      org_id: pod.org_id,
      recipient_type: "driver",
      recipient_id: crew.driver_id,
      channel: "whatsapp",
      template: "pod_rejected",
      payload: { tripId: pod.trip_id, reason: reason.trim() } as Json,
    });
  }
  await db.from("activity_logs").insert({
    org_id: pod.org_id,
    entity_type: "trip",
    entity_id: pod.trip_id,
    action: "pod_rejected",
    new_value: { podId, reason: reason.trim() } as Json,
    actor_id: profile.id,
  });
}

/**
 * Trip-level POD status:
 * - verified: EVERY consignment (EWB) has at least one verified POD
 *   (a 3-EWB trip with 2 verified PODs is NOT done)
 * - uploaded: something is waiting for review
 * - awaited: otherwise (incl. after rejection — driver must re-upload)
 */
export async function recomputeTripPodStatus(tripId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const [{ data: links }, { data: pods }] = await Promise.all([
    admin.from("trip_eway_bills").select("ewb_id").eq("trip_id", tripId),
    admin.from("pods").select("ewb_id, status").eq("trip_id", tripId),
  ]);
  const all = pods ?? [];
  const ewbIds = (links ?? []).map((l) => l.ewb_id);

  const verifiedFor = (ewbId: string) =>
    all.some((p) => p.status === "verified" && (p.ewb_id === ewbId || p.ewb_id === null));

  let status: "awaited" | "uploaded" | "verified";
  if (ewbIds.length > 0 && ewbIds.every(verifiedFor)) {
    status = "verified";
  } else if (all.some((p) => p.status === "uploaded")) {
    status = "uploaded";
  } else {
    status = "awaited";
  }
  await admin.from("trips").update({ pod_status: status }).eq("id", tripId);
}

/** ops_closed + POD verified + settlement paid => COMPLETED, automatically. */
export async function maybeCompleteTrip(
  tripId: string,
  actorId: string | null,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: trip } = await admin
    .from("trips")
    .select("id, org_id, status, pod_status, settlement_status")
    .eq("id", tripId)
    .single();
  if (!trip) return;
  if (
    trip.status !== "ops_closed" ||
    trip.pod_status !== "verified" ||
    trip.settlement_status !== "paid"
  ) {
    return;
  }
  await admin
    .from("trips")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", tripId)
    .eq("status", "ops_closed"); // guard against concurrent double-completion
  await admin.from("activity_logs").insert({
    org_id: trip.org_id,
    entity_type: "trip",
    entity_id: tripId,
    action: "trip_completed_auto",
    new_value: { trigger: "pod_verified_and_paid" } as Json,
    actor_id: actorId,
  });
}
