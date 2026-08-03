import "server-only";

import type { Json, PayMode } from "@lafl/core";
import { splitByWeight } from "@lafl/core";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SessionProfile } from "@/server/auth";
import { maybeCompleteTrip } from "./pod.service";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Settlements can be generated once the operational run is over. */
const SETTLEABLE = ["ops_closed", "completed"];

/**
 * Create one settlement row per driver who worked the trip.
 * Gross = driver's share of (driver_allowance charge + approved expenses),
 * split by days worked on the trip (leg length) for mid-trip driver changes.
 */
export async function generateSettlements(
  profile: SessionProfile,
  tripId: string,
): Promise<void> {
  const db = await createSupabaseServerClient();
  const { data: trip } = await db.from("trips").select("*").eq("id", tripId).single();
  if (!trip) throw new Error("Trip not found");
  if (!SETTLEABLE.includes(trip.status)) {
    throw new Error("Settlements open only after the trip's ops are closed");
  }

  const { count: existing } = await db
    .from("driver_settlements")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId);
  if ((existing ?? 0) > 0) throw new Error("Settlements already generated for this trip");

  const [{ data: crew }, { data: charges }, { data: expenses }] = await Promise.all([
    db
      .from("trip_drivers")
      .select("driver_id, role, assigned_at, released_at")
      .eq("trip_id", tripId)
      .in("role", ["primary", "secondary"]),
    db.from("trip_charges").select("charge_type, approved_amount").eq("trip_id", tripId),
    db.from("trip_expenses").select("amount, approved").eq("trip_id", tripId),
  ]);
  if (!crew?.length) throw new Error("No drivers were assigned to this trip");

  const allowance = (charges ?? [])
    .filter((c) => c.charge_type === "driver_allowance")
    .reduce((s, c) => s + c.approved_amount, 0);
  // Only APPROVED en-route expenses reimburse the driver.
  const approvedExpenses = (expenses ?? [])
    .filter((e) => e.approved)
    .reduce((s, e) => s + e.amount, 0);
  const pool = round2(allowance + approvedExpenses);

  // Split by time worked (ms of leg). Unreleased legs run to trip close/now.
  const end = Date.parse(trip.ops_closed_at ?? new Date().toISOString());
  const uniqueDrivers = new Map<string, number>();
  for (const c of crew) {
    const worked = Math.max(
      (c.released_at ? Date.parse(c.released_at) : end) - Date.parse(c.assigned_at),
      1,
    );
    uniqueDrivers.set(c.driver_id, (uniqueDrivers.get(c.driver_id) ?? 0) + worked);
  }
  const driverIds = [...uniqueDrivers.keys()];
  const shares =
    driverIds.length === 1
      ? [pool]
      : splitByWeight(pool, driverIds.map((id) => uniqueDrivers.get(id)!));

  for (let i = 0; i < driverIds.length; i++) {
    const driverId = driverIds[i]!;
    const advances = await sumAdvances(db, tripId, driverId);
    const gross = shares[i] ?? 0;
    const { error } = await db.from("driver_settlements").insert({
      org_id: profile.org_id!,
      trip_id: tripId,
      driver_id: driverId,
      gross_amount: gross,
      advances_deducted: advances,
      net_payable: round2(gross - advances),
    });
    if (error) throw new Error(error.message);
  }

  await recomputeTripSettlementStatus(db, tripId);
  await db.from("activity_logs").insert({
    org_id: profile.org_id!,
    entity_type: "trip",
    entity_id: tripId,
    action: "settlements_generated",
    new_value: { drivers: driverIds.length, pool } as Json,
    actor_id: profile.id,
  });
}

export async function updateSettlement(
  profile: SessionProfile,
  settlementId: string,
  input: { gross: number; bonus: number; penalty: number; penaltyReason: string | null },
): Promise<void> {
  if (input.penalty > 0 && !input.penaltyReason?.trim()) {
    throw new Error("A reason is required when applying a penalty");
  }
  if (input.gross < 0 || input.bonus < 0 || input.penalty < 0) {
    throw new Error("Amounts cannot be negative");
  }
  const db = await createSupabaseServerClient();
  const { data: s } = await db
    .from("driver_settlements")
    .select("*")
    .eq("id", settlementId)
    .single();
  if (!s) throw new Error("Settlement not found");
  if (s.status === "paid") throw new Error("Paid settlements cannot be edited");

  // Re-pull advances every save — a fuel advance added after generation
  // must never be silently missed.
  const advances = await sumAdvances(db, s.trip_id, s.driver_id);
  const net = round2(input.gross + input.bonus - input.penalty - advances);

  const { error } = await db
    .from("driver_settlements")
    .update({
      gross_amount: input.gross,
      bonus: input.bonus,
      penalty: input.penalty,
      penalty_reason: input.penaltyReason?.trim() || null,
      advances_deducted: advances,
      net_payable: net,
    })
    .eq("id", settlementId);
  if (error) throw new Error(error.message);
}

export async function markSettlementPaid(
  profile: SessionProfile,
  settlementId: string,
  input: { mode: PayMode; refNo: string | null },
): Promise<void> {
  const db = await createSupabaseServerClient();
  const { data: s } = await db
    .from("driver_settlements")
    .select("*")
    .eq("id", settlementId)
    .single();
  if (!s) throw new Error("Settlement not found");
  if (s.status === "paid") return; // idempotent
  if (s.net_payable > 0 && !input.refNo?.trim() && input.mode !== "cash") {
    throw new Error("A reference/UTR number is required for non-cash payments");
  }

  // Freshness check: if advances changed since the numbers were last saved,
  // force a re-save instead of paying a stale amount.
  const advancesNow = await sumAdvances(db, s.trip_id, s.driver_id);
  if (round2(advancesNow) !== round2(s.advances_deducted)) {
    throw new Error(
      "Advances changed since this settlement was computed — press Save on the row, review the new net amount, then pay",
    );
  }

  const { error } = await db
    .from("driver_settlements")
    .update({
      status: "paid",
      mode: input.mode,
      ref_no: input.refNo?.trim() || null,
      paid_at: new Date().toISOString(),
      paid_by: profile.id,
    })
    .eq("id", settlementId)
    .neq("status", "paid");
  if (error) throw new Error(error.message);

  await recomputeTripSettlementStatus(db, s.trip_id);
  await db.from("activity_logs").insert({
    org_id: s.org_id,
    entity_type: "trip",
    entity_id: s.trip_id,
    action: "settlement_paid",
    new_value: { settlementId, net: s.net_payable, mode: input.mode, ref: input.refNo } as Json,
    actor_id: profile.id,
  });
  await maybeCompleteTrip(s.trip_id, profile.id);
}

async function sumAdvances(
  db: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tripId: string,
  driverId: string,
): Promise<number> {
  const { data } = await db
    .from("advances")
    .select("amount")
    .eq("trip_id", tripId)
    .eq("driver_id", driverId);
  return round2((data ?? []).reduce((s, a) => s + a.amount, 0));
}

async function recomputeTripSettlementStatus(
  db: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tripId: string,
): Promise<void> {
  const { data: rows } = await db
    .from("driver_settlements")
    .select("status")
    .eq("trip_id", tripId);
  if (!rows?.length) return;
  const paid = rows.filter((r) => r.status === "paid").length;
  const status =
    paid === rows.length ? "paid" : paid > 0 ? "partially_paid" : "pending";
  await db.from("trips").update({ settlement_status: status }).eq("id", tripId);
}
