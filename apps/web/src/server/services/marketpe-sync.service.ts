// NOTE: no "server-only" here — this module is also used by CLI scripts.
// It must never be imported from client components (it takes a service-role client).

import type { Database, Json, VehicleOwnership } from "@lafl/core";
import { MarketPeClient, type MarketPeVehicle, type MarketPeVendor } from "@lafl/marketpe";
import type { SupabaseClient } from "@supabase/supabase-js";

type Db = SupabaseClient<Database>;

export interface SyncResult {
  drivers: number;
  vehicles: number;
  skipped: number;
}

/**
 * Pull org masters from MarketPe (drivers via vendor/list, fleet via
 * vehicle/list) and upsert into Lafl keyed by (org_id, marketpe_id).
 * Full payloads land in marketpe_raw so unmapped fields are never lost.
 */
export async function syncOrgMasters(db: Db, orgId: string): Promise<SyncResult> {
  const { data: integ } = await db
    .from("org_integrations")
    .select("marketpe_api_key, marketpe_base_url")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!integ?.marketpe_api_key) {
    throw new Error("MarketPe is not configured for this organization");
  }

  const mp = new MarketPeClient({
    apiKey: integ.marketpe_api_key,
    baseUrl: integ.marketpe_base_url ?? undefined,
  });

  let skipped = 0;

  // ── Drivers ──
  const vendorRes = await mp.vendorList({ type: "DRIVER" });
  const seenPhones = new Set<string>();
  const driverRows = vendorRes.data.flatMap((v: MarketPeVendor) => {
    const phone = typeof v.phone === "string" ? v.phone.trim() : "";
    if (!v.id || !phone || seenPhones.has(phone)) {
      skipped++;
      return [];
    }
    seenPhones.add(phone);
    return [
      {
        org_id: orgId,
        marketpe_id: v.id,
        name: v.name?.trim() || "Unknown",
        phone,
        license_no: extractDlNumber(v),
        marketpe_raw: v as Json,
      },
    ];
  });
  if (driverRows.length > 0) {
    const { error } = await db
      .from("drivers")
      .upsert(driverRows, { onConflict: "org_id,marketpe_id" });
    if (error) throw new Error(`driver sync failed: ${error.message}`);
  }

  // ── Vehicles ──
  const vehicleRes = await mp.vehicleList({});
  const seenRegs = new Set<string>();
  const vehicleRows = vehicleRes.data.flatMap((v: MarketPeVehicle) => {
    const regNo = v.registrationNumber?.trim().toUpperCase() ?? "";
    if (!v.id || !regNo || seenRegs.has(regNo)) {
      skipped++;
      return [];
    }
    seenRegs.add(regNo);
    const ownership: VehicleOwnership =
      v.vehicleOwnerType === "OWNED" || v.vehicleOwnerType === "ATTACHED"
        ? v.vehicleOwnerType
        : "MARKET";
    return [
      {
        org_id: orgId,
        marketpe_id: v.id,
        reg_no: regNo,
        vehicle_type: "UNKNOWN", // MarketPe doesn't expose type; org fills in later
        ownership,
        marketpe_raw: v as Json,
      },
    ];
  });
  if (vehicleRows.length > 0) {
    const { error } = await db
      .from("vehicles")
      .upsert(vehicleRows, { onConflict: "org_id,marketpe_id" });
    if (error) throw new Error(`vehicle sync failed: ${error.message}`);
  }

  return { drivers: driverRows.length, vehicles: vehicleRows.length, skipped };
}

export interface TripSyncResult {
  customers: number;
  routes: number;
  trips: number;
  crew: number;
}

/**
 * Import historical bookings from MarketPe trip-simple/list into Lafl:
 * customers (from consignor/consignee), routes (from from/to place), trips
 * (keyed by org_id+marketpe_id) and crew links. MarketPe has no lifecycle
 * statuses (everything is NEW), so imports land as completed (or cancelled).
 */
