import "server-only";

import { MarketPeClient } from "@lafl/marketpe";
import { getOrgIntegrations } from "@/server/repositories/org-integrations.repo";

const clients = new Map<string, MarketPeClient>();

/** Per-org MarketPe client. Credentials live in org_integrations, not env. */
export async function marketpeForOrg(
  orgId: string,
): Promise<{ client: MarketPeClient; gstin: string | null }> {
  const integ = await getOrgIntegrations(orgId);
  if (!integ?.marketpe_api_key) {
    throw new Error(`MarketPe is not configured for org ${orgId}`);
  }
  let client = clients.get(orgId);
  if (!client) {
    client = new MarketPeClient({
      apiKey: integ.marketpe_api_key,
      baseUrl: integ.marketpe_base_url ?? undefined,
    });
    clients.set(orgId, client);
  }
  return { client, gstin: integ.marketpe_gstin };
}
