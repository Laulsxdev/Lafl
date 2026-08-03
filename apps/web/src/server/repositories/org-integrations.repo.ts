import "server-only";

import type { Tables } from "@lafl/core";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type OrgIntegrations = Tables<"org_integrations">;

/**
 * Per-org integration credentials. org_integrations has RLS with no policies —
 * it is readable ONLY through the service-role client, never from browsers.
 */
export async function getOrgIntegrations(orgId: string): Promise<OrgIntegrations | null> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from("org_integrations")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error(`getOrgIntegrations: ${error.message}`);
  return data;
}

export async function findOrgIdByGpsToken(token: string): Promise<string | null> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from("org_integrations")
    .select("org_id")
    .eq("gps_webhook_token", token)
    .maybeSingle();
  if (error) throw new Error(`findOrgIdByGpsToken: ${error.message}`);
  return data?.org_id ?? null;
}
