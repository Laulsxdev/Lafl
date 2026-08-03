/**
 * Chowkidaar — nightly MarketPe payment reconciliation.
 * usage: tsx scripts/sync-payments.ts <orgId> [daysBack=30]
 * env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@lafl/core";
import { syncOrgPayments } from "../src/server/services/marketpe-sync.service";

const [orgId, daysArg] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!orgId || !url || !key) {
  console.error("usage: tsx scripts/sync-payments.ts <orgId> [daysBack]");
  process.exit(1);
}
const days = Math.min(Number(daysArg ?? "30"), 31);

const db = createClient<Database>(url, key, { auth: { persistSession: false } });
const to = new Date();
const from = new Date(to.getTime() - days * 86_400_000);

syncOrgPayments(db, orgId, {
  createdTimeFrom: from.toISOString(),
  createdTimeTo: to.toISOString(),
})
  .then((r) => {
    console.log(
      `chowkidaar: scanned ${r.scanned} payments | matched->PAID ${r.matched} | already recorded ${r.alreadyRecorded} | unmatched ${r.unmatched}`,
    );
    process.exit(0);
  })
  .catch((e) => {
    console.error("chowkidaar failed:", e.message);
    process.exit(1);
  });
