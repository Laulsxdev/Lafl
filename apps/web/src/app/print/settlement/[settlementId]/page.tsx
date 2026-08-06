import { notFound } from "next/navigation";
import { formatInr } from "@lafl/core";
import { requireOrgStaff } from "@/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import PrintButton from "@/components/print-button";
import { TableScroll } from "@/components/ui";

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default async function SettlementPrintPage({
  params,
}: {
  params: Promise<{ settlementId: string }>;
}) {
  const profile = await requireOrgStaff();
  const { settlementId } = await params;
  const db = await createSupabaseServerClient();

  const { data: s } = await db
    .from("driver_settlements")
    .select(
      "*, drivers(name, phone, license_no), trips(trip_no, actual_start, ops_closed_at, vehicles(reg_no), routes(origin_city, dest_city))",
    )
    .eq("id", settlementId)
    .maybeSingle();
  if (!s) notFound();

  const [{ data: org }, { data: advances }] = await Promise.all([
    db.from("organizations").select("name").eq("id", profile.org_id).single(),
    db
      .from("advances")
      .select("amount, mode, ref_no, paid_at")
      .eq("trip_id", s.trip_id)
      .eq("driver_id", s.driver_id)
      .order("paid_at"),
  ]);

  const row = (label: string, value: string, cls = "") => (
    <tr className={cls}>
      <td className="py-2">{label}</td>
      <td className="py-2 text-right tabular-nums">{value}</td>
    </tr>
  );

  return (
    <main className="mx-auto w-full max-w-2xl p-4 sm:p-8 print:p-0">
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <div className="w-full max-w-full rounded-xl border border-neutral-300 bg-white p-4 sm:p-10 print:rounded-none print:border-0 print:p-2">
        <div className="flex flex-col gap-3 border-b-2 border-neutral-900 pb-5 sm:flex-row sm:items-start sm:justify-between print:flex-row print:items-start print:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight">{org?.name ?? "—"}</h1>
            <p className="mt-0.5 text-sm text-neutral-600">Driver Payment Settlement</p>
          </div>
          <div className="min-w-0 text-sm sm:text-right print:text-right">
            <div className="break-words"><span className="text-neutral-500">Trip:</span> <strong>{s.trips?.trip_no}</strong></div>
            <div><span className="text-neutral-500">Status:</span> <strong className="uppercase">{s.status}</strong></div>
            {s.paid_at && <div><span className="text-neutral-500">Paid:</span> {fmtDate(s.paid_at)}</div>}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-6 text-sm sm:grid-cols-2 print:grid-cols-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Driver</div>
            <div className="mt-1 font-semibold break-words">{s.drivers?.name}</div>
            <div className="text-neutral-600">{s.drivers?.phone}</div>
            {s.drivers?.license_no && <div className="text-neutral-600 break-words">DL: {s.drivers.license_no}</div>}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Trip</div>
            <div className="mt-1 text-neutral-700">
              <div className="break-words">Vehicle: <strong>{s.trips?.vehicles?.reg_no}</strong></div>
              {s.trips?.routes && (
                <div className="break-words">{s.trips.routes.origin_city} → {s.trips.routes.dest_city}</div>
              )}
              <div>{fmtDate(s.trips?.actual_start ?? null)} – {fmtDate(s.trips?.ops_closed_at ?? null)}</div>
            </div>
          </div>
        </div>

        <TableScroll className="mt-7 print:overflow-visible">
          <table className="w-full min-w-[300px] text-sm">
            <tbody className="divide-y divide-neutral-100">
              {row("Gross (allowance + approved expenses)", formatInr(s.gross_amount))}
              {s.bonus > 0 && row("Bonus", `+ ${formatInr(s.bonus)}`)}
              {s.penalty > 0 &&
                row(`Penalty${s.penalty_reason ? ` — ${s.penalty_reason}` : ""}`, `− ${formatInr(s.penalty)}`)}
              {row("Advances deducted", `− ${formatInr(s.advances_deducted)}`)}
            </tbody>
            <tfoot>
              <tr className={`border-t-2 border-neutral-900 text-base font-bold ${s.net_payable < 0 ? "text-red-700" : ""}`}>
                <td className="py-3">{s.net_payable < 0 ? "RECOVERY DUE FROM DRIVER" : "NET PAYABLE"}</td>
                <td className="py-3 text-right tabular-nums">{formatInr(Math.abs(s.net_payable))}</td>
              </tr>
            </tfoot>
          </table>
        </TableScroll>

        {(advances ?? []).length > 0 && (
          <div className="mt-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Advances on this trip
            </div>
            <TableScroll className="mt-1 print:overflow-visible">
              <table className="w-full min-w-[300px] text-xs text-neutral-600">
                <tbody className="divide-y divide-neutral-100">
                  {(advances ?? []).map((a, i) => (
                    <tr key={i}>
                      <td className="py-1.5 break-words">{fmtDate(a.paid_at)} · {a.mode}{a.ref_no ? ` · ${a.ref_no}` : ""}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatInr(a.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </div>
        )}

        {s.status === "paid" && (
          <div className="mt-5 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm break-words text-green-800 print:border-neutral-300 print:bg-white print:text-neutral-700">
            Paid via <strong className="uppercase">{s.mode}</strong>
            {s.ref_no ? <> · Ref/UTR: <strong>{s.ref_no}</strong></> : null} · {fmtDate(s.paid_at)}
          </div>
        )}

        <div className="mt-12 grid grid-cols-1 gap-8 text-xs text-neutral-500 sm:grid-cols-2 print:grid-cols-2">
          <div>
            <div className="border-t border-neutral-400 pt-1.5">Driver signature</div>
          </div>
          <div className="sm:text-right print:text-right">
            <div className="border-t border-neutral-400 pt-1.5">Authorised signatory · {org?.name}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
