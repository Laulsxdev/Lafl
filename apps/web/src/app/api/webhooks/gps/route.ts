import { NextResponse, after, type NextRequest } from "next/server";
import { findOrgIdByGpsToken } from "@/server/repositories/org-integrations.repo";
import {
  gpsWebhookSchema,
  ingestGpsFix,
} from "@/server/services/gps-ingest.service";

export const dynamic = "force-dynamic";

/**
 * GPS provider webhook — multi-tenant: the token identifies the org, so each
 * org gets its own webhook URL (/api/webhooks/gps?token=<org token>).
 *
 * Provider contract:
 * - must return 200 immediately; non-200 triggers up to 3 retries of the SAME
 *   payload, so malformed data is acknowledged with 200 (retrying won't fix it)
 *   and only auth failures are rejected.
 * - processing happens after the response via after(); dedup by refid.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const orgId = token ? await findOrgIdByGpsToken(token) : null;
  if (!orgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = gpsWebhookSchema.safeParse(body);
  if (!parsed.success) {
    console.warn("gps webhook: unparseable payload", parsed.error.issues);
    return NextResponse.json({ ok: false, reason: "unparseable" });
  }

  after(async () => {
    try {
      await ingestGpsFix(orgId, parsed.data);
    } catch (err) {
      console.error("gps webhook: ingest failed", err);
    }
  });

  return NextResponse.json({ ok: true });
}
