import "server-only";

import type { Json, PayMode, TablesUpdate, TripStatus } from "@lafl/core";
import { CHARGE_TYPES, assertTransition } from "@lafl/core";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SessionProfile } from "@/server/auth";
import { fetchEwayBill } from "./ewb.service";

type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function logActivity(
  db: Db,
  profile: SessionProfile,
  tripId: string,
  action: string,
  oldValue: Json | null,
  newValue: Json | null,
) {
  await db.from("activity_logs").insert({
    org_id: profile.org_id!,
    entity_type: "trip",
    entity_id: tripId,
    action,
    old_value: oldValue,
    new_value: newValue,
    actor_id: profile.id,
  });
}

async function getTrip(db: Db, tripId: string) {
  const { data: trip, error } = await db
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .single();
  if (error || !trip) throw new Error("Trip not found");
  return trip;
}

function assertDraft(status: TripStatus) {
  if (status !== "draft") {
    throw new Error("This trip is no longer editable (not a draft)");
  }
}

// ── Wizard steps ─────────────────────────────────────────────

export async function createDraftTrip(
  profile: SessionProfile,
  vehicleId: string,
): Promise<string> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("trips")
    .insert({
      org_id: profile.org_id!,
      vehicle_id: vehicleId,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Could not create trip: ${error.message}`);
  await logActivity(db, profile, data.id, "trip_created", null, { vehicleId });
  return data.id;
}

/**
 * Hard-delete a mistaken DRAFT. Activated trips are business records — they
 * can only be cancelled/aborted, never erased. Advances block deletion: money
 * that left the drawer must keep its paper trail.
 */
export async function deleteDraftTrip(
  profile: SessionProfile,
  tripId: string,
): Promise<void> {
  const db = await createSupabaseServerClient();
  const trip = await getTrip(db, tripId);
  assertDraft(trip.status);

  const { count: advCount } = await db
    .from("advances")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId);
  if ((advCount ?? 0) > 0) {
    throw new Error(
      "This draft has advances recorded — money entries cannot be erased. Activate and cancel instead.",
    );
  }

  // Children first (releases any attached EWBs), then the trip itself.
  await db.from("trip_eway_bills").delete().eq("trip_id", tripId);
  await db.from("trip_drivers").delete().eq("trip_id", tripId);
  await db.from("trip_charges").delete().eq("trip_id", tripId);
  const { error } = await db
    .from("trips")
    .delete()
    .eq("id", tripId)
    .eq("status", "draft"); // re-checked at the DB so a race can't delete a live trip
  if (error) throw new Error(error.message);
  await db.from("activity_logs").delete().eq("entity_type", "trip").eq("entity_id", tripId);
}

/** Attach an EWB by fetching it from MarketPe (org-configured GSTIN). */
export async function attachEwb(
  profile: SessionProfile,
  tripId: string,
  ewbNo: string,
): Promise<void> {
  const db = await createSupabaseServerClient();
  const trip = await getTrip(db, tripId);
  assertDraft(trip.status);

  const ewb = await fetchEwayBill(profile.org_id!, ewbNo);
  if (ewb.status === "expired" || ewb.status === "cancelled") {
    throw new Error(`E-Way Bill ${ewbNo} is ${ewb.status}`);
  }
  await linkEwb(db, profile, tripId, ewb.id, ewbNo);
}

/** Manual consignment entry — fallback when the EWB fetch is unavailable. */
export async function attachEwbManual(
  profile: SessionProfile,
  tripId: string,
  input: {
    ewbNo: string;
    consignorName: string | null;
    consigneeName: string | null;
    origin: string | null;
    destination: string | null;
    material: string | null;
    weightKg: number | null;
    invoiceNo: string | null;
    validUntil: string | null;
  },
): Promise<void> {
  const db = await createSupabaseServerClient();
  const trip = await getTrip(db, tripId);
  assertDraft(trip.status);

  const { data: ewb, error } = await db
    .from("eway_bills")
    .upsert(
      {
        org_id: profile.org_id!,
        ewb_no: input.ewbNo,
        consignor_name: input.consignorName,
        consignee_name: input.consigneeName,
        origin: input.origin,
        destination: input.destination,
        material: input.material,
        weight_kg: input.weightKg,
        invoice_no: input.invoiceNo,
        valid_until: input.validUntil,
      },
      { onConflict: "org_id,ewb_no" },
    )
    .select("id")
    .single();
  if (error) throw new Error(`Could not save E-Way Bill: ${error.message}`);
  await linkEwb(db, profile, tripId, ewb.id, input.ewbNo);
}

async function linkEwb(
  db: Db,
  profile: SessionProfile,
  tripId: string,
  ewbId: string,
  ewbNo: string,
) {
  const { error } = await db.from("trip_eway_bills").insert({
    org_id: profile.org_id!,
    trip_id: tripId,
    ewb_id: ewbId,
  });
  if (error) {
    if (error.code === "23505") {
      throw new Error(
        `E-Way Bill ${ewbNo} is already attached to a live trip`,
      );
    }
    throw new Error(`Could not attach E-Way Bill: ${error.message}`);
  }
  await logActivity(db, profile, tripId, "ewb_attached", null, { ewbNo });
}

export async function detachEwb(
  profile: SessionProfile,
  tripId: string,
  ewbId: string,
): Promise<void> {
  const db = await createSupabaseServerClient();
  const trip = await getTrip(db, tripId);
  assertDraft(trip.status);
  await db
    .from("trip_eway_bills")
    .delete()
    .eq("trip_id", tripId)
    .eq("ewb_id", ewbId);
  await logActivity(db, profile, tripId, "ewb_detached", null, { ewbId });
}

export async function updatePlan(
  profile: SessionProfile,
  tripId: string,
  input: {
    routeId: string | null;
    plannedStart: string | null;
    eta: string | null;
    notes: string | null;
  },
): Promise<void> {
  const db = await createSupabaseServerClient();
  const trip = await getTrip(db, tripId);
  assertDraft(trip.status);
  const { error } = await db
    .from("trips")
    .update({
      route_id: input.routeId,
      planned_start: input.plannedStart,
      eta: input.eta,
      notes: input.notes,
    })
    .eq("id", tripId);
  if (error) throw new Error(error.message);
  await logActivity(db, profile, tripId, "plan_updated", null, input as unknown as Json);
}

export async function setCrew(
  profile: SessionProfile,
  tripId: string,
  input: { primaryDriverId: string; secondaryDriverId: string | null },
): Promise<void> {
  const db = await createSupabaseServerClient();
  const trip = await getTrip(db, tripId);
  assertDraft(trip.status);

  await db
    .from("trip_drivers")
    .update({ released_at: new Date().toISOString() })
    .eq("trip_id", tripId)
    .is("released_at", null);

  const rows = [
    {
      org_id: profile.org_id!,
      trip_id: tripId,
      driver_id: input.primaryDriverId,
      role: "primary" as const,
    },
    ...(input.secondaryDriverId
      ? [
          {
            org_id: profile.org_id!,
            trip_id: tripId,
            driver_id: input.secondaryDriverId,
            role: "secondary" as const,
          },
        ]
      : []),
  ];
  const { error } = await db.from("trip_drivers").insert(rows);
  if (error) throw new Error(error.message);
  await logActivity(db, profile, tripId, "crew_set", null, input as unknown as Json);
}

// ── Money ────────────────────────────────────────────────────

/** Seed charges from the master rate (route + vehicle type) or zeroed defaults. */
export async function ensureCharges(
  profile: SessionProfile,
  tripId: string,
): Promise<void> {
  const db = await createSupabaseServerClient();
  const trip = await getTrip(db, tripId);

  const { data: existing } = await db
    .from("trip_charges")
    .select("id, planned_amount, approved_amount, source")
    .eq("trip_id", tripId);
  if ((existing ?? []).length > 0) {
    // An all-zero manual seed means charges were loaded before a route was
    // picked (no budget matched). Replace it so choosing the route later
    // still pulls the real budget. Anything a human touched is left alone.
    const allZeroManual = (existing ?? []).every(
      (c) => c.planned_amount === 0 && c.approved_amount === 0 && c.source === "manual",
    );
    if (!allZeroManual) return;
    await db.from("trip_charges").delete().eq("trip_id", tripId);
  }

  const { data: vehicle } = await db
    .from("vehicles")
    .select("vehicle_type, fuel_type")
    .eq("id", trip.vehicle_id)
    .single();

  let master: Record<string, number> | null = null;
  if (trip.route_id && vehicle) {
    // Team budgets are per route + fuel category (Diesel/CNG). Prefer the
    // vehicle's fuel type, fall back to Diesel, then to any live rate.
    const { data: rates } = await db
      .from("master_trip_rates")
      .select("*")
      .eq("route_id", trip.route_id)
      .is("effective_to", null)
      .order("effective_from", { ascending: false });
    const rate =
      (vehicle.fuel_type && rates?.find((r) => r.fuel_type === vehicle.fuel_type)) ||
      rates?.find((r) => r.fuel_type === "Diesel") ||
      rates?.[0] ||
      null;
    if (rate) {
      master = {
        freight: rate.freight,
        diesel: rate.diesel,
        driver_allowance: rate.driver_allowance,
        toll: rate.toll,
        fastag: rate.fastag,
        loading: rate.loading_charges,
        unloading: rate.unloading_charges,
        misc: rate.misc,
      };
    }
  }

  const rows = CHARGE_TYPES.filter((t) => t !== "detention").map((t) => ({
    org_id: profile.org_id!,
    trip_id: tripId,
    charge_type: t,
    planned_amount: master?.[t] ?? 0,
    approved_amount: master?.[t] ?? 0,
    source: (master ? "master" : "manual") as "master" | "manual",
  }));
  const { error } = await db.from("trip_charges").insert(rows);
  if (error) throw new Error(error.message);
  await logActivity(db, profile, tripId, "charges_seeded", null, {
    from: master ? "master_rate" : "defaults",
  });
}

export async function saveCharge(
  profile: SessionProfile,
  tripId: string,
  chargeId: string,
  amount: number,
): Promise<void> {
  const db = await createSupabaseServerClient();
  const { error } = await db
    .from("trip_charges")
    .update({ approved_amount: amount })
    .eq("id", chargeId)
    .eq("trip_id", tripId);
  if (error) throw new Error(error.message);
}

export async function addCharge(
  profile: SessionProfile,
  tripId: string,
  chargeType: string,
  amount: number,
): Promise<void> {
  const db = await createSupabaseServerClient();
  const { error } = await db.from("trip_charges").insert({
    org_id: profile.org_id!,
    trip_id: tripId,
    charge_type: chargeType,
    planned_amount: amount,
    approved_amount: amount,
    source: "manual",
  });
  if (error) throw new Error(error.message);
}

export async function deleteCharge(
  profile: SessionProfile,
  tripId: string,
  chargeId: string,
): Promise<void> {
  const db = await createSupabaseServerClient();
  await db.from("trip_charges").delete().eq("id", chargeId).eq("trip_id", tripId);
}

export async function addAdvance(
  profile: SessionProfile,
  tripId: string,
  input: { driverId: string; amount: number; mode: PayMode; refNo: string | null },
): Promise<void> {
  const db = await createSupabaseServerClient();
  const { error } = await db.from("advances").insert({
    org_id: profile.org_id!,
    trip_id: tripId,
    driver_id: input.driverId,
    amount: input.amount,
    mode: input.mode,
    ref_no: input.refNo,
    paid_by: profile.id,
  });
  if (error) throw new Error(error.message);
  await logActivity(db, profile, tripId, "advance_paid", null, input as unknown as Json);
}

// ── Activation & lifecycle ───────────────────────────────────

export async function approveAndActivate(
  profile: SessionProfile,
  tripId: string,
): Promise<void> {
  const db = await createSupabaseServerClient();
  const trip = await getTrip(db, tripId);
  assertDraft(trip.status);

  const [{ count: ewbCount }, { data: crew }, { count: chargeCount }] =
    await Promise.all([
      db
        .from("trip_eway_bills")
        .select("ewb_id", { count: "exact", head: true })
        .eq("trip_id", tripId),
      db
        .from("trip_drivers")
        .select("id")
        .eq("trip_id", tripId)
        .is("released_at", null)
        .limit(1),
      db
        .from("trip_charges")
        .select("id", { count: "exact", head: true })
        .eq("trip_id", tripId),
    ]);

  if (!ewbCount) throw new Error("Attach at least one E-Way Bill first");
  if (!crew?.length) throw new Error("Assign a driver first");
  if (!chargeCount) throw new Error("Set up trip charges first");
  if (!trip.planned_start || !trip.eta) {
    throw new Error("Set the start date and ETA first");
  }

  // consolidate weight from consignments
  const { data: ewbs } = await db
    .from("trip_eway_bills")
    .select("eway_bills(weight_kg)")
    .eq("trip_id", tripId);
  const totalWeight = (ewbs ?? []).reduce(
    (sum, r) => sum + (r.eway_bills?.weight_kg ?? 0),
    0,
  );

  assertTransition(trip.status, "planned");
  assertTransition("planned", "ready");

  const { error } = await db
    .from("trips")
    .update({
      status: "ready",
      total_weight_kg: totalWeight || null,
    })
    .eq("id", tripId);
  if (error) {
    if (error.code === "23505") {
      throw new Error("This vehicle already has an active trip");
    }
    throw new Error(error.message);
  }

  await db
    .from("trip_charges")
    .update({ approved_by: profile.id, approved_at: new Date().toISOString() })
    .eq("trip_id", tripId);

  await db.from("vehicles").update({ status: "on_trip" }).eq("id", trip.vehicle_id);
  await logActivity(db, profile, tripId, "trip_activated", { status: "draft" }, { status: "ready" });
}

export async function transitionTrip(
  profile: SessionProfile,
  tripId: string,
  to: TripStatus,
  reason?: string,
): Promise<void> {
  const db = await createSupabaseServerClient();
  const trip = await getTrip(db, tripId);
  assertTransition(trip.status, to);

  const now = new Date().toISOString();
  const patch: TablesUpdate<"trips"> = { status: to };
  if (to === "in_transit") patch.actual_start = now;
  if (to === "at_destination") patch.arrived_at = now;
  if (to === "unloaded") patch.unloaded_at = now;
  if (to === "ops_closed") patch.ops_closed_at = now;
  if (to === "completed") patch.completed_at = now;
  if (to === "cancelled" || to === "aborted") {
    if (!reason?.trim()) throw new Error("A reason is required to cancel a trip");
    patch.cancelled_reason = reason.trim();
  }

  const { error } = await db.from("trips").update(patch).eq("id", tripId);
  if (error) throw new Error(error.message);

  const releasesVehicle = ["ops_closed", "cancelled", "aborted"].includes(to);
  if (releasesVehicle) {
    await db.from("vehicles").update({ status: "available" }).eq("id", trip.vehicle_id);
    await db
      .from("trip_drivers")
      .update({ released_at: now })
      .eq("trip_id", tripId)
      .is("released_at", null);
  }
  if (to === "cancelled" || to === "aborted") {
    await db
      .from("trip_eway_bills")
      .update({ is_active: false })
      .eq("trip_id", tripId);
  }
  if (to === "in_transit") {
    const { data: crew } = await db
      .from("trip_drivers")
      .select("driver_id")
      .eq("trip_id", tripId)
      .is("released_at", null);
    for (const c of crew ?? []) {
      await db.from("drivers").update({ status: "on_trip" }).eq("id", c.driver_id);
    }
  }
  if (releasesVehicle) {
    const { data: crew } = await db
      .from("trip_drivers")
      .select("driver_id")
      .eq("trip_id", tripId);
    for (const c of crew ?? []) {
      await db.from("drivers").update({ status: "available" }).eq("id", c.driver_id);
    }
  }

  await logActivity(
    db,
    profile,
    tripId,
    `status_${to}`,
    { status: trip.status },
    { status: to, ...(reason ? { reason } : {}) },
  );
}
