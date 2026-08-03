import "server-only";

import type { Json } from "@lafl/core";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SessionProfile } from "@/server/auth";

const round2 = (n: number) => Math.round(n * 100) / 100;

const INVOICEABLE = ["ops_closed", "completed"];

/**
 * Create the customer invoice for a trip.
 * Freight = rate/MT x weight — rate comes from a freight_contracts line
 * (validity-checked) or a manual rate when no contract covers the lane.
 */
export async function generateInvoice(
  profile: SessionProfile,
  tripId: string,
  input: {
    customerId: string;
    contractLineId: string | null;
    manualRatePerMt: number | null;
    weightMt: number;
    otherCharges: number;
    gstAmount: number;
  },
): Promise<void> {
  const db = await createSupabaseServerClient();
  const { data: trip } = await db.from("trips").select("*").eq("id", tripId).single();
  if (!trip) throw new Error("Trip not found");
  if (!INVOICEABLE.includes(trip.status)) {
    throw new Error("Invoice can be raised only after ops are closed");
  }
  const { count: existing } = await db
    .from("customer_invoices")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId);
  if ((existing ?? 0) > 0) throw new Error("This trip already has an invoice");

  if (!(input.weightMt > 0)) throw new Error("Weight (MT) must be greater than 0");
  if (input.otherCharges < 0 || input.gstAmount < 0) {
    throw new Error("Amounts cannot be negative");
  }

  let ratePerMt: number;
  if (input.contractLineId) {
    const { data: line } = await db
      .from("freight_contracts")
      .select("*")
      .eq("id", input.contractLineId)
      .single();
    if (!line) throw new Error("Contract line not found");
    const today = new Date().toISOString().slice(0, 10);
    if (line.valid_from && today < line.valid_from) {
      throw new Error("Contract line is not yet valid");
    }
    if (line.valid_to && today > line.valid_to) {
      throw new Error(`Contract line expired on ${line.valid_to} — use a manual rate or updated contract`);
    }
    ratePerMt = line.rate_per_mt;
  } else if (input.manualRatePerMt && input.manualRatePerMt > 0) {
    ratePerMt = input.manualRatePerMt;
  } else {
    throw new Error("Pick a contract line or enter a manual rate");
  }

  const { data: customer } = await db
    .from("customers")
    .select("id, credit_days")
    .eq("id", input.customerId)
    .single();
  if (!customer) throw new Error("Select the customer to bill");

  const freight = round2(ratePerMt * input.weightMt);
  const total = round2(freight + input.otherCharges + input.gstAmount);
  const dueDate = new Date(Date.now() + (customer.credit_days || 0) * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const { error } = await db.from("customer_invoices").insert({
    org_id: profile.org_id!,
    trip_id: tripId,
    customer_id: customer.id,
    invoice_no: `INV-${trip.trip_no}`,
    freight_amount: freight,
    other_charges: input.otherCharges,
    gst_amount: input.gstAmount,
    total,
    status: "invoiced",
    due_date: dueDate,
    created_by: profile.id,
  });
  if (error) {
    if (error.code === "23505") throw new Error("Invoice number already exists for this trip");
    throw new Error(error.message);
  }

  await db.from("trips").update({ billing_status: "invoiced" }).eq("id", tripId);
  await db.from("activity_logs").insert({
    org_id: profile.org_id!,
    entity_type: "trip",
    entity_id: tripId,
    action: "invoice_raised",
    new_value: { ratePerMt, weightMt: input.weightMt, freight, total } as Json,
    actor_id: profile.id,
  });
}

/** Record money received against an invoice (supports partial receipts). */
export async function recordReceipt(
  profile: SessionProfile,
  invoiceId: string,
  amount: number,
): Promise<void> {
  if (!(amount > 0)) throw new Error("Receipt amount must be greater than 0");
  const db = await createSupabaseServerClient();
  const { data: inv } = await db
    .from("customer_invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();
  if (!inv) throw new Error("Invoice not found");
  if (inv.status === "received") throw new Error("Invoice is already fully received");

  const newReceived = round2(inv.received_amount + amount);
  if (newReceived > inv.total + 1) {
    throw new Error(
      `Receipt exceeds invoice: total ₹${inv.total}, already received ₹${inv.received_amount}`,
    );
  }
  const status = newReceived >= inv.total - 0.01 ? "received" : "partially_received";

  const { error } = await db
    .from("customer_invoices")
    .update({ received_amount: newReceived, status })
    .eq("id", invoiceId);
  if (error) throw new Error(error.message);

  await db.from("trips").update({ billing_status: status }).eq("id", inv.trip_id);
  await db.from("activity_logs").insert({
    org_id: inv.org_id,
    entity_type: "trip",
    entity_id: inv.trip_id,
    action: "payment_received",
    new_value: { invoiceId, amount, newReceived, status } as Json,
    actor_id: profile.id,
  });
}
