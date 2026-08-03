"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/server/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncOrgMasters } from "@/server/services/marketpe-sync.service";

export async function createOrg(formData: FormData) {
  await requireSuperAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");
  if (!name || !slug) redirect("/admin?error=Name+and+slug+are+required");

  const db = createSupabaseAdminClient();
  const { data: org, error } = await db
    .from("organizations")
    .insert({ name, slug })
    .select("id")
    .single();
  if (error) redirect(`/admin?error=${encodeURIComponent(error.message)}`);

  await db.from("org_integrations").insert({
    org_id: org.id,
    gps_webhook_token: randomBytes(24).toString("hex"),
  });

  revalidatePath("/admin");
  redirect(`/admin/${org.id}`);
}

export async function updateIntegrations(formData: FormData) {
  await requireSuperAdmin();
  const orgId = String(formData.get("orgId"));
  const val = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };

  const db = createSupabaseAdminClient();
  const { error } = await db
    .from("org_integrations")
    .update({
      marketpe_api_key: val("marketpe_api_key"),
      marketpe_gstin: val("marketpe_gstin"),
      marketpe_base_url: val("marketpe_base_url"),
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId);
  if (error) redirect(`/admin/${orgId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/admin/${orgId}`);
  redirect(`/admin/${orgId}?ok=Integrations+saved`);
}

export async function regenerateGpsToken(formData: FormData) {
  await requireSuperAdmin();
  const orgId = String(formData.get("orgId"));
  const db = createSupabaseAdminClient();
  await db
    .from("org_integrations")
    .update({
      gps_webhook_token: randomBytes(24).toString("hex"),
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId);
  revalidatePath(`/admin/${orgId}`);
  redirect(`/admin/${orgId}?ok=GPS+token+regenerated+—+update+the+GPS+provider`);
}

export async function createOrgUser(formData: FormData) {
  await requireSuperAdmin();
  const orgId = String(formData.get("orgId"));
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "supervisor");

  if (!name || !email || password.length < 8) {
    redirect(`/admin/${orgId}?error=Name,+email+and+8%2B+char+password+required`);
  }

  const db = createSupabaseAdminClient();
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) redirect(`/admin/${orgId}?error=${encodeURIComponent(error.message)}`);

  // handle_new_user trigger created the profile; scope it to the org + role.
  await db
    .from("profiles")
    .update({ name, org_id: orgId, role: role as "admin" | "supervisor" | "accountant" })
    .eq("id", created.user.id);

  revalidatePath(`/admin/${orgId}`);
  redirect(`/admin/${orgId}?ok=User+created`);
}

export async function syncMarketPe(formData: FormData) {
  await requireSuperAdmin();
  const orgId = String(formData.get("orgId"));
  const db = createSupabaseAdminClient();
  try {
    const result = await syncOrgMasters(db, orgId);
    revalidatePath(`/admin/${orgId}`);
    redirect(
      `/admin/${orgId}?ok=${encodeURIComponent(
        `Synced ${result.drivers} drivers, ${result.vehicles} vehicles (${result.skipped} skipped)`,
      )}`,
    );
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err; // redirect()
    const msg = err instanceof Error ? err.message : "Sync failed";
    redirect(`/admin/${orgId}?error=${encodeURIComponent(msg)}`);
  }
}
