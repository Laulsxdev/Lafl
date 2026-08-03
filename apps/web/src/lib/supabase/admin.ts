import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@lafl/core";
import { clientEnv, serverEnv } from "@/lib/env";

/**
 * Service-role client — bypasses RLS. Use ONLY inside server services for
 * system operations (sync jobs, geofence workers, webhooks). Never expose to
 * request-scoped user reads; those go through createSupabaseServerClient.
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
}
