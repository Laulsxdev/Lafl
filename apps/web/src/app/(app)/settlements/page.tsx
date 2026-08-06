import Link from "next/link";
import { formatInr } from "@lafl/core";
import { requireOrgStaff } from "@/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EmptyState, PageHeader, SectionHeading } from "@/components/ui";

export default async function SettlementsPage() {
  await requireOrgStaff();
  const db = await createSupabaseServerClient();

  const [{ data: toGenerate }, { data: open }] = await Promise.all([
    // ops closed but no settlement rows yet
    db
      .from("trips")
      .select("id, trip_no, ops_closed_at, vehicles(reg_no), driver_settlements(id)")
      .in("status", ["ops_closed", "completed"])
      .eq("settlement_status", "pending")
      .order("ops_closed_at", { ascending: true, nullsFirst: false })
      .limit(50),
    db
      .from("driver_settlements")
      .select("id, trip_id, net_payable, status, drivers(name), trips(trip_no)")
      .neq("status", "paid")
      .order("created_at")
      .limit(100),
  ]);

  const needGeneration = (toGenerate ?? []).filter(
    (t) => (t.driver_settlements ?? []).length === 0,
  );
  const totalDue = (open ?? []).reduce((s, r) => s + Math.max(r.net_payable, 0), 0);

  return (
    <div className="max-w-4xl">
      <PageHeader title="Driver Settlements" subtitle="Pay out drivers after ops close.">
        <div className="rounded-lg border border-neutral-200 bg-white px-3.5 py-2 text-sm shadow-xs">
          <span className="text-neutral-500">Outstanding</span>{" "}
          <span className="font-semibold tabular-nums text-neutral-900">{formatInr(totalDue)}</span>
        </div>
      </PageHeader>

      <div className="mt-8">
        <SectionHeading title="Awaiting payment" count={(open ?? []).length} />
      </div>
      <div className="mt-3 space-y-1.5">
        {(open ?? []).map((s) => (
          <div
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm shadow-xs hover:border-neutral-300"
          >
            <span className="min-w-0 font-medium text-neutral-900">
              <Link href={`/trips/${s.trip_id}`} className="hover:underline">
                {s.trips?.trip_no} · {s.drivers?.name}
              </Link>
              <a
                href={`/print/settlement/${s.id}`}
                target="_blank"
                className="ml-2 text-xs font-medium text-neutral-500 underline underline-offset-2 hover:text-neutral-900"
              >
                Slip ↗
              </a>
            </span>
            <span className={`font-semibold tabular-nums ${s.net_payable < 0 ? "text-red-700" : "text-neutral-900"}`}>
              {formatInr(s.net_payable)}
              {s.net_payable < 0 ? " (recovery)" : ""}
            </span>
          </div>
        ))}
        {(open ?? []).length === 0 && (
          <EmptyState
            framed
            compact
            icon="banknote"
            title="No settlements awaiting payment"
          />
        )}
      </div>

      <div className="mt-10">
        <SectionHeading title="Trips needing settlement generation" count={needGeneration.length} />
      </div>
      <div className="mt-3 space-y-1.5">
        {needGeneration.map((t) => (
          <Link
            key={t.id}
            href={`/trips/${t.id}`}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm shadow-xs hover:border-neutral-300 hover:bg-neutral-50"
          >
            <span className="min-w-0 font-medium text-neutral-900">{t.trip_no} · {t.vehicles?.reg_no}</span>
            <span className="shrink-0 text-neutral-400">generate →</span>
          </Link>
        ))}
        {needGeneration.length === 0 && (
          <EmptyState
            framed
            compact
            icon="check"
            title="All closed trips have settlements"
          />
        )}
      </div>
    </div>
  );
}
