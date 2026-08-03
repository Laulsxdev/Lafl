import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncOrgPayments } from "@/server/services/marketpe-sync.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = serverEnv().CRON_SECRET;
  const bearer = req.headers.get("authorization");
  return (
    req.nextUrl.searchParams.get("token") === secret || bearer === `Bearer ${secret}`
  );
}

/** pg_cron → nightly chowkidaar: reconcile MarketPe payments for every org with a key. */
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const daysBack = Math.min(Number(req.nextUrl.searchParams.get("days") ?? "30"), 31);
  const to = new Date();
  const from = new Date(to.getTime() - daysBack * 86_400_000);

  const db = createSupabaseAdminClient();
  const { data: orgs } = await db
    .from("org_integrations")
    .select("org_id")
    .not("marketpe_api_key", "is", null);

  const results: Record<string, unknown> = {};
  for (const org of orgs ?? []) {
    try {
      results[org.org_id] = await syncOrgPayments(db, org.org_id, {
        createdTimeFrom: from.toISOString(),
        createdTimeTo: to.toISOString(),
      });
    } catch (e) {
      results[org.org_id] = { error: e instanceof Error ? e.message : "failed" };
    }
  }
  return NextResponse.json({ ok: true, orgs: results });
}
