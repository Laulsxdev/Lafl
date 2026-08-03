import { notFound } from "next/navigation";
import { CHARGE_TYPES, formatInr, formatWeightMt } from "@lafl/core";
import { parseEwayResponse } from "@lafl/marketpe";
import { requireOrgStaff } from "@/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import ConfirmSubmit from "@/components/confirm-submit";
import SelectSearch from "@/components/select-search";
import SharePodLink from "@/components/share-pod-link";
import { STATUS_PILL } from "@/features/status";
import {
  SectionCard,
  bannerError,
  bannerOk,
  btnDanger,
  btnGhost,
  btnPrimary,
  btnSuccess,
  inputCls,
  inputSmCls,
  labelCls,
  pillCls,
} from "@/components/ui";
import {
  activateTrip,
  addAdvanceAction,
  addChargeAction,
  attachEwbFetch,
  attachEwbManualAction,
  deleteChargeAction,
  deleteTripAction,
  detachEwbAction,
  generateInvoiceAction,
  generateSettlementsAction,
  recordReceiptAction,
  loadCharges,
  markSettlementPaidAction,
  rejectPodAction,
  saveChargeAction,
  saveCrew,
  savePlan,
  transitionAction,
  updateSettlementAction,
  uploadPodAction,
  verifyPodAction,
} from "../actions";

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
const toLocalInput = (d: string | null) =>
  d ? new Date(new Date(d).getTime() + 330 * 60000).toISOString().slice(0, 16) : "";

const NEXT_ACTION: Record<
  string,
  { to: string; label: string; note?: string } | undefined
> = {
  ready: { to: "in_transit", label: "Start Trip", note: "(driver app will do this later)" },
  in_transit: {
    to: "at_destination",
    label: "Mark Arrived",
    note: "(geofence does this automatically in production)",
  },
  at_destination: { to: "unloaded", label: "Unload Completed" },
  unloaded: {
    to: "ops_closed",
    label: "Vehicle Left — Close Ops",
    note: "(frees the vehicle for its next trip)",
  },
  ops_closed: { to: "completed", label: "Mark Trip Completed" },
};

