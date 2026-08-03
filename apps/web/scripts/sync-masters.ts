/**
 * One-off / cron master sync: pnpm dlx tsx scripts/sync-masters.ts <orgId>
 * Requires env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@lafl/core";
import { syncOrgMasters } from "../src/server/services/marketpe-sync.service";

const orgId = process.argv[2];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!orgId || !url || !key) {
  console.error("usage: tsx scripts/sync-masters.ts <orgId> (with Supabase env set)");
  process.exit(1);
}

const db = createClient<Database>(url, key, { auth: { persistSession: false } });

syncOrgMasters(db, orgId)
  .then((r) => {
    console.log(`synced: ${r.drivers} drivers, ${r.vehicles} vehicles, ${r.skipped} skipped`);
    process.exit(0);
  })
  .catch((e) => {
    console.error("sync failed:", e.message);
    process.exit(1);
  });
