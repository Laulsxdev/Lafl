import Link from "next/link";
import { requireSuperAdmin } from "@/server/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createOrg } from "./actions";
import {
  EmptyState,
  PageHeader,
  bannerError,
  btnPrimary,
  cardCls,
  inputCls,
  labelCls,
  tdCls,
  thCls,
} from "@/components/ui";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireSuperAdmin();
  const { error } = await searchParams;

  const db = createSupabaseAdminClient();
  const { data: orgs } = await db
    .from("organizations")
    .select("id, name, slug, status, created_at")
    .order("created_at");

  return (
    <div>
      <PageHeader title="Organizations" subtitle="Provision and manage tenant workspaces." />
      {error && <p className={`mt-4 ${bannerError}`}>{error}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className={`overflow-hidden ${cardCls}`}>
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-100 bg-neutral-50/80">
                <tr>
                  <th className={thCls}>Name</th>
                  <th className={thCls}>Slug</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {(orgs ?? []).map((o) => (
                  <tr key={o.id} className="hover:bg-neutral-50">
                    <td className={`${tdCls} font-medium text-neutral-900`}>{o.name}</td>
                    <td className={`${tdCls} text-neutral-500`}>{o.slug}</td>
                    <td className={`${tdCls} capitalize`}>{o.status}</td>
                    <td className={`${tdCls} text-right`}>
                      <Link
                        href={`/admin/${o.id}`}
                        className="font-medium text-neutral-900 underline-offset-2 hover:underline"
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                ))}
                {(orgs ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <EmptyState
                        icon="inbox"
                        title="No organizations yet"
                        hint="Create the first one on the right."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`h-fit p-5 ${cardCls}`}>
          <h2 className="text-sm font-semibold text-neutral-900">New organization</h2>
          <form action={createOrg} className="mt-4 space-y-3">
            <div>
              <label className={labelCls}>Company name</label>
              <input name="name" placeholder="Company name" required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Slug</label>
              <input name="slug" placeholder="slug (e.g. lauls)" required className={inputCls} />
            </div>
            <button type="submit" className={`${btnPrimary} w-full`}>
              Create organization
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
