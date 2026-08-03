import Link from "next/link";
import { requireOrgStaff } from "@/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TripStatus } from "@lafl/core";
import { STATUS_PILL, statusLabel } from "@/features/status";
import {
  EmptyState,
  PageHeader,
  bannerOk,
  btnPrimary,
  cardCls,
  pillCls,
  tdCls,
  thCls,
} from "@/components/ui";

const TABS = [
  { key: "live", label: "Live" },
  { key: "draft", label: "Drafts" },
  { key: "ready", label: "Ready" },
  { key: "in_transit", label: "In Transit" },
  { key: "ops_closed", label: "Ops Closed" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" },
];
const LIVE: TripStatus[] = ["draft", "planned", "ready", "in_transit", "at_destination", "unloaded"];
const STATUS_KEYS: TripStatus[] = ["draft", "planned", "ready", "in_transit", "at_destination", "unloaded", "ops_closed", "completed", "cancelled", "aborted"];

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; ok?: string }>;
}) {
  await requireOrgStaff();
  const { tab = "live", ok } = await searchParams;
  const db = await createSupabaseServerClient();

  let q = db
    .from("trips")
    .select(
      "id, trip_no, status, eta, created_at, total_weight_kg, vehicles(reg_no), routes(origin_city, dest_city), trip_drivers(role, released_at, drivers(name))",
    )
    .order("created_at", { ascending: false })
    .limit(50);
  if (tab === "live") q = q.in("status", LIVE);
  else if (STATUS_KEYS.includes(tab as TripStatus)) q = q.eq("status", tab as TripStatus);
  const { data: trips } = await q;

  return (
    <div>
      <PageHeader title="Trips" subtitle="Plan, dispatch and track every load.">
        <Link href="/trips/new" className={btnPrimary}>
          + New Trip
        </Link>
      </PageHeader>

      {ok && <p className={`mt-4 ${bannerOk}`}>{ok}</p>}

      {/* status tabs */}
      <div className="mt-6 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/trips?tab=${t.key}`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              tab === t.key
                ? "bg-neutral-900 text-white shadow-sm"
                : "border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className={`mt-4 overflow-hidden ${cardCls}`}>
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-100 bg-neutral-50/80">
            <tr>
              <th className={thCls}>Trip</th>
              <th className={thCls}>Vehicle</th>
              <th className={thCls}>Driver</th>
              <th className={thCls}>Route</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>ETA</th>
              <th className={thCls}>Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {(trips ?? []).map((t) => {
              const driver = (t.trip_drivers ?? []).find(
                (d) => d.role === "primary" && !d.released_at,
              )?.drivers?.name;
              return (
                <tr key={t.id} className="hover:bg-neutral-50">
                  <td className={`${tdCls} font-medium text-neutral-900`}>
                    <Link href={`/trips/${t.id}`} className="block hover:underline">
                      {t.trip_no}
                    </Link>
                  </td>
                  <td className={tdCls}>{t.vehicles?.reg_no ?? "—"}</td>
                  <td className={tdCls}>{driver ?? "—"}</td>
                  <td className={`${tdCls} text-neutral-600`}>
                    {t.routes ? `${t.routes.origin_city} → ${t.routes.dest_city}` : "—"}
                  </td>
                  <td className={tdCls}>
                    <span
                      className={`${pillCls} ${STATUS_PILL[t.status] ?? "bg-neutral-100 text-neutral-600"}`}
                    >
                      {statusLabel(t.status)}
                    </span>
                  </td>
                  <td className={`${tdCls} text-neutral-600`}>{fmt(t.eta)}</td>
                  <td className={`${tdCls} text-neutral-400`}>{fmt(t.created_at)}</td>
                </tr>
              );
            })}
            {(trips ?? []).length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    icon="truck"
                    title={tab === "live" ? "No live trips" : "No trips in this view"}
                    hint={
                      tab === "live"
                        ? "Create one with + New Trip to get rolling."
                        : "Switch tabs to see trips in other stages."
                    }
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
