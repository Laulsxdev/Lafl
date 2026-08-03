import Link from "next/link";
import { redirect } from "next/navigation";
import { formatInr } from "@lafl/core";
import { requireProfile } from "@/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import LiveMap from "@/features/map/live-map";
import { STATUS_PILL, statusLabel } from "@/features/status";
import {
  AlertIcon,
  EmptyState,
  PageHeader,
  btnPrimary,
  cardCls,
  pillCls,
} from "@/components/ui";

type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function count(
  db: Db,
  table: "vehicles" | "drivers" | "trips",
  filter?: (q: any) => any,
) {
  let q = db.from(table).select("id", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count: n } = await q;
  return n ?? 0;
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  if (profile.role === "super_admin") redirect("/admin");

  const db = await createSupabaseServerClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const plus8h = new Date(now.getTime() + 8 * 3600_000).toISOString();
  const silent30m = new Date(now.getTime() - 30 * 60_000).toISOString();
  const today = nowIso.slice(0, 10);

  const [
    vehicles,
    drivers,
    inTransit,
    podPending,
    payPending,
    tripsTotal,
    { data: positions },
    { data: invoiceSummary },
    { data: costSummary },
    { data: delayed },
    { data: gpsSilent },
    { data: ewbExpiring },
    { data: overdueInvoices },
  ] = await Promise.all([
    count(db, "vehicles"),
    count(db, "drivers"),
    count(db, "trips", (q) => q.eq("status", "in_transit")),
    count(db, "trips", (q) =>
      q.in("status", ["unloaded", "ops_closed"]).neq("pod_status", "verified"),
    ),
    count(db, "trips", (q) =>
      q.in("status", ["ops_closed", "completed"]).neq("settlement_status", "paid"),
    ),
    count(db, "trips"),
    db
      .from("vehicle_latest_positions")
      .select("vehicle_id, reg_no, lat, lng, speed_kmh, ts, vehicle_status")
      .order("ts", { ascending: false })
      .limit(300),
    db.from("org_invoice_summary").select("*").maybeSingle(),
    db.from("org_cost_summary").select("*").maybeSingle(),
    db
      .from("trips")
      .select("id, trip_no, eta, vehicles(reg_no)")
      .eq("status", "in_transit")
      .lt("eta", nowIso)
      .limit(10),
    db
      .from("trips")
      .select("id, trip_no, last_gps_at, vehicles(reg_no)")
      .eq("status", "in_transit")
      .or(`last_gps_at.is.null,last_gps_at.lt.${silent30m}`)
      .limit(10),
    db
      .from("trip_eway_bills")
      .select("trip_id, eway_bills!inner(ewb_no, valid_until), trips!inner(trip_no, status)")
      .lt("eway_bills.valid_until", plus8h)
      .in("trips.status", ["ready", "in_transit", "at_destination", "unloaded"])
      .limit(10),
    db
      .from("customer_invoices")
      .select("id, trip_id, invoice_no, due_date, total, received_amount")
      .neq("status", "received")
      .lt("due_date", today)
      .limit(10),
  ]);

  // view columns come back nullable — keep only complete fixes for the map
  const mapPositions = (positions ?? []).flatMap((p) =>
    p.reg_no !== null && p.lat !== null && p.lng !== null
      ? [
          {
            vehicle_id: p.vehicle_id,
            reg_no: p.reg_no,
            lat: p.lat,
            lng: p.lng,
            speed_kmh: p.speed_kmh,
            ts: p.ts ?? nowIso,
            vehicle_status: p.vehicle_status ?? "available",
          },
        ]
      : [],
  );

  const opsTiles = [
    { label: "Vehicles", value: vehicles },
    { label: "Drivers", value: drivers },
    { label: "In Transit", value: inTransit },
    { label: "Waiting for POD", value: podPending, href: "/pods" },
    { label: "Payment Pending", value: payPending, href: "/settlements" },
    { label: "Total Trips", value: tripsTotal, href: "/trips" },
  ];
  const finTiles = [
    { label: "Revenue Invoiced", value: formatInr(invoiceSummary?.invoiced_total ?? 0) },
    { label: "Received", value: formatInr(invoiceSummary?.received_total ?? 0) },
    { label: "Receivables Due", value: formatInr(invoiceSummary?.outstanding ?? 0), href: "/invoices" },
    { label: "Approved Trip Costs", value: formatInr(costSummary?.approved_costs ?? 0) },
  ];

  type Alert = { level: "red" | "amber"; text: string; href: string };
  const alerts: Alert[] = [
    ...(ewbExpiring ?? []).map((e): Alert => ({
      level: "red",
      text: `EWB ${e.eway_bills.ewb_no} on ${e.trips.trip_no} expires ${e.eway_bills.valid_until ? new Date(e.eway_bills.valid_until).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "?"} — extend NOW (8h window)`,
      href: `/trips/${e.trip_id}`,
    })),
    ...(gpsSilent ?? []).map((t): Alert => {
      const silentMs = t.last_gps_at ? now.getTime() - Date.parse(t.last_gps_at) : Infinity;
      return {
        level: silentMs > 2 * 3600_000 ? "red" : "amber",
        text: `${t.vehicles?.reg_no} (${t.trip_no}) GPS silent ${t.last_gps_at ? `${Math.round(silentMs / 60000)} min` : "— no fix yet"} — call driver`,
        href: `/trips/${t.id}`,
      };
    }),
    ...(delayed ?? []).map((t): Alert => ({
      level: "amber",
      text: `${t.trip_no} (${t.vehicles?.reg_no}) is past ETA ${t.eta ? new Date(t.eta).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : ""}`,
      href: `/trips/${t.id}`,
    })),
    ...(overdueInvoices ?? []).map((i): Alert => ({
      level: "amber",
      text: `${i.invoice_no} overdue since ${i.due_date} — ${formatInr(i.total - i.received_amount)} pending`,
      href: `/trips/${i.trip_id}`,
    })),
  ].sort((a, b) => (a.level === b.level ? 0 : a.level === "red" ? -1 : 1));

  const { data: recentTrips } = await db
    .from("trips")
    .select("id, trip_no, status, created_at, vehicles(reg_no), routes(dest_city)")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={now.toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      >
        <Link href="/trips/new" className={btnPrimary}>
          + New Trip
        </Link>
      </PageHeader>

      {/* Operations tiles */}
      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        Operations
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {opsTiles.map((t) => {
          const inner = (
            <>
              <div className="text-xs font-medium text-neutral-500">{t.label}</div>
              <div className="mt-1.5 text-3xl font-semibold tabular-nums tracking-tight text-neutral-900">
                {t.value}
              </div>
            </>
          );
          return t.href ? (
            <Link
              key={t.label}
              href={t.href}
              className={`${cardCls} p-5 hover:border-neutral-300 hover:shadow-sm`}
            >
              {inner}
            </Link>
          ) : (
            <div key={t.label} className={`${cardCls} p-5`}>
              {inner}
            </div>
          );
        })}
      </div>

      {/* Financials — deliberately distinct from ops tiles */}
      <div className="mt-6 overflow-hidden rounded-xl bg-neutral-900 shadow-sm">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Financials
          </h2>
          <Link
            href="/invoices"
            className="text-xs font-medium text-neutral-400 hover:text-white"
          >
            View invoices →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-px bg-white/10 xl:grid-cols-4">
          {finTiles.map((t) => {
            const inner = (
              <>
                <div className="text-xs font-medium text-neutral-400">{t.label}</div>
                <div className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-white">
                  {t.value}
                </div>
              </>
            );
            return t.href ? (
              <Link key={t.label} href={t.href} className="bg-neutral-900 p-5 hover:bg-neutral-800">
                {inner}
              </Link>
            ) : (
              <div key={t.label} className="bg-neutral-900 p-5">
                {inner}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900">Live Fleet Map</h2>
            <div className="flex items-center gap-3 text-xs text-neutral-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-600" />
                on trip
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-green-700" />
                available
              </span>
              <span className="text-neutral-400">
                {mapPositions.length} vehicles reporting
              </span>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-neutral-200 shadow-xs">
            <LiveMap positions={mapPositions} />
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-baseline gap-2">
            <h2 className="text-sm font-semibold text-neutral-900">Alerts</h2>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium tabular-nums text-neutral-500">
              {alerts.length}
            </span>
          </div>
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {alerts.map((a, i) => (
              <Link
                key={i}
                href={a.href}
                className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm hover:opacity-80 ${
                  a.level === "red"
                    ? "border-red-200 bg-red-50 text-red-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                <AlertIcon className="mt-0.5 h-4 w-4" />
                <span>{a.text}</span>
              </Link>
            ))}
            {alerts.length === 0 && (
              <EmptyState
                framed
                compact
                icon="check"
                title="All clear"
                hint="No active alerts right now."
              />
            )}
          </div>

          <div className="mb-3 mt-7 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900">Recent Trips</h2>
            <Link href="/trips" className="text-xs font-medium text-neutral-400 hover:text-neutral-700">
              View all →
            </Link>
          </div>
          <div className="space-y-1.5">
            {(recentTrips ?? []).map((t) => (
              <Link
                key={t.id}
                href={`/trips/${t.id}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-xs hover:border-neutral-300 hover:bg-neutral-50"
              >
                <span className="min-w-0 truncate font-medium text-neutral-900">
                  {t.trip_no}
                  <span className="ml-2 font-normal text-neutral-500">
                    {t.vehicles?.reg_no}
                    {t.routes?.dest_city ? ` → ${t.routes.dest_city}` : ""}
                  </span>
                </span>
                <span
                  className={`${pillCls} ${STATUS_PILL[t.status] ?? "bg-neutral-100 text-neutral-600"}`}
                >
                  {statusLabel(t.status)}
                </span>
              </Link>
            ))}
            {(recentTrips ?? []).length === 0 && (
              <EmptyState
                framed
                compact
                icon="truck"
                title="No trips yet"
                hint="Create your first trip to see it here."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
