import "server-only";

import { redirect } from "next/navigation";
import type { Tables } from "@lafl/core";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionProfile = Tables<"profiles"> & {
  organizations: { name: string } | null;
};

/** Loads the logged-in user's profile (with org name) or bounces to /login. */
export async function requireProfile(): Promise<SessionProfile> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, organizations(name)")
    .eq("id", user.id)
    .single();
  if (!profile || !profile.active) redirect("/login");
  return profile;
}

export async function requireSuperAdmin(): Promise<SessionProfile> {
  const profile = await requireProfile();
  if (profile.role !== "super_admin") redirect("/");
  return profile;
}

/** Staff member scoped to an org (admin / supervisor / accountant). */
export async function requireOrgStaff(): Promise<SessionProfile & { org_id: string }> {
  const profile = await requireProfile();
  if (
    !profile.org_id ||
    !["admin", "supervisor", "accountant"].includes(profile.role)
  ) {
    redirect("/");
  }
  return profile as SessionProfile & { org_id: string };
}
