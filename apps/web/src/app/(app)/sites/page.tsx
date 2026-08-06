import { requireOrgStaff } from "@/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { confirmSite, createSite, deactivateSite } from "./actions";
import {
  EmptyState,
  PageHeader,
  SectionHeading,
  bannerError,
  bannerOk,
  btnDanger,
  btnPrimary,
  btnSuccess,
  cardCls,
  inputSmCls,
} from "@/components/ui";

export default async function SitesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  await requireOrgStaff();
  const { error, ok } = await searchParams;
  const db = await createSupabaseServerClient();
  const { data: sites } = await db
    .from("sites")
    .select("*")
    .eq("active", true)
    .order("kind")
    .order("created_at");

  const homeBases = (sites ?? []).filter((s) => s.kind === "home_base");
  const customers = (sites ?? []).filter((s) => s.kind === "customer");

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Sites"
        subtitle="Home yards & customer delivery points. Unconfirmed yards were discovered from parked-truck GPS clusters — name and confirm them."
      />
      {error && <p className={`mt-4 ${bannerError}`}>{error}</p>}
      {ok && <p className={`mt-4 ${bannerOk}`}>{ok}</p>}

      <div className="mt-8">
        <SectionHeading title="Home bases" count={homeBases.length} />
      </div>
      <div className="mt-3 space-y-2">
        {homeBases.map((s) => (
          <div key={s.id} className={`rounded-xl border bg-white p-4 shadow-xs ${s.confirmed ? "border-neutral-200" : "border-amber-300 bg-amber-50/40"}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 text-sm">
                <div className="font-semibold text-neutral-900">
                  {s.name}{" "}
                  {!s.confirmed && (
                    <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      unconfirmed
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-neutral-500">
                  {s.center_lat.toFixed(5)}, {s.center_lng.toFixed(5)} · {s.radius_m}m radius ·{" "}
                  {s.source}{s.sample_count ? ` (${s.sample_count} trucks seen)` : ""} ·{" "}
                  <a
                    href={`https://www.google.com/maps?q=${s.center_lat},${s.center_lng}`}
                    target="_blank"
                    className="underline underline-offset-2"
                  >
                    view on map
                  </a>
                </div>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                {!s.confirmed && (
                  <form action={confirmSite} className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <input type="hidden" name="siteId" value={s.id} />
                    <input
                      name="name"
                      placeholder="Yard name (e.g. Prithla Stockyard)"
                      required
                      className={`w-full sm:w-64 ${inputSmCls}`}
                    />
                    <button type="submit" className={`${btnSuccess} px-3 py-2 text-sm`}>
                      Confirm
                    </button>
                  </form>
                )}
                <form action={deactivateSite}>
                  <input type="hidden" name="siteId" value={s.id} />
                  <button type="submit" className={btnDanger}>
                    Remove
                  </button>
                </form>
              </div>
            </div>
          </div>
        ))}
        {homeBases.length === 0 && (
          <EmptyState
            framed
            compact
            icon="pin"
            title="No home bases yet"
            hint="Run discovery or add one below."
          />
        )}
      </div>

      <div className={`mt-6 p-4 sm:p-5 ${cardCls}`}>
        <h3 className="text-sm font-semibold text-neutral-900">Add home base manually</h3>
        <form action={createSite} className="mt-3 flex flex-wrap items-center gap-2">
          <input name="name" placeholder="Name" required className={`w-full sm:w-56 ${inputSmCls}`} />
          <input name="lat" placeholder="Latitude" required className={`w-[calc(50%-0.25rem)] sm:w-32 ${inputSmCls}`} />
          <input name="lng" placeholder="Longitude" required className={`w-[calc(50%-0.25rem)] sm:w-32 ${inputSmCls}`} />
          <input name="radius" placeholder="Radius m (400)" className={`w-full sm:w-32 ${inputSmCls}`} />
          <button type="submit" className={btnPrimary}>
            Add site
          </button>
        </form>
        <p className="mt-2 text-xs text-neutral-400">
          Tip: right-click the spot on Google Maps → copy coordinates.
        </p>
      </div>

      <div className="mt-10">
        <SectionHeading title="Customer sites" count={customers.length} />
      </div>
      {customers.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            framed
            compact
            icon="pin"
            title="None yet"
            hint="The system will learn these automatically as trips deliver (stop-detection)."
          />
        </div>
      ) : (
        <p className="mt-2 text-sm text-neutral-400">{customers.length} sites</p>
      )}
    </div>
  );
}
