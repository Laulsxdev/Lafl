import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/server/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createOrgUser,
  regenerateGpsToken,
  syncMarketPe,
  updateIntegrations,
} from "../actions";
import {
  SectionCard,
  TableScroll,
  bannerError,
  bannerOk,
  btnGhost,
  btnPrimary,
  inputCls,
  labelCls,
} from "@/components/ui";

export default async function OrgAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  await requireSuperAdmin();
  const { orgId } = await params;
  const { error, ok } = await searchParams;

  const db = createSupabaseAdminClient();
  const [{ data: org }, { data: integ }, { data: users }] = await Promise.all([
    db.from("organizations").select("*").eq("id", orgId).maybeSingle(),
    db.from("org_integrations").select("*").eq("org_id", orgId).maybeSingle(),
    db
      .from("profiles")
      .select("id, name, email, role, active")
      .eq("org_id", orgId)
      .order("name"),
  ]);
  if (!org) notFound();

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">
        {org.name}
      </h1>
      <p className="mt-1 text-sm text-neutral-500">slug: {org.slug}</p>
      {error && <p className={`mt-4 ${bannerError}`}>{error}</p>}
      {ok && <p className={`mt-4 ${bannerOk}`}>{ok}</p>}

      <SectionCard
        className="mt-8"
        title="MarketPe integration"
        aside={
          <form action={syncMarketPe}>
            <input type="hidden" name="orgId" value={orgId} />
            <button type="submit" className={btnPrimary}>
              Sync masters now
            </button>
          </form>
        }
      >
        <form action={updateIntegrations} className="grid gap-3 md:grid-cols-2">
          <input type="hidden" name="orgId" value={orgId} />
          <div>
            <label className={labelCls}>API key</label>
            <input
              name="marketpe_api_key"
              defaultValue={integ?.marketpe_api_key ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>GSTIN</label>
            <input
              name="marketpe_gstin"
              defaultValue={integ?.marketpe_gstin ?? ""}
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>
              Base URL (leave blank for default)
            </label>
            <input
              name="marketpe_base_url"
              defaultValue={integ?.marketpe_base_url ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <button type="submit" className={btnPrimary}>
              Save integration
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard className="mt-6" title="GPS webhook">
        <p className="break-all rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-700">
          POST /api/webhooks/gps?token={integ?.gps_webhook_token ?? "—"}
        </p>
        <form action={regenerateGpsToken} className="mt-3">
          <input type="hidden" name="orgId" value={orgId} />
          <button type="submit" className={btnGhost}>
            Regenerate token
          </button>
        </form>
      </SectionCard>

      <SectionCard className="mt-6" title="Users">
        <TableScroll>
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                <th className="py-2 pr-3 font-semibold">Name</th>
                <th className="py-2 pr-3 font-semibold">Email</th>
                <th className="py-2 pr-3 font-semibold">Role</th>
                <th className="py-2 font-semibold">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {(users ?? []).map((u) => (
                <tr key={u.id}>
                  <td className="py-2.5 pr-3 font-medium text-neutral-900">{u.name}</td>
                  <td className="py-2.5 pr-3">{u.email}</td>
                  <td className="py-2.5 pr-3 capitalize">{u.role}</td>
                  <td className="py-2.5">{u.active ? "Yes" : "No"}</td>
                </tr>
              ))}
              {(users ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-neutral-400">
                    No users in this organization yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableScroll>

        <form action={createOrgUser} className="mt-6 grid gap-3 border-t border-neutral-100 pt-5 md:grid-cols-2">
          <input type="hidden" name="orgId" value={orgId} />
          <input name="name" placeholder="Full name" required className={inputCls} />
          <input name="email" type="email" placeholder="Email" required className={inputCls} />
          <input
            name="password"
            type="text"
            placeholder="Temp password (8+ chars)"
            required
            className={inputCls}
          />
          <select name="role" className={inputCls} defaultValue="supervisor">
            <option value="admin">Admin</option>
            <option value="supervisor">Supervisor</option>
            <option value="accountant">Accountant</option>
          </select>
          <div>
            <button type="submit" className={btnPrimary}>
              Create user
            </button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
