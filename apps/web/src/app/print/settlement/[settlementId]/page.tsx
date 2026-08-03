import { notFound } from "next/navigation";
import { formatInr } from "@lafl/core";
import { requireOrgStaff } from "@/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import PrintButton from "@/components/print-button";

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
    <main className="mx-auto max-w-2xl p-8 print:p-0">
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <div className="rounded-xl border border-neutral-300 bg-white p-10 print:rounded-none print:border-0 print:p-2">
        <div className="flex items-start justify-between border-b-2 border-neutral-900 pb-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{org?.name ?? "—"}</h1>
            <p className="mt-0.5 text-sm text-neutral-600">Driver Payment Settlement</p>
          </div>
          <div className="text-right text-sm">
            <div><span className="text-neutral-500">Trip:</span> <strong>{s.trips?.trip_no}</strong></div>
            <div><span className="text-neutral-500">Status:</span> <strong className="uppercase">{s.status}</strong></div>
            {s.paid_at && <div><span className="text-neutral-500">Paid:</span> {fmtDate(s.paid_at)}</div>}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-6 text-sm">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Driver</div>
            <div className="mt-1 font-semibold">{s.drivers?.name}</div>
            <div className="text-neutral-600">{s.drivers?.phone}</div>
            {s.drivers?.license_no && <div className="text-neutral-600">DL: {s.drivers.license_no}</div>}
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Trip</div>
            <div className="mt-1 text-neutral-700">
              <div>Vehicle: <strong>{s.trips?.vehicles?.reg_no}</strong></div>
              {s.trips?.routes && (
                <div>{s.trips.routes.origin_city} → {s.trips.routes.dest_city}</div>
              )}
              <div>{fmtDate(s.trips?.actual_start ?? null)} – {fmtDate(s.trips?.ops_closed_at ?? null)}</div>
            </div>
          </div>
        </div>

        <table className="mt-7 w-full text-sm">
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

        {(advances ?? []).length > 0 && (
          <div className="mt-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Advances on this trip
            </div>
            <table className="mt-1 w-full text-xs text-neutral-600">
              <tbody className="divide-y divide-neutral-100">
                {(advances ?? []).map((a, i) => (
                  <tr key={i}>
                    <td className="py-1.5">{fmtDate(a.paid_at)} · {a.mode}{a.ref_no ? ` · ${a.ref_no}` : ""}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatInr(a.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {s.status === "paid" && (
          <div className="mt-5 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800 print:border-neutral-300 print:bg-white print:text-neutral-700">
            Paid via <strong className="uppercase">{s.mode}</strong>
            {s.ref_no ? <> · Ref/UTR: <strong>{s.ref_no}</strong></> : null} · {fmtDate(s.paid_at)}
          </div>
        )}

        <div className="mt-12 grid grid-cols-2 gap-8 text-xs text-neutral-500">
          <div>
            <div className="border-t border-neutral-400 pt-1.5">Driver signature</div>
          </div>
          <div className="text-right">
            <div className="border-t border-neutral-400 pt-1.5">Authorised signatory · {org?.name}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
