import { notFound } from "next/navigation";
import { formatInr, formatWeightMt } from "@lafl/core";
import { requireOrgStaff } from "@/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import PrintButton from "@/components/print-button";

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const profile = await requireOrgStaff();
  const { invoiceId } = await params;
  const db = await createSupabaseServerClient();

  const { data: inv } = await db
    .from("customer_invoices")
    .select(
      "*, customers(name, gstin, billing_address), trips(trip_no, total_weight_kg, actual_start, ops_closed_at, vehicles(reg_no), routes(origin_city, dest_city))",
    )
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) notFound();

  const [{ data: org }, { data: integ }, { data: ewbs }] = await Promise.all([
    db.from("organizations").select("name").eq("id", profile.org_id).single(),
    createSupabaseAdminClient()
      .from("org_integrations")
      .select("marketpe_gstin")
      .eq("org_id", profile.org_id)
      .maybeSingle(),
    db
      .from("trip_eway_bills")
      .select("eway_bills(ewb_no)")
      .eq("trip_id", inv.trip_id),
  ]);

  const trip = inv.trips;
  const balance = inv.total - inv.received_amount;

  return (
    <main className="mx-auto max-w-3xl p-8 print:p-0">
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <div className="rounded-xl border border-neutral-300 bg-white p-10 print:rounded-none print:border-0 print:p-2">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-neutral-900 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{org?.name ?? "—"}</h1>
            <p className="mt-1 text-sm text-neutral-600">
              Transporter · GSTIN: {integ?.marketpe_gstin ?? "—"}
            </p>
            <p className="text-sm text-neutral-600">Plot 33B, NIT, Faridabad, Haryana 121001</p>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold uppercase tracking-widest text-neutral-400">
              Freight Invoice
            </div>
            <div className="mt-2 text-sm">
              <div><span className="text-neutral-500">Invoice No:</span> <strong>{inv.invoice_no}</strong></div>
              <div><span className="text-neutral-500">Date:</span> {fmtDate(inv.created_at)}</div>
              <div><span className="text-neutral-500">Due:</span> {fmtDate(inv.due_date)}</div>
            </div>
          </div>
        </div>

        {/* Parties */}
        <div className="mt-6 grid grid-cols-2 gap-8 text-sm">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Bill To</div>
            <div className="mt-1 font-semibold">{inv.customers?.name}</div>
            {inv.customers?.gstin && <div className="text-neutral-600">GSTIN: {inv.customers.gstin}</div>}
            {inv.customers?.billing_address && (
              <div className="text-neutral-600">{inv.customers.billing_address}</div>
            )}
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Shipment</div>
            <div className="mt-1 space-y-0.5 text-neutral-700">
              <div>Trip: <strong>{trip?.trip_no}</strong> · Vehicle: <strong>{trip?.vehicles?.reg_no}</strong></div>
              {trip?.routes && (
                <div>Route: {trip.routes.origin_city} → {trip.routes.dest_city}</div>
              )}
              {trip?.total_weight_kg && <div>Weight: {formatWeightMt(trip.total_weight_kg)}</div>}
              {(ewbs ?? []).length > 0 && (
                <div>E-Way Bill(s): {(ewbs ?? []).map((e) => e.eway_bills?.ewb_no).join(", ")}</div>
              )}
              <div>
                Period: {fmtDate(trip?.actual_start ?? null)} – {fmtDate(trip?.ops_closed_at ?? null)}
              </div>
            </div>
          </div>
        </div>

        {/* Amounts */}
        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            <tr>
              <td className="py-2.5">Freight charges</td>
              <td className="py-2.5 text-right tabular-nums">{formatInr(inv.freight_amount)}</td>
            </tr>
            {inv.other_charges > 0 && (
              <tr>
                <td className="py-2.5">Other charges (detention / handling)</td>
                <td className="py-2.5 text-right tabular-nums">{formatInr(inv.other_charges)}</td>
              </tr>
            )}
            <tr>
              <td className="py-2.5">GST {inv.gst_amount === 0 ? "(payable under RCM by recipient)" : ""}</td>
              <td className="py-2.5 text-right tabular-nums">{formatInr(inv.gst_amount)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-neutral-900 text-base font-bold">
              <td className="py-3">TOTAL</td>
              <td className="py-3 text-right tabular-nums">{formatInr(inv.total)}</td>
            </tr>
            {inv.received_amount > 0 && (
              <>
                <tr className="text-sm text-neutral-600">
                  <td className="py-1">Received</td>
                  <td className="py-1 text-right tabular-nums">− {formatInr(inv.received_amount)}</td>
                </tr>
                <tr className="text-sm font-semibold">
                  <td className="py-1">Balance due</td>
                  <td className="py-1 text-right tabular-nums">{formatInr(balance)}</td>
                </tr>
              </>
            )}
          </tfoot>
        </table>

        {/* Footer */}
        <div className="mt-10 flex items-end justify-between border-t border-neutral-200 pt-6 text-xs text-neutral-500">
          <div>
            <p>Payment within credit period. Subject to Faridabad jurisdiction.</p>
            <p className="mt-0.5">This is a computer-generated invoice.</p>
          </div>
          <div className="text-right">
            <div className="mb-10 text-neutral-400">Authorised signatory</div>
            <div className="font-semibold text-neutral-700">For {org?.name}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
