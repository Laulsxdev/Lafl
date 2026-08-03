"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@lafl/core";
import { clientEnv } from "@/lib/env";

export function createClient() {
  return createBrowserClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
