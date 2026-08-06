import { requireOrgStaff } from "@/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EmptyState, PageHeader, TableScroll, cardCls, tdCls, thCls } from "@/components/ui";

export default async function DriversPage() {
  await requireOrgStaff();
  const db = await createSupabaseServerClient();
  const { data: drivers } = await db
    .from("drivers")
    .select("name, phone, license_no, license_expiry, status")
    .order("name");

  return (
    <div>
      <PageHeader title="Drivers" subtitle="Crew roster and license status." />
      <div className={`mt-6 overflow-hidden ${cardCls}`}>
        <TableScroll>
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-neutral-100 bg-neutral-50/80">
              <tr>
                <th className={thCls}>Name</th>
                <th className={thCls}>Phone</th>
                <th className={thCls}>License</th>
                <th className={thCls}>License Expiry</th>
                <th className={thCls}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {(drivers ?? []).map((d) => (
                <tr key={d.phone} className="hover:bg-neutral-50">
                  <td className={`${tdCls} font-medium text-neutral-900`}>{d.name}</td>
                  <td className={tdCls}>{d.phone}</td>
                  <td className={tdCls}>{d.license_no ?? "—"}</td>
                  <td className={tdCls}>{d.license_expiry ?? "—"}</td>
                  <td className={`${tdCls} capitalize`}>{d.status}</td>
                </tr>
              ))}
              {(drivers ?? []).length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      icon="inbox"
                      title="No drivers yet"
                      hint="Sync from MarketPe or add manually to build your crew."
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