export async function syncOrgTrips(
  db: Db,
  orgId: string,
  range: { createdTimeFrom: string; createdTimeTo: string },
): Promise<TripSyncResult> {
  const { data: integ } = await db
    .from("org_integrations")
    .select("marketpe_api_key, marketpe_base_url")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!integ?.marketpe_api_key) {
    throw new Error("MarketPe is not configured for this organization");
  }
  const mp = new MarketPeClient({
    apiKey: integ.marketpe_api_key,
    baseUrl: integ.marketpe_base_url ?? undefined,
  });

  const res = await mp.tripList(range);
  const raw = res.data as Array<Record<string, unknown>>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const num = (v: unknown) => (typeof v === "number" ? v : null);

  // ── Customers (dedupe by gstin+name; that pair is the marketpe_id key) ──
  const custMap = new Map<string, { gstin: string | null; name: string }>();
  for (const t of raw) {
    for (const side of ["consignor", "consignee"] as const) {
      const name = str(t[`${side}Name`]);
      const gstin = str(t[`${side}Gstin`]);
      if (!name) continue;
      custMap.set(`${gstin ?? ""}|${name}`, { gstin, name });
    }
  }
  const custRows = [...custMap.entries()].map(([key, c]) => ({
    org_id: orgId,
    marketpe_id: key,
    name: c.name,
    gstin: c.gstin,
  }));
  if (custRows.length) {
    const { error } = await db
      .from("customers")
      .upsert(custRows, { onConflict: "org_id,marketpe_id" });
    if (error) throw new Error(`customer sync failed: ${error.message}`);
  }

  // ── Routes (unique per org on origin+dest) ──
  const routeMap = new Map<string, { o: string; d: string; km: number | null }>();
  for (const t of raw) {
    const o = str(t.fromPlace);
    const d = str(t.toPlace);
    if (!o || !d) continue;
    const key = `${o}|${d}`;
    if (!routeMap.has(key)) routeMap.set(key, { o, d, km: num(t.distanceKm) });
  }
  const routeRows = [...routeMap.values()].map((r) => ({
    org_id: orgId,
    origin_city: r.o,
    dest_city: r.d,
    distance_km: r.km,
  }));
  if (routeRows.length) {
    const { error } = await db
      .from("routes")
      .upsert(routeRows, { onConflict: "org_id,origin_city,dest_city" });
    if (error) throw new Error(`route sync failed: ${error.message}`);
  }
  const { data: routes } = await db
    .from("routes")
    .select("id, origin_city, dest_city")
    .eq("org_id", orgId);
  const routeIds = new Map(
    (routes ?? []).map((r) => [`${r.origin_city}|${r.dest_city}`, r.id]),
  );

  // ── Vehicle / driver lookups by marketpe id ──
  const { data: vehicles } = await db
    .from("vehicles")
    .select("id, marketpe_id")
    .eq("org_id", orgId);
  const vehicleIds = new Map(
    (vehicles ?? []).filter((v) => v.marketpe_id).map((v) => [v.marketpe_id!, v.id]),
  );
  const { data: drivers } = await db
    .from("drivers")
    .select("id, marketpe_id")
    .eq("org_id", orgId);
  const driverIds = new Map(
    (drivers ?? []).filter((d) => d.marketpe_id).map((d) => [d.marketpe_id!, d.id]),
  );

  // ── Trips ──
  const tripRows = raw.flatMap((t) => {
    const mpId = str(t.id);
    const vehicleId = vehicleIds.get(str(t.vehicleId) ?? "");
    if (!mpId || !vehicleId) return [];
    const created = str(t.createdTime) ?? new Date().toISOString();
    const updated = str(t.updatedTime) ?? created;
    const cancelled = str(t.tripStatus) === "CANCELLED";
    const routeKey = `${str(t.fromPlace)}|${str(t.toPlace)}`;
    return [
      {
        org_id: orgId,
        marketpe_id: mpId,
        vehicle_id: vehicleId,
        route_id: routeIds.get(routeKey) ?? null,
        status: (cancelled ? "cancelled" : "completed") as "cancelled" | "completed",
        pod_status: (cancelled ? "awaited" : "verified") as "awaited" | "verified",
        settlement_status: (cancelled ? "pending" : "paid") as "pending" | "paid",
        billing_status: (cancelled ? "unbilled" : "received") as "unbilled" | "received",
        planned_start: created,
        actual_start: cancelled ? null : created,
        eta: updated,
        ops_closed_at: cancelled ? null : updated,
        completed_at: cancelled ? null : updated,
        cancelled_reason: cancelled ? "Cancelled in MarketPe" : null,
        notes: `${str(t.consignorName) ?? ""} → ${str(t.consigneeName) ?? ""} (MarketPe ${str(t.autoIdentifier) ?? ""})`,
        created_at: created,
      },
    ];
  });
  for (let i = 0; i < tripRows.length; i += 400) {
    const { error } = await db
      .from("trips")
      .upsert(tripRows.slice(i, i + 400), { onConflict: "org_id,marketpe_id" });
    if (error) throw new Error(`trip sync failed: ${error.message}`);
  }

  // ── Crew links (skip trips that already have crew) ──
  const { data: synced } = await db
    .from("trips")
    .select("id, marketpe_id")
    .eq("org_id", orgId)
    .not("marketpe_id", "is", null);
  const tripIdByMp = new Map((synced ?? []).map((t) => [t.marketpe_id!, t.id]));
  const { data: existingCrew } = await db
    .from("trip_drivers")
    .select("trip_id")
    .eq("org_id", orgId);
  const hasCrew = new Set((existingCrew ?? []).map((c) => c.trip_id));

  const crewRows = raw.flatMap((t) => {
    const tripId = tripIdByMp.get(str(t.id) ?? "");
    const driverId = driverIds.get(str(t.driverId) ?? "");
    if (!tripId || !driverId || hasCrew.has(tripId)) return [];
    hasCrew.add(tripId);
    return [{ org_id: orgId, trip_id: tripId, driver_id: driverId, role: "primary" as const }];
  });
  for (let i = 0; i < crewRows.length; i += 400) {
    const { error } = await db.from("trip_drivers").insert(crewRows.slice(i, i + 400));
    if (error) throw new Error(`crew sync failed: ${error.message}`);
  }

  return {
    customers: custRows.length,
    routes: routeRows.length,
    trips: tripRows.length,
    crew: crewRows.length,
  };
}

