import { z } from "zod";

/**
 * Environment access — the ONLY place process.env is read.
 * Server-only secrets must never be imported from client components.
 *
 * NOTE: integration credentials (MarketPe key/GSTIN, GPS webhook tokens) are
 * PER-ORG and live in the org_integrations table — not here. Env holds only
 * platform-level secrets.
 */

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  /** Shared secret for /api/cron/* routes (pg_cron calls them over HTTP). */
  CRON_SECRET: z.string().min(16),
});

export const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

let cachedServerEnv: z.infer<typeof serverSchema> | null = null;

/** Lazy so the app can boot (and pages render) before secrets are configured. */
export function serverEnv(): z.infer<typeof serverSchema> {
  cachedServerEnv ??= serverSchema.parse(process.env);
  return cachedServerEnv;
}
