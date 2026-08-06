import Link from "next/link";
import { requireOrgStaff } from "@/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  EmptyState,
  PageHeader,
  TableScroll,
  cardCls,
  colSecondary,
  colTertiary,
  tdCls,
  thCls,
} from "@/components/ui";

export default async function VehiclesPage() {
  await requireOrgStaff();
  const db = await createSupabaseServerClient();
  const { data: vehicles } = await db
    .from("vehicles")
    .select("id, reg_no, vehicle_type, ownership, status, gps_device_id, insurance_expiry, permit_expiry")
    .order("reg_no");

  return (
    <div>
      <PageHeader title="Vehicles" subtitle="Fleet roster, documents and GPS coverage." />
      <div className={`mt-6 overflow-hidden ${cardCls}`}>
        <TableScroll>
          <table className="w-full min-w-[440px] text-sm md:min-w-[660px]">
            <thead className="border-b border-neutral-100 bg-neutral-50/80">
              <tr>
                <th className={thCls}>Reg No</th>
                <th className={`${thCls} ${colSecondary}`}>Type</th>
                <th className={`${thCls} ${colTertiary}`}>Ownership</th>
                <th className={thCls}>Status</th>
                <th className={thCls}>Insurance Expiry</th>
                <th className={thCls}>Permit Expiry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {(vehicles ?? []).map((v) => (
                <tr key={v.id} className="hover:bg-neutral-50">
                  <td className={`${tdCls} font-medium text-neutral-900`}>
                    <Link href={`/vehicles/${v.id}`} className="hover:underline">
                      {v.reg_no}
                    </Link>
                    {v.gps_device_id && (
                      <span className="ml-2 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                        GPS
                      </span>
                    )}
                  </td>
                  <td className={`${tdCls} ${colSecondary}`}>{v.vehicle_type}</td>
                  <td className={`${tdCls} ${colTertiary}`}>{v.ownership}</td>
                  <td className={`${tdCls} capitalize`}>{v.status.replace(/_/g, " ")}</td>
                  <td className={tdCls}>{v.insurance_expiry ?? "—"}</td>
                  <td className={tdCls}>{v.permit_expiry ?? "—"}</td>
                </tr>
              ))}
              {(vehicles ?? []).length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon="truck"
                      title="No vehicles yet"
                      hint="Sync from MarketPe or add manually to build your fleet."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableScroll>
      </div>
    </div>
  );
}