export default async function TripDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  await requireOrgStaff();
  const { tripId } = await params;
  const { error, ok } = await searchParams;

  const db = await createSupabaseServerClient();
  const { data: trip } = await db
    .from("trips")
    .select("*, vehicles(reg_no, vehicle_type), routes(origin_city, dest_city)")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) notFound();

  const [
    { data: ewbLinks },
    { data: crew },
    { data: charges },
    { data: advances },
    { data: activity },
    { data: routes },
    { data: drivers },
  ] = await Promise.all([
    db
      .from("trip_eway_bills")
      .select("ewb_id, eway_bills(id, ewb_no, consignor_name, consignee_name, origin, destination, material, weight_kg, valid_until, status, raw_json)")
      .eq("trip_id", tripId),
    db
      .from("trip_drivers")
      .select("id, role, released_at, drivers(id, name, phone)")
      .eq("trip_id", tripId)
      .order("assigned_at"),
    db.from("trip_charges").select("*").eq("trip_id", tripId).order("created_at"),
    db
      .from("advances")
      .select("amount, mode, ref_no, paid_at, drivers(name)")
      .eq("trip_id", tripId),
    db
      .from("activity_logs")
      .select("action, new_value, ts")
      .eq("entity_type", "trip")
      .eq("entity_id", tripId)
      .order("ts", { ascending: false })
      .limit(15),
    db.from("routes").select("id, origin_city, dest_city").order("origin_city").limit(200),
    db
      .from("drivers")
      .select("id, name, phone")
      .eq("status", "available")
      .order("name")
      .limit(200),
  ]);

  const isInvoiceable = ["ops_closed", "completed"].includes(trip.status);
  const [{ data: invoice }, { data: customers }, { data: contractLines }] =
    await Promise.all([
      db.from("customer_invoices").select("*").eq("trip_id", tripId).maybeSingle(),
      isInvoiceable
        ? db.from("customers").select("id, name, gstin").order("name").limit(200)
        : Promise.resolve({ data: [] as { id: string; name: string; gstin: string | null }[] }),
      isInvoiceable
        ? db
            .from("freight_contracts")
            .select("id, origin_name, dest_city, category, rate_per_mt")
            .order("dest_city")
            .order("origin_name")
            .limit(400)
        : Promise.resolve({
            data: [] as { id: string; origin_name: string; dest_city: string; category: string; rate_per_mt: number }[],
          }),
    ]);

  const [{ data: pods }, { data: settlements }] = await Promise.all([
    db
      .from("pods")
      .select("id, ewb_id, file_url, status, rejection_reason, uploaded_at, source, capture_lat, capture_lng, eway_bills(ewb_no)")
      .eq("trip_id", tripId)
      .order("uploaded_at", { ascending: false }),
    db
      .from("driver_settlements")
      .select("*, drivers(name, phone)")
      .eq("trip_id", tripId)
      .order("created_at"),
  ]);

  // Signed URLs for the private POD bucket (1 hour validity).
  const admin = createSupabaseAdminClient();
  const podUrls = new Map<string, string>();
  for (const p of pods ?? []) {
    const { data: signed } = await admin.storage
      .from("pods")
      .createSignedUrl(p.file_url, 3600);
    if (signed) podUrls.set(p.id, signed.signedUrl);
  }

  const isDraft = trip.status === "draft";

  // Compliance guard: the E-Way Bill's Part-B declares which vehicle carries
  // the load. If the trip runs a different vehicle, checkposts can fine —
  // warn loudly until dispatch, but never block (Part-B is often updated late).
  const tripReg = (trip.vehicles?.reg_no ?? "").replace(/[^A-Z0-9]/g, "");
  const partBMismatches =
    tripReg && ["draft", "planned", "ready", "in_transit"].includes(trip.status)
      ? (ewbLinks ?? []).flatMap((l) => {
          const partB = parseEwayResponse(l.eway_bills?.raw_json)?.vehicleNo ?? null;
          return partB && partB !== tripReg
            ? [{ ewbNo: l.eway_bills?.ewb_no ?? "?", partB }]
            : [];
        })
      : [];

  // Rank routes by how well they match the attached E-Way Bills' places —
  // the EWB already knows where the load is going, so "→ JAJPUR" routes
  // surface first and the best destination match comes pre-selected.
  const placeTokens = (s: string | null | undefined) =>
    (s ?? "")
      .toUpperCase()
      .split(/[^A-Z]+/)
      .filter((w) => w.length >= 3);
  const ewbDestTokens = new Set(
    (ewbLinks ?? []).flatMap((l) => placeTokens(l.eway_bills?.destination)),
  );
  const ewbOriginTokens = new Set(
    (ewbLinks ?? []).flatMap((l) => placeTokens(l.eway_bills?.origin)),
  );
  const routeMatchScore = (r: { origin_city: string; dest_city: string }) => {
    let score = 0;
    if (placeTokens(r.dest_city).some((t) => ewbDestTokens.has(t))) score += 2;
    if (placeTokens(r.origin_city).some((t) => ewbOriginTokens.has(t))) score += 1;
    return score;
  };
  const rankedRoutes = (routes ?? [])
    .map((r) => ({ ...r, score: routeMatchScore(r) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        `${a.origin_city}${a.dest_city}`.localeCompare(`${b.origin_city}${b.dest_city}`),
    );
  const suggestedRoute =
    !trip.route_id && ewbDestTokens.size > 0
      ? (rankedRoutes.find((r) => r.score >= 2) ?? null)
      : null;

  // Pre-fill crew from this vehicle's most recent trip — drivers usually
  // stick to their truck, so the right name is one click away.
  let lastPrimary = "";
  let lastSecondary = "";
  if (isDraft && (crew ?? []).length === 0) {
    const { data: lastCrew } = await db
      .from("trip_drivers")
      .select("driver_id, role, assigned_at, trips!inner(vehicle_id)")
      .eq("trips.vehicle_id", trip.vehicle_id)
      .neq("trip_id", tripId)
      .order("assigned_at", { ascending: false })
      .limit(4);
    lastPrimary = lastCrew?.find((c) => c.role === "primary")?.driver_id ?? "";
    lastSecondary = lastCrew?.find((c) => c.role === "secondary")?.driver_id ?? "";
  }
  const activeCrew = (crew ?? []).filter((c) => !c.released_at);
  const totalApproved = (charges ?? []).reduce((s, c) => s + c.approved_amount, 0);
  const totalAdvances = (advances ?? []).reduce((s, a) => s + a.amount, 0);
  const next = NEXT_ACTION[trip.status];

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{trip.trip_no}</h1>
        <a
          href={`/print/trip/${tripId}`}
          target="_blank"
          className="text-xs font-medium text-neutral-500 underline underline-offset-2 hover:text-neutral-900"
        >
          Trip Sheet ↗
        </a>
        {["ready", "in_transit", "at_destination", "unloaded", "ops_closed"].includes(
          trip.status,
        ) &&
          trip.pod_status !== "verified" && (
            <SharePodLink path={`/pod/${trip.pod_token}`} tripNo={trip.trip_no} />
          )}
        <span className={`${pillCls} px-3 py-1 ${STATUS_PILL[trip.status] ?? "bg-neutral-100 text-neutral-600"}`}>
          {trip.status.replace(/_/g, " ")}
        </span>
        <span className={`${pillCls} bg-neutral-100 px-3 py-1 font-medium text-neutral-600`}>
          POD: {trip.pod_status}
        </span>
        <span className={`${pillCls} bg-neutral-100 px-3 py-1 font-medium text-neutral-600`}>
          Payment: {trip.settlement_status}
        </span>
        {isDraft && (
          <form action={deleteTripAction} className="ml-auto">
            <input type="hidden" name="tripId" value={tripId} />
            <ConfirmSubmit
              message={[
                `Delete draft ${trip.trip_no}?`,
                (ewbLinks ?? []).length > 0
                  ? `• ${(ewbLinks ?? []).length} E-Way Bill(s) will be detached and released for other trips`
                  : null,
                activeCrew.length > 0
                  ? `• ${activeCrew.length} assigned driver(s) will be unassigned`
                  : null,
                `• Vehicle ${trip.vehicles?.reg_no ?? ""} stays available (drafts never block it)`,
                ``,
                `This cannot be undone. To keep a record instead, activate and cancel the trip.`,
              ]
                .filter((l) => l !== null)
                .join("\n")}
              className="text-xs font-medium text-red-600 underline underline-offset-2 hover:text-red-800"
            >
              Delete draft
            </ConfirmSubmit>
          </form>
        )}
      </div>
      <p className="mt-1.5 text-sm text-neutral-500">
        {trip.vehicles?.reg_no} · {trip.vehicles?.vehicle_type}
        {trip.routes ? ` · ${trip.routes.origin_city} → ${trip.routes.dest_city}` : ""}
        {trip.total_weight_kg ? ` · ${formatWeightMt(trip.total_weight_kg)}` : ""}
      </p>

      {error && <p className={`mt-4 ${bannerError}`}>{error}</p>}
      {ok && <p className={`mt-4 ${bannerOk}`}>{ok}</p>}

      {partBMismatches.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>⚠ E-Way Bill vehicle mismatch.</strong>{" "}
          {partBMismatches.map((m) => (
            <span key={m.ewbNo}>
              EWB <span className="font-mono font-semibold">{m.ewbNo}</span> Part-B says{" "}
              <span className="font-mono font-semibold">{m.partB}</span>, but this trip runs{" "}
              <span className="font-mono font-semibold">{trip.vehicles?.reg_no}</span>.{" "}
            </span>
          ))}
          Update Part-B on the E-Way Bill portal before dispatch — checkposts fine
          mismatched vehicles.
        </div>
      )}

      {/* Lifecycle actions */}
      {!isDraft && (next || ["draft", "planned", "ready", "in_transit", "at_destination", "unloaded"].includes(trip.status)) && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
          {next && (
            <form action={transitionAction} className="flex items-center gap-2">
              <input type="hidden" name="tripId" value={tripId} />
              <input type="hidden" name="to" value={next.to} />
              <button type="submit" className={btnPrimary}>{next.label}</button>
              {next.note && <span className="text-xs text-neutral-400">{next.note}</span>}
            </form>
          )}
          {["planned", "ready"].includes(trip.status) && (
            <form action={transitionAction} className="ml-auto flex items-center gap-2">
              <input type="hidden" name="tripId" value={tripId} />
              <input type="hidden" name="to" value="cancelled" />
              <input name="reason" placeholder="Cancel reason" required className={inputSmCls} />
              <button type="submit" className={btnDanger}>
                Cancel Trip
              </button>
            </form>
          )}
          {["in_transit", "at_destination", "unloaded"].includes(trip.status) && (
            <form action={transitionAction} className="ml-auto flex items-center gap-2">
              <input type="hidden" name="tripId" value={tripId} />
              <input type="hidden" name="to" value="aborted" />
              <input name="reason" placeholder="Abort reason" required className={inputSmCls} />
              <button type="submit" className={btnDanger}>
                Abort
              </button>
            </form>
          )}
        </div>
      )}

      {/* Consignments */}
      <SectionCard
        className="mt-6"
        title="Consignments (E-Way Bills)"
        meta={isDraft ? "Step 2 of 4" : undefined}
      >
        <div className="space-y-2">
          {(ewbLinks ?? []).map((l) => (
            <div key={l.ewb_id} className="flex items-start justify-between gap-3 rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3">
              <div className="text-sm">
                <div className="font-mono font-semibold text-neutral-900">{l.eway_bills?.ewb_no}</div>
                <div className="text-neutral-600">
                  {l.eway_bills?.consignor_name ?? "?"} → {l.eway_bills?.consignee_name ?? "?"}
                  {l.eway_bills?.material ? ` · ${l.eway_bills.material}` : ""}
                  {l.eway_bills?.weight_kg ? ` · ${formatWeightMt(l.eway_bills.weight_kg)}` : ""}
                </div>
                <div className="mt-0.5 text-xs text-neutral-400">
                  {l.eway_bills?.origin ?? "?"} → {l.eway_bills?.destination ?? "?"} · valid till {fmt(l.eway_bills?.valid_until ?? null)}
                </div>
              </div>
              {isDraft && (
                <form action={detachEwbAction}>
                  <input type="hidden" name="tripId" value={tripId} />
                  <input type="hidden" name="ewbId" value={l.ewb_id} />
                  <button type="submit" className="text-sm font-medium text-red-600 hover:underline">Remove</button>
                </form>
              )}
            </div>
          ))}
          {(ewbLinks ?? []).length === 0 && (
            <p className="text-sm text-neutral-400">No E-Way Bills attached yet.</p>
          )}
        </div>

        {isDraft && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <form action={attachEwbFetch} className="rounded-lg border border-neutral-200 p-4">
              <div className="text-sm font-medium text-neutral-900">Fetch from MarketPe</div>
              <input type="hidden" name="tripId" value={tripId} />
              <div className="mt-2 flex gap-2">
                <input name="ewbNo" placeholder="12-digit EWB number" pattern="\d{12}" required className={inputCls} />
                <button type="submit" className={btnPrimary}>Fetch</button>
              </div>
            </form>
            <form action={attachEwbManualAction} className="rounded-lg border border-neutral-200 p-4">
              <div className="text-sm font-medium text-neutral-900">Manual entry (fallback)</div>
              <input type="hidden" name="tripId" value={tripId} />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input name="ewbNo" placeholder="EWB number*" pattern="\d{12}" required className={inputCls} />
                <input name="material" placeholder="Material" className={inputCls} />
                <input name="consignorName" placeholder="Consignor" className={inputCls} />
                <input name="consigneeName" placeholder="Consignee" className={inputCls} />
                <input name="origin" placeholder="Origin" className={inputCls} />
                <input name="destination" placeholder="Destination" className={inputCls} />
                <input name="weightKg" type="number" step="0.1" placeholder="Weight (kg)" className={inputCls} />
                <input name="validUntil" type="datetime-local" className={inputCls} />
              </div>
              <button type="submit" className={`mt-3 ${btnGhost}`}>Add consignment</button>
            </form>
          </div>
        )}
      </SectionCard>

      {/* Route & schedule + Crew */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Route & Schedule" meta={isDraft ? "Step 3a" : undefined}>
          {isDraft ? (
            <form action={savePlan} className="space-y-3">
              <input type="hidden" name="tripId" value={tripId} />
              <SelectSearch
                name="routeId"
                placeholder="Search route (type origin or destination)…"
                defaultValue={trip.route_id ?? suggestedRoute?.id ?? ""}
                allowEmpty
                emptyLabel="— No route —"
                options={rankedRoutes.map((r) => ({
                  value: r.id,
                  label: `${r.origin_city} → ${r.dest_city}`,
                  hint: r.score >= 2 ? "suggested — matches E-Way Bill" : undefined,
                }))}
              />
              {suggestedRoute && (
                <p className="text-xs text-neutral-400">
                  Route pre-selected from the E-Way Bill destination — change if needed.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Start</label>
                  <input name="plannedStart" type="datetime-local" defaultValue={toLocalInput(trip.planned_start)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>ETA</label>
                  <input name="eta" type="datetime-local" defaultValue={toLocalInput(trip.eta)} className={inputCls} />
                </div>
              </div>
              <input name="notes" placeholder="Notes / helper name / instructions" defaultValue={trip.notes ?? ""} className={inputCls} />
              <button type="submit" className={btnGhost}>Save plan</button>
            </form>
          ) : (
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-neutral-500">Planned start</dt><dd className="font-medium text-neutral-900">{fmt(trip.planned_start)}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">ETA</dt><dd className="font-medium text-neutral-900">{fmt(trip.eta)}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Started</dt><dd className="font-medium text-neutral-900">{fmt(trip.actual_start)}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Arrived</dt><dd className="font-medium text-neutral-900">{fmt(trip.arrived_at)}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Unloaded</dt><dd className="font-medium text-neutral-900">{fmt(trip.unloaded_at)}</dd></div>
              {trip.notes && <div className="pt-2 text-neutral-600">{trip.notes}</div>}
            </dl>
          )}
        </SectionCard>

        <SectionCard title="Crew" meta={isDraft ? "Step 3b" : undefined}>
          <div className="space-y-1.5 text-sm">
            {activeCrew.map((c) => (
              <div key={c.id} className="flex justify-between">
                <span className="font-medium text-neutral-900">{c.drivers?.name}</span>
                <span className="text-neutral-500">{c.drivers?.phone} · {c.role}</span>
              </div>
            ))}
            {activeCrew.length === 0 && <p className="text-neutral-400">No driver assigned yet.</p>}
          </div>
          {isDraft && (
            <form action={saveCrew} className="mt-3 space-y-2">
              <input type="hidden" name="tripId" value={tripId} />
              <SelectSearch
                name="primaryDriverId"
                required
                placeholder="Primary driver — type name or phone…"
                defaultValue={lastPrimary}
                options={(drivers ?? []).map((d) => ({
                  value: d.id,
                  label: d.name,
                  hint: d.phone,
                }))}
              />
              <SelectSearch
                name="secondaryDriverId"
                placeholder="Second driver (optional)…"
                allowEmpty
                emptyLabel="— None —"
                defaultValue={lastSecondary}
                options={(drivers ?? []).map((d) => ({
                  value: d.id,
                  label: d.name,
                  hint: d.phone,
                }))}
              />
              <div className="flex items-center gap-2">
                <button type="submit" className={btnGhost}>Assign crew</button>
                {lastPrimary && (
                  <span className="text-xs text-neutral-400">
                    Pre-filled from this vehicle&apos;s last trip — change if needed
                  </span>
                )}
              </div>
            </form>
          )}
        </SectionCard>
      </div>

      {/* Money */}
      <SectionCard
        className="mt-6"
        title="Money"
        meta={isDraft ? "Step 4 of 4" : undefined}
        aside={
          <div className="text-sm">
            <span className="text-neutral-500">Approved total:</span>{" "}
            <span className="font-semibold tabular-nums text-neutral-900">₹{totalApproved.toLocaleString("en-IN")}</span>
            <span className="ml-4 text-neutral-500">Advances:</span>{" "}
            <span className="font-semibold tabular-nums text-neutral-900">₹{totalAdvances.toLocaleString("en-IN")}</span>
          </div>
        }
      >
        {(charges ?? []).length === 0 ? (
          <form action={loadCharges}>
            <input type="hidden" name="tripId" value={tripId} />
            <button type="submit" className={btnPrimary}>
              Load charges (master rate / standard heads)
            </button>
          </form>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                <th className="py-2 font-semibold">Charge</th>
                <th className="py-2 font-semibold">Planned</th>
                <th className="py-2 font-semibold">Approved</th>
                <th className="py-2 font-semibold">Source</th>
                {isDraft && <th />}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {(charges ?? []).map((c) => (
                <tr key={c.id}>
                  <td className="py-2.5 font-medium capitalize text-neutral-900">{c.charge_type.replace(/_/g, " ")}</td>
                  <td className="py-2.5 tabular-nums">₹{c.planned_amount.toLocaleString("en-IN")}</td>
                  <td className="py-2.5">
                    {isDraft ? (
                      <form action={saveChargeAction} className="flex items-center gap-2">
                        <input type="hidden" name="tripId" value={tripId} />
                        <input type="hidden" name="chargeId" value={c.id} />
                        <input name="amount" type="number" step="0.01" defaultValue={c.approved_amount} className={`w-28 ${inputSmCls}`} />
                        <button type="submit" className="text-xs font-medium text-neutral-500 hover:text-neutral-900">save</button>
                      </form>
                    ) : (
                      <span className="tabular-nums">₹{c.approved_amount.toLocaleString("en-IN")}</span>
                    )}
                  </td>
                  <td className="py-2.5 text-neutral-500">{c.source}</td>
                  {isDraft && (
                    <td className="py-2.5 text-right">
                      <form action={deleteChargeAction}>
                        <input type="hidden" name="tripId" value={tripId} />
                        <input type="hidden" name="chargeId" value={c.id} />
                        <button type="submit" className="text-xs font-medium text-red-600 hover:underline">remove</button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {isDraft && (charges ?? []).length > 0 && (
          <form action={addChargeAction} className="mt-3 flex items-center gap-2">
            <input type="hidden" name="tripId" value={tripId} />
            <select name="chargeType" className={inputSmCls}>
              {CHARGE_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
              ))}
            </select>
            <input name="amount" type="number" step="0.01" placeholder="Amount" required className={`w-32 ${inputSmCls}`} />
            <button type="submit" className={btnGhost}>+ Add charge</button>
          </form>
        )}

        {/* Advances */}
        {(advances ?? []).length > 0 && (
          <div className="mt-5 border-t border-neutral-100 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Advances paid</h3>
            {(advances ?? []).map((a, i) => (
              <div key={i} className="mt-1.5 flex justify-between text-sm">
                <span>{a.drivers?.name} · {a.mode}{a.ref_no ? ` · ${a.ref_no}` : ""}</span>
                <span className="tabular-nums">₹{a.amount.toLocaleString("en-IN")} · {fmt(a.paid_at)}</span>
              </div>
            ))}
          </div>
        )}
        {["draft", "ready", "in_transit"].includes(trip.status) && activeCrew.length > 0 && (
          <form action={addAdvanceAction} className="mt-3 flex flex-wrap items-center gap-2">
            <input type="hidden" name="tripId" value={tripId} />
            <select name="driverId" className={inputSmCls}>
              {activeCrew.map((c) => (
                <option key={c.id} value={c.drivers?.id}>{c.drivers?.name}</option>
              ))}
            </select>
            <input name="amount" type="number" step="0.01" placeholder="Advance ₹" required className={`w-32 ${inputSmCls}`} />
            <select name="mode" className={inputSmCls}>
              {["cash", "upi", "bank", "fuel_card", "fastag"].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <input name="refNo" placeholder="Ref no." className={`w-32 ${inputSmCls}`} />
            <button type="submit" className={btnGhost}>+ Advance</button>
          </form>
        )}

        {isDraft && (
          <form action={activateTrip} className="mt-6 border-t border-neutral-100 pt-4">
            <input type="hidden" name="tripId" value={tripId} />
            <button type="submit" className={`${btnSuccess} px-5 py-2.5`}>
              ✓ Approve Money & Activate Trip
            </button>
            <span className="ml-3 text-xs text-neutral-400">
              Needs: ≥1 E-Way Bill · driver · charges · start date & ETA
            </span>
          </form>
        )}
      </SectionCard>

      {/* POD */}
      {(["at_destination", "unloaded", "ops_closed", "completed"].includes(trip.status) ||
        (pods ?? []).length > 0) && (
        <SectionCard
          className="mt-6"
          title="Proof of Delivery"
          meta={<span className="capitalize">trip POD status: {trip.pod_status}</span>}
        >
          <div className="space-y-2">
            {(pods ?? []).map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm">
                <div>
                  <a
                    href={podUrls.get(p.id) ?? "#"}
                    target="_blank"
                    className="font-medium text-neutral-900 underline underline-offset-2"
                  >
                    View POD
                  </a>
                  <span className="ml-2 text-neutral-500">
                    {p.eway_bills?.ewb_no ? `EWB ${p.eway_bills.ewb_no}` : "whole trip"} · {fmt(p.uploaded_at)}
                  </span>
                  {p.source === "qr" && (
                    <span className={`ml-2 ${pillCls} bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700`}>
                      via QR
                    </span>
                  )}
                  {p.capture_lat !== null && p.capture_lng !== null && (
                    <a
                      href={`https://www.google.com/maps?q=${p.capture_lat},${p.capture_lng}`}
                      target="_blank"
                      className="ml-2 text-xs text-neutral-400 underline underline-offset-2 hover:text-neutral-700"
                    >
                      capture location
                    </a>
                  )}
                  {p.status === "rejected" && (
                    <span className="ml-2 text-red-600">rejected: {p.rejection_reason}</span>
                  )}
                </div>
                {p.status === "uploaded" ? (
                  <div className="flex items-center gap-2">
                    <form action={verifyPodAction}>
                      <input type="hidden" name="tripId" value={tripId} />
                      <input type="hidden" name="podId" value={p.id} />
                      <button type="submit" className={`${btnSuccess} px-3 py-1.5 text-xs`}>
                        Verify
                      </button>
                    </form>
                    <form action={rejectPodAction} className="flex items-center gap-1.5">
                      <input type="hidden" name="tripId" value={tripId} />
                      <input type="hidden" name="podId" value={p.id} />
                      <input name="reason" placeholder="Reject reason" required className={`${inputSmCls} px-2 py-1 text-xs`} />
                      <button type="submit" className={`${btnDanger} px-2.5 py-1 text-xs`}>
                        Reject
                      </button>
                    </form>
                  </div>
                ) : (
                  <span className={`text-xs font-semibold uppercase ${p.status === "verified" ? "text-green-700" : "text-red-600"}`}>
                    {p.status}
                  </span>
                )}
              </div>
            ))}
            {(pods ?? []).length === 0 && (
              <p className="text-sm text-neutral-400">No POD uploaded yet.</p>
            )}
          </div>
          {["at_destination", "unloaded", "ops_closed", "completed"].includes(trip.status) &&
            trip.pod_status !== "verified" && (
              <form action={uploadPodAction} className="mt-4 flex flex-wrap items-center gap-2">
                <input type="hidden" name="tripId" value={tripId} />
                <input name="file" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" className="text-sm" />
                <select name="ewbId" className={inputSmCls}>
                  <option value="">Whole trip (all consignments)</option>
                  {(ewbLinks ?? []).map((l) => (
                    <option key={l.ewb_id} value={l.ewb_id}>
                      EWB {l.eway_bills?.ewb_no}
                    </option>
                  ))}
                </select>
                <button type="submit" className={btnGhost}>Upload POD</button>
                <span className="text-xs text-neutral-400">JPG / PNG / PDF, max 10 MB</span>
              </form>
            )}
        </SectionCard>
      )}

      {/* Settlements */}
      {["ops_closed", "completed"].includes(trip.status) && (
        <SectionCard
          className="mt-6"
          title="Driver Settlement"
          meta={<span className="capitalize">status: {trip.settlement_status.replace(/_/g, " ")}</span>}
        >
          {(settlements ?? []).length === 0 ? (
            <form action={generateSettlementsAction}>
              <input type="hidden" name="tripId" value={tripId} />
              <button type="submit" className={btnPrimary}>
                Generate settlement (allowance + approved expenses − advances)
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              {(settlements ?? []).map((s) => (
                <div key={s.id} className={`rounded-lg border p-4 ${s.net_payable < 0 ? "border-red-200 bg-red-50" : "border-neutral-200"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-neutral-900">
                      {s.drivers?.name}{" "}
                      <a
                        href={`/print/settlement/${s.id}`}
                        target="_blank"
                        className="ml-1 text-xs font-medium text-neutral-500 underline underline-offset-2 hover:text-neutral-900"
                      >
                        Slip ↗
                      </a>{" "}
                      <span className="font-normal text-neutral-500">{s.drivers?.phone}</span>
                    </div>
                    <div className="text-sm">
                      Net payable:{" "}
                      <span className={`font-semibold tabular-nums ${s.net_payable < 0 ? "text-red-700" : "text-neutral-900"}`}>
                        {formatInr(s.net_payable)}
                      </span>
                      {s.net_payable < 0 && (
                        <span className="ml-2 text-xs font-semibold text-red-700">
                          RECOVERY DUE from driver
                        </span>
                      )}
                      <span className={`ml-3 ${pillCls} uppercase ${s.status === "paid" ? "bg-green-100 text-green-800" : "bg-amber-50 text-amber-700"}`}>
                        {s.status}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    gross {formatInr(s.gross_amount)} + bonus {formatInr(s.bonus)} − penalty {formatInr(s.penalty)} − advances {formatInr(s.advances_deducted)}
                    {s.penalty_reason ? ` · penalty: ${s.penalty_reason}` : ""}
                    {s.ref_no ? ` · ref ${s.ref_no}` : ""}
                  </div>

                  {s.status !== "paid" && (
                    <div className="mt-3 flex flex-wrap items-end gap-4">
                      <form action={updateSettlementAction} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="tripId" value={tripId} />
                        <input type="hidden" name="settlementId" value={s.id} />
                        <label className="text-xs font-medium text-neutral-500">
                          Gross
                          <input name="gross" type="number" step="0.01" defaultValue={s.gross_amount} className={`mt-1 block w-28 ${inputSmCls}`} />
                        </label>
                        <label className="text-xs font-medium text-neutral-500">
                          Bonus
                          <input name="bonus" type="number" step="0.01" defaultValue={s.bonus} className={`mt-1 block w-24 ${inputSmCls}`} />
                        </label>
                        <label className="text-xs font-medium text-neutral-500">
                          Penalty
                          <input name="penalty" type="number" step="0.01" defaultValue={s.penalty} className={`mt-1 block w-24 ${inputSmCls}`} />
                        </label>
                        <input name="penaltyReason" placeholder="Penalty reason" defaultValue={s.penalty_reason ?? ""} className={`w-40 ${inputSmCls}`} />
                        <button type="submit" className={btnGhost}>Save</button>
                      </form>
                      <form action={markSettlementPaidAction} className="flex items-end gap-2">
                        <input type="hidden" name="tripId" value={tripId} />
                        <input type="hidden" name="settlementId" value={s.id} />
                        <select name="mode" className={inputSmCls}>
                          {["upi", "bank", "cash", "cheque"].map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        <input name="refNo" placeholder="UTR / ref no." className={`w-36 ${inputSmCls}`} />
                        <button type="submit" className={btnSuccess}>
                          Mark Paid
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              ))}
              <p className="text-xs text-neutral-400">
                Payments execute in MarketPe (cash/online window) — record the UTR here, or the
                nightly MarketPe sync will reconcile them automatically once payment/create access arrives.
              </p>
            </div>
          )}
        </SectionCard>
      )}

      {/* Customer Billing */}
      {isInvoiceable && (
        <SectionCard
          className="mt-6"
          title="Customer Billing"
          meta={<span className="capitalize">status: {trip.billing_status.replace(/_/g, " ")}</span>}
        >
          {invoice ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 p-4 text-sm">
                <div>
                  <div className="font-semibold text-neutral-900">
                    {invoice.invoice_no}
                    <a
                      href={`/print/invoice/${invoice.id}`}
                      target="_blank"
                      className="ml-3 text-xs font-medium text-neutral-500 underline underline-offset-2 hover:text-neutral-900"
                    >
                      Print / PDF ↗
                    </a>
                  </div>
                  <div className="text-neutral-500">
                    freight {formatInr(invoice.freight_amount)} + other {formatInr(invoice.other_charges)} + GST {formatInr(invoice.gst_amount)} · due {invoice.due_date ?? "—"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold tabular-nums text-neutral-900">{formatInr(invoice.total)}</div>
                  <div className="text-xs text-neutral-500">
                    received {formatInr(invoice.received_amount)} ·{" "}
                    <span className="font-semibold uppercase">{invoice.status.replace(/_/g, " ")}</span>
                  </div>
                </div>
              </div>
              {invoice.status !== "received" && (
                <form action={recordReceiptAction} className="mt-3 flex items-center gap-2">
                  <input type="hidden" name="tripId" value={tripId} />
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <input name="amount" type="number" step="0.01" placeholder="Amount received ₹" required className={`w-44 ${inputSmCls}`} />
                  <button type="submit" className={btnSuccess}>
                    Record receipt
                  </button>
                </form>
              )}
            </div>
          ) : (
            <form action={generateInvoiceAction} className="grid gap-3 md:grid-cols-2">
              <input type="hidden" name="tripId" value={tripId} />
              <div className="md:col-span-2">
                <label className={labelCls}>Bill to (customer)</label>
                <SelectSearch
                  name="customerId"
                  required
                  placeholder="Search customer (name or GSTIN)…"
                  options={(customers ?? []).map((c) => ({
                    value: c.id,
                    label: c.name,
                    hint: c.gstin ?? undefined,
                  }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>
                  Contract rate line (or manual rate below)
                </label>
                <SelectSearch
                  name="contractLineId"
                  placeholder="Search rate line (type destination)…"
                  allowEmpty
                  emptyLabel="— No contract / manual rate —"
                  options={(contractLines ?? []).map((l) => ({
                    value: l.id,
                    label: `${l.origin_name} → ${l.dest_city}`,
                    hint: `${l.category} · ₹${l.rate_per_mt}/MT`,
                  }))}
                />
              </div>
              <div>
                <label className={labelCls}>Manual rate ₹/MT (fallback)</label>
                <input name="manualRate" type="number" step="0.01" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Weight (MT)</label>
                <input
                  name="weightMt"
                  type="number"
                  step="0.001"
                  required
                  defaultValue={trip.total_weight_kg ? (trip.total_weight_kg / 1000).toFixed(3) : ""}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Other charges (detention etc.)</label>
                <input name="otherCharges" type="number" step="0.01" defaultValue="0" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>GST ₹ (0 if RCM)</label>
                <input name="gstAmount" type="number" step="0.01" defaultValue="0" className={inputCls} />
              </div>
              <div className="md:col-span-2">
                <button type="submit" className={btnPrimary}>
                  Generate invoice
                </button>
              </div>
            </form>
          )}
        </SectionCard>
      )}

      {/* Timeline */}
      <SectionCard className="mt-6" title="Timeline">
        {(activity ?? []).length === 0 ? (
          <p className="text-sm text-neutral-400">No activity yet.</p>
        ) : (
          <ol className="relative ml-1.5 space-y-4 border-l border-neutral-200 pl-5">
            {(activity ?? []).map((a, i) => (
              <li key={i} className="relative flex justify-between gap-3 text-sm">
                <span
                  aria-hidden
                  className={`absolute -left-[26px] top-1.5 h-2 w-2 rounded-full ring-2 ring-white ${
                    i === 0 ? "bg-neutral-900" : "bg-neutral-300"
                  }`}
                />
                <span className="font-medium capitalize text-neutral-900">{a.action.replace(/_/g, " ")}</span>
                <span className="whitespace-nowrap text-neutral-400">{fmt(a.ts)}</span>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>
    </div>
  );
}
