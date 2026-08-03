import { requireOrgStaff } from "@/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchEwayBill } from "@/server/services/ewb.service";
import { parseEwayResponse } from "@lafl/marketpe";
import { formatWeightMt } from "@lafl/core";
import SelectSearch from "@/components/select-search";
import { createTrip, createTripFromEwb } from "../actions";
import {
  PageHeader,
  bannerError,
  btnGhost,
  btnPrimary,
  cardCls,
  inputCls,
  labelCls,
  pillCls,
} from "@/components/ui";

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default async function NewTripPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ewb?: string }>;
}) {
  const profile = await requireOrgStaff();
  const { error, ewb } = await searchParams;
  const db = await createSupabaseServerClient();
  const { data: vehicles } = await db
    .from("vehicles")
    .select("id, reg_no, vehicle_type, ownership, status")
    .order("reg_no")
    .limit(400);

  const available = (vehicles ?? []).filter((v) => v.status === "available");

  // ── EWB-first path: fetch & preview before creating anything ──
  let preview: {
    row: Awaited<ReturnType<typeof fetchEwayBill>>;
    distanceKm: number | null;
    vehicleNo: string | null;
    matched: { id: string; reg_no: string; status: string } | null;
    problem: string | null;
  } | null = null;
  let fetchError: string | null = null;

  if (ewb) {
    try {
      const row = await fetchEwayBill(profile.org_id!, ewb);
      const summary = parseEwayResponse(row.raw_json);
      const vehicleNo = summary?.vehicleNo ?? null;
      const matched = vehicleNo
        ? ((vehicles ?? []).find(
            (v) => v.reg_no.replace(/[^A-Z0-9]/g, "") === vehicleNo,
          ) ?? null)
        : null;
      const problem =
        row.status === "cancelled"
          ? "This E-Way Bill is CANCELLED — it cannot run a trip."
          : row.status === "expired"
            ? "This E-Way Bill has EXPIRED — get it extended before dispatch."
            : null;
      preview = { row, distanceKm: summary?.distanceKm ?? null, vehicleNo, matched, problem };
    } catch (e) {
      fetchError = e instanceof Error ? e.message : "E-Way Bill fetch failed";
    }
  }

  return (
    <div className="max-w-lg">
      <PageHeader
        title="New Trip"
        subtitle="Start with the E-Way Bill (recommended) or pick a vehicle directly."
      />
      {error && <p className={`mt-4 ${bannerError}`}>{error}</p>}
      {fetchError && <p className={`mt-4 ${bannerError}`}>{fetchError}</p>}

      {/* ── Path A: E-Way Bill first ── */}
      <div className={`mt-6 p-6 ${cardCls}`}>
        <h2 className="text-sm font-semibold text-neutral-900">Start with E-Way Bill</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Fetches the full record from the E-Way Bill portal — check the consignment, and
          the vehicle comes pre-filled from Part-B.
        </p>
        <form method="get" className="mt-3 flex gap-2">
          <input
            name="ewb"
            defaultValue={ewb ?? ""}
            placeholder="12-digit E-Way Bill number"
            pattern="\d{12}"
            required
            className={inputCls}
          />
          <button type="submit" className={btnGhost}>
            Fetch
          </button>
        </form>

        {preview && (
          <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono font-semibold">{preview.row.ewb_no}</span>
              <span
                className={`${pillCls} px-2 py-0.5 text-xs font-semibold ${
                  preview.row.status === "active"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {preview.row.status}
              </span>
            </div>
            <div className="mt-2 space-y-1 text-neutral-700">
              <div>
                <strong>{preview.row.consignor_name ?? "?"}</strong> →{" "}
                <strong>{preview.row.consignee_name ?? "?"}</strong>
              </div>
              <div>
                {preview.row.origin ?? "?"} → {preview.row.destination ?? "?"}
              </div>
              <div>
                {preview.row.material ?? "—"}
                {preview.row.weight_kg ? ` · ${formatWeightMt(preview.row.weight_kg)}` : ""}
                {preview.row.invoice_no ? ` · Inv ${preview.row.invoice_no}` : ""}
              </div>
              <div className="text-xs text-neutral-500">
                Valid till {fmt(preview.row.valid_until)}
                {preview.distanceKm ? ` · ${preview.distanceKm} km` : ""}
              </div>
              <div className="text-xs">
                Part-B vehicle:{" "}
                {preview.vehicleNo ? (
                  <span className="font-mono font-semibold">{preview.vehicleNo}</span>
                ) : (
                  <span className="text-neutral-400">not declared</span>
                )}
                {preview.matched && preview.matched.status !== "available" && (
                  <span className="ml-1 font-semibold text-amber-700">
                    — this vehicle is {preview.matched.status.replace(/_/g, " ")}!
                  </span>
                )}
                {preview.vehicleNo && !preview.matched && (
                  <span className="ml-1 text-neutral-400">— not in your fleet</span>
                )}
              </div>
            </div>

            {preview.problem ? (
              <p className={`mt-3 ${bannerError}`}>{preview.problem}</p>
            ) : (
              <form action={createTripFromEwb} className="mt-4 space-y-2">
                <input type="hidden" name="ewbNo" value={preview.row.ewb_no} />
                <label className={labelCls}>Vehicle (available only)</label>
                <SelectSearch
                  name="vehicleId"
                  required
                  placeholder="Type or select truck number…"
                  defaultValue={
                    preview.matched?.status === "available" ? preview.matched.id : ""
                  }
                  options={available.map((v) => ({
                    value: v.id,
                    label: v.reg_no,
                    hint: `${v.vehicle_type} · ${v.ownership}`,
                  }))}
                />
                <button type="submit" className={btnPrimary}>
                  Create trip with this E-Way Bill →
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* ── Path B: vehicle first (original flow) ── */}
      <div className={`mt-4 p-6 ${cardCls}`}>
        <h2 className="text-sm font-semibold text-neutral-900">Start with vehicle</h2>
        <form action={createTrip} className="mt-3 space-y-4">
          <div>
            <label className={labelCls}>Vehicle (available only)</label>
            <SelectSearch
              name="vehicleId"
              required
              placeholder="Type or select truck number…"
              options={available.map((v) => ({
                value: v.id,
                label: v.reg_no,
                hint: `${v.vehicle_type} · ${v.ownership}`,
              }))}
            />
          </div>
          <button type="submit" className={btnPrimary}>
            Create draft trip →
          </button>
        </form>
      </div>
    </div>
  );
}