/** DL shape is undocumented — probe the likely spots, fall back to raw. */
function extractDlNumber(v: MarketPeVendor): string | null {
  const dl = v.dl;
  if (typeof dl === "string" && dl.trim()) return dl.trim();
  if (dl && typeof dl === "object") {
    const o = dl as Record<string, unknown>;
    for (const key of ["number", "dlNumber", "licenseNumber"]) {
      if (typeof o[key] === "string" && (o[key] as string).trim()) {
        return (o[key] as string).trim();
      }
    }
  }
  const fallback = v.dlNumberIfDataNotFound;
  if (typeof fallback === "string" && fallback.trim()) return fallback.trim();
  return null;
}

// ── Payment reconciliation (the "chowkidaar") ────────────────

export interface PaymentSyncResult {
  scanned: number;
  matched: number;
  alreadyRecorded: number;
  unmatched: number;
}

const MODE_MAP: Record<string, "upi" | "bank" | "cash"> = {
  UPI: "upi",
  CASH: "cash",
  NEFT: "bank",
  IMPS: "bank",
  RTGS: "bank",
  BANK: "bank",
};

/**
 * Read MarketPe's payment ledger and auto-mark matching driver settlements
 * as PAID. Strict matching only — a payment marks a settlement when:
 *   trip matches (marketpe trip id) AND driver matches (vendor id) AND
 *   (clientPaymentId === settlement id OR amount === net_payable ±1).
 * Anything else stays untouched and is reported as unmatched — the
 * chowkidaar never guesses with money.
 */
