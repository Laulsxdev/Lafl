import Link from "next/link";
import ActionForm from "@/components/action-form";
import { requireOrgStaff } from "@/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { rejectPodAction, uploadPodAction, verifyPodAction } from "../trips/actions";
import {
  EmptyState,
  PageHeader,
  SectionHeading,
  bannerError,
  bannerOk,
  btnDanger,
  btnGhost,
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
      .select("id, trip_no, status, ops_closed_at, vehicles(reg_no)")
      .in("status", ["at_destination", "unloaded", "ops_closed"])
      .in("pod_status", ["awaited"])
      .order("ops_closed_at", { ascending: true, nullsFirst: false })
      .limit(30),
  ]);

  // EWB options for the inline upload forms (one query for all listed trips)
  const awaitedIds = (awaited ?? []).map((t) => t.id);
  const { data: awaitedEwbs } = awaitedIds.length
    ? await db
        .from("trip_eway_bills")
        .select("trip_id, eway_bills(id, ewb_no)")
        .in("trip_id", awaitedIds)
    : { data: [] as never[] };
  const ewbsByTrip = new Map<string, { id: string; ewb_no: string }[]>();
  for (const l of awaitedEwbs ?? []) {
    if (!l.eway_bills) continue;
    const list = ewbsByTrip.get(l.trip_id) ?? [];
    list.push({ id: l.eway_bills.id, ewb_no: l.eway_bills.ewb_no });
    ewbsByTrip.set(l.trip_id, list);
  }

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
            <div className="min-w-0">
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
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <ActionForm action={verifyPodAction}>
                <input type="hidden" name="tripId" value={p.trip_id} />
                <input type="hidden" name="podId" value={p.id} />
                <button type="submit" className={`${btnSuccess} w-full px-3 py-1.5 text-xs sm:w-auto`}>
                  Verify
                </button>
              </ActionForm>
              <ActionForm
                action={rejectPodAction}
                resetOnOk
                className="flex w-full flex-col gap-1.5 sm:w-auto sm:flex-row sm:items-center"
              >
                <input type="hidden" name="tripId" value={p.trip_id} />
                <input type="hidden" name="podId" value={p.id} />
                <input
                  name="reason"
                  placeholder="Reject reason"
                  required
                  className={`${inputSmCls} w-full min-w-0 px-2 py-1 text-xs sm:w-40`}
                />
                <button type="submit" className={`${btnDanger} w-full px-2.5 py-1 text-xs sm:w-auto`}>
                  Reject
                </button>
              </ActionForm>
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
      <p className="mt-1 text-xs text-neutral-400">
        Got the photo on WhatsApp? Upload it right here — it lands on the trip and joins
        the verification queue above.
      </p>
      <div className="mt-3 space-y-1.5">
        {(awaited ?? []).map((t) => (
          <div
            key={t.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm shadow-xs"
          >
            <div className="min-w-0">
              <Link href={`/trips/${t.id}`} className="font-medium text-neutral-900 hover:underline">
                {t.trip_no} · {t.vehicles?.reg_no}
              </Link>
              <span className="ml-2 text-xs capitalize text-neutral-400">
                {t.status.replace(/_/g, " ")}
              </span>
            </div>
            <ActionForm
              action={uploadPodAction}
              resetOnOk
              className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center"
            >
              <input type="hidden" name="tripId" value={t.id} />
              <input
                name="file"
                type="file"
                required
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="w-full min-w-0 max-w-full text-xs sm:w-52"
              />
              <select name="ewbId" className={`${inputSmCls} w-full px-2 py-1 text-xs sm:w-auto`}>
                <option value="">Whole trip</option>
                {(ewbsByTrip.get(t.id) ?? []).map((e) => (
                  <option key={e.id} value={e.id}>
                    EWB {e.ewb_no}
                  </option>
                ))}
              </select>
              <button type="submit" className={`${btnGhost} w-full px-3 py-1.5 text-xs sm:w-auto`}>
                Upload
              </button>
            </ActionForm>
          </div>
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
