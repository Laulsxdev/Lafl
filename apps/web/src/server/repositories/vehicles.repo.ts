import "server-only";

import type { Tables } from "@lafl/core";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function listAvailableVehicles(): Promise<Tables<"vehicles">[]> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("vehicles")
    .select("*")
    .eq("status", "available")
    .order("reg_no");
  if (error) throw new Error(`listAvailableVehicles: ${error.message}`);
  return data;
}
