import Link from "next/link";
import { requireOrgStaff } from "@/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { rejectPodAction, verifyPodAction } from "../trips/actions";
import {
  EmptyState,
  PageHeader,
  SectionHeading,
  bannerError,
  bannerOk,
  btnDanger,
  btnSuccess,
  inputSmCls,
} from "@/components/ui";

export default async function PodQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  await requireOrgStaff();
  const { error, ok } = await searchParams;
  const db = await createSupabaseServerClient();

  const [{ data: pending }, { data: awaited }] = await Promise.all([
    db
      .from("pods")
      .select("id, trip_id, file_url, uploaded_at, eway_bills(ewb_no), trips(trip_no)")
      .eq("status", "uploaded")
      .order("uploaded_at"),
    db
      .from("trips")
      .select("id, trip_no, ops_closed_at, vehicles(reg_no)")
      .in("status", ["unloaded", "ops_closed"])
      .in("pod_status", ["awaited"])
      .order("ops_closed_at", { ascending: true, nullsFirst: false })
      .limit(30),
  ]);

  const admin = createSupabaseAdminClient();
  const urls = new Map<string, string>();
  for (const p of pending ?? []) {
    const { data } = await admin.storage.from("pods").createSignedUrl(p.file_url, 3600);
    if (data) urls.set(p.id, data.signedUrl);
  }

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="POD Verification Queue"
        subtitle="Review uploaded proof-of-delivery documents and chase missing ones."
      />
      {error && <p className={`mt-4 ${bannerError}`}>{error}</p>}
      {ok && <p className={`mt-4 ${bannerOk}`}>{ok}</p>}

      <div className="mt-8">
        <SectionHeading title="Waiting for verification" count={(pending ?? []).length} />
      </div>
      <div className="mt-3 space-y-2">
        {(pending ?? []).map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm shadow-xs">
            <div>
              <Link href={`/trips/${p.trip_id}`} className="font-semibold text-neutral-900 hover:underline">
                {p.trips?.trip_no}
              </Link>
              <span className="ml-2 text-neutral-500">
                {p.eway_bills?.ewb_no ? `EWB ${p.eway_bills.ewb_no}` : "whole trip"}
              </span>
              <a href={urls.get(p.id) ?? "#"} target="_blank" className="ml-3 font-medium text-neutral-900 underline underline-offset-2">
                Open document
              </a>
            </div>
            <div className="flex items-center gap-2">
              <form action={verifyPodAction}>
                <input type="hidden" name="tripId" value={p.trip_id} />
                <input type="hidden" name="podId" value={p.id} />
                <input type="hidden" name="back" value="/pods" />
                <button type="submit" className={`${btnSuccess} px-3 py-1.5 text-xs`}>
                  Verify
                </button>
              </form>
              <form action={rejectPodAction} className="flex items-center gap-1.5">
                <input type="hidden" name="tripId" value={p.trip_id} />
                <input type="hidden" name="podId" value={p.id} />
                <input type="hidden" name="back" value="/pods" />
                <input name="reason" placeholder="Reject reason" required className={`${inputSmCls} px-2 py-1 text-xs`} />
                <button type="submit" className={`${btnDanger} px-2.5 py-1 text-xs`}>
                  Reject
                </button>
              </form>
            </div>
          </div>
        ))}
        {(pending ?? []).length === 0 && (
          <EmptyState
            framed
            icon="check"
            title="Nothing waiting for verification"
            hint="New uploads will appear here as drivers submit PODs."
          />
        )}
      </div>

      <div className="mt-10">
        <SectionHeading title="Trips still missing POD" count={(awaited ?? []).length} />
      </div>
      <div className="mt-3 space-y-1.5">
        {(awaited ?? []).map((t) => (
          <Link
            key={t.id}
            href={`/trips/${t.id}`}
            className="flex justify-between rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm shadow-xs hover:border-neutral-300 hover:bg-neutral-50"
          >
            <span className="font-medium text-neutral-900">{t.trip_no} · {t.vehicles?.reg_no}</span>
            <span className="text-neutral-400">awaiting upload</span>
          </Link>
        ))}
        {(awaited ?? []).length === 0 && (
          <EmptyState
            framed
            compact
            icon="document"
            title="All delivered trips have PODs"
          />
        )}
      </div>
    </div>
  );
}
