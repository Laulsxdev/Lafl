/**
 * Parser for the MarketPe eway/get response (NIC E-Way Bill format).
 * Verified against real EWBs on 2026-08-01 — key fields:
 *   data.fromTrdName/toTrdName (parties), fromPlace/toPlace, itemList[]
 *   (productDesc, quantity, qtyUnit KGS|TON), docNo, totInvValue,
 *   validUpto "DD/MM/YYYY hh:mm:ss AM/PM" (IST), ewayBillDate, actualDist,
 *   status ACT|CNL, transporterId/transporterName.
 */

export interface EwaySummary {
  ewbNo: string;
  status: "active" | "cancelled";
  consignorName: string | null;
  consignorGstin: string | null;
  consigneeName: string | null;
  consigneeGstin: string | null;
  origin: string | null;
  destination: string | null;
  material: string | null;
  weightKg: number | null;
  invoiceNo: string | null;
  invoiceValue: number | null;
  generatedAt: string | null; // ISO
  validUntil: string | null; // ISO
  distanceKm: number | null;
  /** Latest Part-B vehicle number (normalized, no spaces), if declared. */
  vehicleNo: string | null;
}

/** "30/07/2026 05:40:00 PM" (IST) -> ISO string. Date-only also accepted. */
export function parseNicDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = value
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM))?$/i);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, mi, ss, ap] = m;
  let hour = hh ? parseInt(hh, 10) : 0;
  if (ap?.toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (ap?.toUpperCase() === "AM" && hour === 12) hour = 0;
  const iso = `${yyyy}-${mm}-${dd}T${String(hour).padStart(2, "0")}:${mi ?? "00"}:${ss ?? "00"}+05:30`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function parseEwayResponse(raw: unknown): EwaySummary | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  const d = (root.data ?? root) as Record<string, unknown>;
  if (d.ewbNo === undefined && d.ewayBillNumber === undefined) return null;

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

  const items = Array.isArray(d.itemList)
    ? (d.itemList as Array<Record<string, unknown>>)
    : [];

  // NIC UQC weight units -> kg multiplier. Non-weight units (NOS, MTR, BAG…)
  // are skipped: counting boxes as kilograms would corrupt the load weight.
  const KG_FACTOR: Record<string, number> = {
    KGS: 1,
    KG: 1,
    TON: 1000,
    TNE: 1000,
    MTS: 1000, // metric ton
    QTL: 100, // quintal
    GMS: 0.001,
  };
  let weightKg: number | null = null;
  for (const it of items) {
    const qty = num(it.quantity);
    if (qty === null) continue;
    const unit = (str(it.qtyUnit) ?? "").toUpperCase().replace(/[^A-Z]/g, "");
    const factor =
      KG_FACTOR[unit] ?? (unit.startsWith("TON") ? 1000 : undefined);
    if (factor !== undefined) weightKg = (weightKg ?? 0) + qty * factor;
  }

  const material =
    items
      .map((it) => str(it.productDesc) ?? str(it.productName))
      .filter(Boolean)
      .join(", ") || null;

  // Part-B vehicle history — NIC spells it "VehiclListDetails" (sic). The
  // LAST entry is the currently assigned vehicle.
  const vehList = [d.VehiclListDetails, d.vehiclListDetails, d.vehicleListDetails].find(
    Array.isArray,
  ) as Array<Record<string, unknown>> | undefined;
  const lastVeh = vehList?.[vehList.length - 1];
  const vehicleNo =
    str(lastVeh?.vehicleNo)?.toUpperCase().replace(/[^A-Z0-9]/g, "") ?? null;

  return {
    ewbNo: String(d.ewbNo ?? d.ewayBillNumber),
    status: str(d.status)?.toUpperCase() === "CNL" ? "cancelled" : "active",
    consignorName: str(d.fromTrdName),
    consignorGstin: str(d.fromGstin),
    consigneeName: str(d.toTrdName),
    consigneeGstin: str(d.toGstin),
    origin: str(d.fromPlace),
    destination: str(d.toPlace),
    material,
    weightKg: weightKg === null ? null : Math.round(weightKg * 10) / 10,
    invoiceNo: str(d.docNo),
    invoiceValue: num(d.totInvValue) ?? num(d.totalValue),
    generatedAt: parseNicDate(d.ewayBillDate) ?? parseNicDate(d.docDate),
    validUntil: parseNicDate(d.validUpto),
    distanceKm: num(d.actualDist),
    vehicleNo,
  };
}
