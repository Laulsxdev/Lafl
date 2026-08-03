import "server-only";

import type { Json, Tables } from "@lafl/core";
import { ewbNumberSchema } from "@lafl/core";
import { parseEwayResponse } from "@lafl/marketpe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { marketpeForOrg } from "@/server/integrations/marketpe";

const CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * Fetch an E-Way Bill for an org: return the cached row if fresh, otherwise
 * pull from MarketPe eway/get and upsert. Trip-wizard Step B calls this.
 */
export async function fetchEwayBill(
  orgId: string,
  rawEwbNo: string,
): Promise<Tables<"eway_bills">> {
  const ewbNo = ewbNumberSchema.parse(rawEwbNo);
  const db = createSupabaseAdminClient();

  const { data: existing } = await db
    .from("eway_bills")
    .select("*")
    .eq("org_id", orgId)
    .eq("ewb_no", ewbNo)
    .maybeSingle();

  if (existing && Date.now() - Date.parse(existing.fetched_at) < CACHE_TTL_MS) {
    return existing;
  }

  const { client, gstin } = await marketpeForOrg(orgId);
  if (!gstin) {
    throw new Error(`MarketPe GSTIN is not configured for org ${orgId}`);
  }
  const raw = await client.ewayGet({ ewayBillNumber: ewbNo, gstin });
  const summary = parseEwayResponse(raw);

  const expired =
    summary?.validUntil !== null &&
    summary !== null &&
    Date.parse(summary.validUntil!) < Date.now();

  const mapped = {
    org_id: orgId,
    ewb_no: ewbNo,
    consignor_name: summary?.consignorName ?? null,
    consignee_name: summary?.consigneeName ?? null,
    origin: summary?.origin ?? null,
    destination: summary?.destination ?? null,
    material: summary?.material ?? null,
    weight_kg: summary?.weightKg ?? null,
    invoice_no: summary?.invoiceNo ?? null,
    invoice_value: summary?.invoiceValue ?? null,
    generated_at: summary?.generatedAt ?? null,
    valid_until: summary?.validUntil ?? null,
    status: (summary?.status === "cancelled"
      ? "cancelled"
      : expired
        ? "expired"
        : "active") as "cancelled" | "expired" | "active",
    raw_json: raw as Json,
    fetched_at: new Date().toISOString(),
  };

  const { data: upserted, error } = await db
    .from("eway_bills")
    .upsert(mapped, { onConflict: "org_id,ewb_no" })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to store E-Way Bill ${ewbNo}: ${error.message}`);
  return upserted;
}
