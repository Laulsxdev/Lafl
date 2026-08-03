import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { pollIntanglesOrg } from "@/server/services/intangles-poll.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = serverEnv().CRON_SECRET;
  const bearer = req.headers.get("authorization");
  return (
    req.nextUrl.searchParams.get("token") === secret || bearer === `Bearer ${secret}`
  );
}

/** pg_cron → every 1-2 min: pull Intangles GPS for every org that has it configured. */
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createSupabaseAdminClient();
  const { data: orgs } = await db
    .from("org_integrations")
    .select("org_id, settings")
    .not("settings->intangles", "is", null);

  const results: Record<string, unknown> = {};
  for (const org of orgs ?? []) {
    try {
      results[org.org_id] = await pollIntanglesOrg(org.org_id);
    } catch (e) {
      results[org.org_id] = { error: e instanceof Error ? e.message : "failed" };
    }
  }
  return NextResponse.json({ ok: true, orgs: results });
}
