import { requireOrgStaff } from "@/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import SelectSearch from "@/components/select-search";
import { createTrip } from "../actions";
import { PageHeader, bannerError, btnPrimary, cardCls, labelCls } from "@/components/ui";

export default async function NewTripPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireOrgStaff();
  const { error } = await searchParams;
  const db = await createSupabaseServerClient();
  const { data: vehicles } = await db
    .from("vehicles")
    .select("id, reg_no, vehicle_type, ownership")
    .eq("status", "available")
    .order("reg_no")
    .limit(300);

  return (
    <div className="max-w-lg">
      <PageHeader
        title="New Trip"
        subtitle="Step 1 of 4 — select the vehicle. E-Way Bills, crew and money come next."
      />
      {error && <p className={`mt-4 ${bannerError}`}>{error}</p>}
      <form action={createTrip} className={`mt-6 space-y-4 p-6 ${cardCls}`}>
        <div>
          <label className={labelCls}>Vehicle (available only)</label>
          <SelectSearch
            name="vehicleId"
            required
            placeholder="Type or select truck number…"
            options={(vehicles ?? []).map((v) => ({
              value: v.id,
              label: v.reg_no,
              hint: `${v.vehicle_type} · ${v.ownership}`,
            }))}
          />
        </div>
        <button type="submit" className={btnPrimary}>
          Create draft trip →
        </button>
      </form>
    </div>
  );
}
