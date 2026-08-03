"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgStaff } from "@/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function bounce(msg: string, ok = true): never {
  redirect(`/sites?${ok ? "ok" : "error"}=${encodeURIComponent(msg)}`);
}

export async function confirmSite(formData: FormData) {
  await requireOrgStaff();
  const db = await createSupabaseServerClient();
  const name = str(formData, "name");
  if (!name) bounce("Site name is required", false);
  const { error } = await db
    .from("sites")
    .update({ name, confirmed: true, confidence: 3 })
    .eq("id", str(formData, "siteId"));
  revalidatePath("/sites");
  if (error) bounce(error.message, false);
  bounce("Site confirmed");
}

export async function deactivateSite(formData: FormData) {
  await requireOrgStaff();
  const db = await createSupabaseServerClient();
  await db.from("sites").update({ active: false }).eq("id", str(formData, "siteId"));
  revalidatePath("/sites");
  bounce("Site removed");
}

export async function createSite(formData: FormData) {
  const profile = await requireOrgStaff();
  const db = await createSupabaseServerClient();
  const name = str(formData, "name");
  const lat = Number(str(formData, "lat"));
  const lng = Number(str(formData, "lng"));
  const radius = Number(str(formData, "radius") || "400");
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    bounce("Name, latitude, longitude required", false);
  }
  if (lat < 6 || lat > 37 || lng < 68 || lng > 98) {
    bounce("Coordinates appear to be outside India — please check", false);
  }

  const { data: fence, error: gfErr } = await db
    .from("geofences")
    .insert({
      org_id: profile.org_id!,
      name,
      kind: "home_base",
      center_lat: lat,
      center_lng: lng,
      radius_m: radius,
    })
    .select("id")
    .single();
  if (gfErr) bounce(gfErr.message, false);

  const { error } = await db.from("sites").insert({
    org_id: profile.org_id!,
    kind: "home_base",
    name,
    geofence_id: fence.id,
    center_lat: lat,
    center_lng: lng,
    radius_m: radius,
    source: "manual",
    confirmed: true,
    confidence: 3,
  });
  revalidatePath("/sites");
  if (error) bounce(error.message, false);
  bounce("Site created");
}
