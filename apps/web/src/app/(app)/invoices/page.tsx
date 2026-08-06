import Link from "next/link";
import { formatInr } from "@lafl/core";
import ActionForm from "@/components/action-form";
import { requireOrgStaff } from "@/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordReceiptAction } from "../trips/actions";
import {
  EmptyState,
  PageHeader,
  SectionHeading,
  bannerError,
  bannerOk,
  btnSuccess,
  inputSmCls,
} from "@/components/ui";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  await requireOrgStaff();
  const { error, ok } = await searchParams;
  const db = await createSupabaseServerClient();

  const [{ data: open }, { data: toInvoice }] = await Promise.all([
    db
      .from("customer_invoices")
      .select("*, customers(name), trips(trip_no)")
      .neq("status", "received")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(100),
    db
      .from("trips")
      .select("id, trip_no, ops_closed_at, total_weight_kg, vehicles(reg_no), customer_invoices(id)")
      .in("status", ["ops_closed", "completed"])
      .eq("billing_status", "unbilled")
      .order("ops_closed_at", { ascending: true, nullsFirst: false })
      .limit(50),
  ]);

  const outstanding = (open ?? []).reduce((s, i) => s + (i.total - i.received_amount), 0);
  const needInvoice = (toInvoice ?? []).filter((t) => (t.customer_invoices ?? []).length === 0);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-4xl">
      <PageHeader title="Customer Invoices" subtitle="Raise invoices and record receipts.">
        <div className="rounded-lg border border-neutral-200 bg-white px-3.5 py-2 text-sm shadow-xs">
          <span className="text-neutral-500">Outstanding</span>{" "}
          <span className="font-semibold tabular-nums text-neutral-900">{formatInr(outstanding)}</span>
        </div>
      </PageHeader>
      {error && <p className={`mt-4 ${bannerError}`}>{error}</p>}
      {ok && <p className={`mt-4 ${bannerOk}`}>{ok}</p>}

      <div className="mt-8">
        <SectionHeading title="Awaiting payment" count={(open ?? []).length} />
      </div>
      <div className="mt-3 space-y-2">
        {(open ?? []).map((inv) => (
          <div
            key={inv.id}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 text-sm shadow-xs ${inv.due_date && inv.due_date < today ? "border-red-300" : "border-neutral-200"}`}
          >
            <div className="min-w-0">
              <Link href={`/trips/${inv.trip_id}`} className="font-semibold text-neutral-900 hover:underline">
                {inv.invoice_no}
              </Link>
              <a
                href={`/print/invoice/${inv.id}`}
                target="_blank"
                className="ml-2 text-xs font-medium text-neutral-500 underline underline-offset-2 hover:text-neutral-900"
              >
                PDF ↗
              </a>
              <span className="ml-2 text-neutral-500">{inv.customers?.name}</span>
              {inv.due_date && inv.due_date < today && (
                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                  OVERDUE (due {inv.due_date})
                </span>
              )}
            </div>
            <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-end">
              <div className="sm:text-right">
                <div className="font-semibold tabular-nums text-neutral-900">{formatInr(inv.total - inv.received_amount)}</div>
                <div className="text-xs tabular-nums text-neutral-400">of {formatInr(inv.total)}</div>
              </div>
              <ActionForm
                action={recordReceiptAction}
                resetOnOk
                className="flex w-full flex-col gap-1.5 sm:w-auto sm:flex-row sm:items-center"
              >
                <input type="hidden" name="tripId" value={inv.trip_id} />
                <input type="hidden" name="invoiceId" value={inv.id} />
                <input name="amount" type="number" step="0.01" placeholder="₹ received" required className={`w-full min-w-0 sm:w-28 ${inputSmCls}`} />
                <button type="submit" className={`${btnSuccess} w-full px-3 py-1.5 text-xs sm:w-auto`}>
                  Receipt
                </button>
              </ActionForm>
            </div>
          </div>
        ))}
        {(open ?? []).length === 0 && (
          <EmptyState
            framed
            compact
            icon="check"
            title="No outstanding invoices"
            hint="Everything billed has been collected."
          />
        )}
      </div>

      <div className="mt-10">
        <SectionHeading title="Trips ready to invoice" count={needInvoice.length} />
      </div>
      <div className="mt-3 space-y-1.5">
        {needInvoice.map((t) => (
          <Link
            key={t.id}
            href={`/trips/${t.id}`}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm shadow-xs hover:border-neutral-300 hover:bg-neutral-50"
          >
            <span className="min-w-0 font-medium text-neutral-900">
              {t.trip_no} · {t.vehicles?.reg_no}
              {t.total_weight_kg ? ` · ${(t.total_weight_kg / 1000).toFixed(3)} MT` : ""}
            </span>
            <span className="shrink-0 text-neutral-400">raise invoice →</span>
          </Link>
        ))}
        {needInvoice.length === 0 && (
          <EmptyState
            framed
            compact
            icon="document"
            title="All closed trips are invoiced"
          />
        )}
      </div>
    </div>
  );
}