export async function syncOrgPayments(
  db: Db,
  orgId: string,
  range: { createdTimeFrom: string; createdTimeTo: string },
): Promise<PaymentSyncResult> {
  const { data: integ } = await db
    .from("org_integrations")
    .select("marketpe_api_key, marketpe_base_url")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!integ?.marketpe_api_key) {
    throw new Error("MarketPe is not configured for this organization");
  }
  const mp = new MarketPeClient({
    apiKey: integ.marketpe_api_key,
    baseUrl: integ.marketpe_base_url ?? undefined,
  });

  const res = await mp.paymentList(range);
  const payments = res.data as Array<Record<string, unknown>>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  const [{ data: trips }, { data: drivers }, { data: settlements }] =
    await Promise.all([
      db.from("trips").select("id, marketpe_id").eq("org_id", orgId).not("marketpe_id", "is", null),
      db.from("drivers").select("id, marketpe_id").eq("org_id", orgId).not("marketpe_id", "is", null),
      db
        .from("driver_settlements")
        .select("id, trip_id, driver_id, net_payable, status, marketpe_payment_id")
        .eq("org_id", orgId),
    ]);
  const tripByMp = new Map((trips ?? []).map((t) => [t.marketpe_id!, t.id]));
  const driverByMp = new Map((drivers ?? []).map((d) => [d.marketpe_id!, d.id]));
  const recorded = new Set(
    (settlements ?? []).map((s) => s.marketpe_payment_id).filter(Boolean),
  );

  const result: PaymentSyncResult = {
    scanned: payments.length,
    matched: 0,
    alreadyRecorded: 0,
    unmatched: 0,
  };

  for (const p of payments) {
    const paymentId = str(p.id);
    if (!paymentId || str(p.status) !== "COMPLETED") continue;
    if (recorded.has(paymentId)) {
      result.alreadyRecorded++;
      continue;
    }
    const tripId = tripByMp.get(str(p.tripId) ?? "");
    const vendor = p.vendor as Record<string, unknown> | null;
    const driverId = driverByMp.get(str(vendor?.id) ?? "");
    // MarketPe sends amount sometimes as number, sometimes as string ("1600")
    const amount = Number(p.amount);
    if (!tripId || !driverId || !Number.isFinite(amount)) {
      result.unmatched++;
      continue;
    }
    const settlement = (settlements ?? []).find(
      (s) =>
        s.trip_id === tripId &&
        s.driver_id === driverId &&
        s.status !== "paid" &&
        (str(p.clientPaymentId) === s.id || Math.abs(s.net_payable - amount) <= 1),
    );
    if (!settlement) {
      result.unmatched++;
      continue;
    }

    const mode = MODE_MAP[(str(p.paymentMode) ?? "").toUpperCase()] ?? "bank";
    await db
      .from("driver_settlements")
      .update({
        status: "paid",
        mode,
        ref_no: str(p.utr) ?? paymentId,
        paid_at: str(p.completedTime) ?? str(p.updatedTime) ?? new Date().toISOString(),
        marketpe_payment_id: paymentId,
      })
      .eq("id", settlement.id)
      .neq("status", "paid");
    settlement.status = "paid";
    recorded.add(paymentId);
    result.matched++;

    await recomputeSettlementAndCompletion(db, orgId, tripId);
  }
  return result;
}

/** Script-safe copy of trip settlement rollup + auto-completion. */
async function recomputeSettlementAndCompletion(
  db: Db,
  orgId: string,
  tripId: string,
): Promise<void> {
  const { data: rows } = await db
    .from("driver_settlements")
    .select("status")
    .eq("trip_id", tripId);
  if (!rows?.length) return;
  const paid = rows.filter((r) => r.status === "paid").length;
  const settlementStatus =
    paid === rows.length ? "paid" : paid > 0 ? "partially_paid" : "pending";
  await db.from("trips").update({ settlement_status: settlementStatus }).eq("id", tripId);

  if (settlementStatus !== "paid") return;
  const { data: trip } = await db
    .from("trips")
    .select("status, pod_status")
    .eq("id", tripId)
    .single();
  if (trip?.status === "ops_closed" && trip.pod_status === "verified") {
    await db
      .from("trips")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", tripId)
      .eq("status", "ops_closed");
    await db.from("activity_logs").insert({
      org_id: orgId,
      entity_type: "trip",
      entity_id: tripId,
      action: "trip_completed_auto",
      new_value: { trigger: "marketpe_payment_sync" },
    });
  }
}
