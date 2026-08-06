import { notFound } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { formatInr, formatWeightMt } from "@lafl/core";
import { requireOrgStaff } from "@/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import PrintButton from "@/components/print-button";
import { TableScroll } from "@/components/ui";

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default async function TripSheetPrintPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const profile = await requireOrgStaff();
  const { tripId } = await params;
  const db = await createSupabaseServerClient();

  const { data: trip } = await db
    .from("trips")
    .select("*, vehicles(reg_no, vehicle_type), routes(origin_city, dest_city, distance_km)")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) notFound();

  const [{ data: org }, { data: ewbs }, { data: crew }, { data: charges }] =
    await Promise.all([
      db.from("organizations").select("name").eq("id", profile.org_id).single(),
      db
        .from("trip_eway_bills")
        .select(
          "eway_bills(ewb_no, consignor_name, consignee_name, origin, destination, material, weight_kg, invoice_no, valid_until)",
        )
        .eq("trip_id", tripId),
      db
        .from("trip_drivers")
        .select("role, released_at, drivers(name, phone, license_no)")
        .eq("trip_id", tripId)
        .order("assigned_at"),
      db.from("trip_charges").select("charge_type, approved_amount").eq("trip_id", tripId),
    ]);

  const activeCrew = (crew ?? []).filter((c) => !c.released_at);
  const totalCharges = (charges ?? []).reduce((s, c) => s + c.approved_amount, 0);

  // POD upload QR — base URL comes from the request host, so localhost prints
  // localhost links and production prints production links with zero config.
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const podUrl = `${proto}://${host}/pod/${trip.pod_token}`;
  const podQr = await QRCode.toDataURL(podUrl, { width: 240, margin: 1 });

  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-8 print:p-0">
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <div className="w-full max-w-full rounded-xl border border-neutral-300 bg-white p-4 sm:p-10 print:rounded-none print:border-0 print:p-2">
        <div className="flex flex-col gap-3 border-b-2 border-neutral-900 pb-5 sm:flex-row sm:items-start sm:justify-between print:flex-row print:items-start print:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight">{org?.name ?? "—"}</h1>
            <p className="mt-0.5 text-sm text-neutral-600">Trip Sheet / Challan</p>
          </div>
          <div className="text-sm sm:text-right print:text-right">
            <div className="text-lg font-bold break-words">{trip.trip_no}</div>
            <div className="capitalize text-neutral-500">{trip.status.replace(/_/g, " ")}</div>
          </div>
        </div>

        {/* Vehicle & crew */}
        <div className="mt-5 grid grid-cols-1 gap-6 text-sm sm:grid-cols-2 print:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Vehicle & Route</div>
            <div className="mt-1 space-y-0.5 text-neutral-700">
              <div>Vehicle: <strong>{trip.vehicles?.reg_no}</strong> ({trip.vehicles?.vehicle_type})</div>
              {trip.routes && (
                <div>
                  {trip.routes.origin_city} → {trip.routes.dest_city}
                  {trip.routes.distance_km ? ` · ${trip.routes.distance_km} km` : ""}
                </div>
              )}
              {trip.total_weight_kg && <div>Total load: <strong>{formatWeightMt(trip.total_weight_kg)}</strong></div>}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Crew</div>
            <div className="mt-1 space-y-0.5 text-neutral-700">
              {activeCrew.map((c, i) => (
                <div key={i}>
                  {c.drivers?.name} · {c.drivers?.phone}
                  {c.drivers?.license_no ? ` · DL ${c.drivers.license_no}` : ""}{" "}
                  <span className="text-neutral-400">({c.role})</span>
                </div>
              ))}
              {activeCrew.length === 0 && <div className="text-neutral-400">Not assigned</div>}
            </div>
          </div>
        </div>

        {/* Consignments */}
        <div className="mt-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Consignments</div>
          <TableScroll className="mt-1 print:overflow-visible">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-neutral-300 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  <th className="py-2">E-Way Bill</th>
                  <th className="py-2">Consignor → Consignee</th>
                  <th className="py-2">Material</th>
                  <th className="py-2 text-right">Weight</th>
                  <th className="py-2 text-right">Valid till</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {(ewbs ?? []).map((l, i) => (
                  <tr key={i}>
                    <td className="py-2 font-mono text-xs font-semibold break-words">{l.eway_bills?.ewb_no}</td>
                    <td className="py-2 break-words">
                      {l.eway_bills?.consignor_name ?? "—"} → {l.eway_bills?.consignee_name ?? "—"}
                    </td>
                    <td className="py-2 break-words">{l.eway_bills?.material ?? "—"}</td>
                    <td className="py-2 text-right tabular-nums">
                      {l.eway_bills?.weight_kg ? formatWeightMt(l.eway_bills.weight_kg) : "—"}
                    </td>
                    <td className="py-2 text-right text-xs">{fmt(l.eway_bills?.valid_until ?? null)}</td>
                  </tr>
                ))}
                {(ewbs ?? []).length === 0 && (
                  <tr><td colSpan={5} className="py-3 text-center text-neutral-400">No consignments attached</td></tr>
                )}
              </tbody>
            </table>
          </TableScroll>
        </div>

        {/* POD upload QR */}
        <div className="mt-6 flex flex-col items-start gap-4 rounded-lg border-2 border-dashed border-neutral-300 p-4 sm:flex-row sm:items-center sm:gap-5 print:flex-row print:items-center print:gap-5 print:break-inside-avoid">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={podQr} alt="POD upload QR code" className="h-28 w-28 shrink-0" />
          <div className="text-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              POD Upload — scan after unloading
            </div>
            <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 text-neutral-700">
              <li>Unload &amp; get the bilty signed and stamped</li>
              <li>Scan this code with the phone camera</li>
              <li>Take a clear photo of the signed bilty &amp; upload</li>
            </ol>
            <div className="mt-1.5 text-xs text-neutral-400">
              No app, no login. Or send the photo to the supervisor on WhatsApp as usual.
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-1 text-sm sm:grid-cols-2 md:grid-cols-3 print:grid-cols-3">
          {[
            ["Planned start", trip.planned_start],
            ["ETA", trip.eta],
            ["Actual start", trip.actual_start],
            ["Arrived", trip.arrived_at],
            ["Unloaded", trip.unloaded_at],
            ["Ops closed", trip.ops_closed_at],
          ].map(([label, v]) => (
            <div key={label as string} className="flex justify-between border-b border-dotted border-neutral-200 py-1">
              <span className="text-neutral-500">{label}</span>
              <span className="font-medium">{fmt(v as string | null)}</span>
            </div>
          ))}
        </div>

        {/* Charges */}
        {(charges ?? []).length > 0 && (
          <div className="mt-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Approved charges</div>
            <TableScroll className="mt-1 print:overflow-visible">
              <table className="w-full min-w-[280px] text-sm">
                <tbody className="divide-y divide-neutral-100">
                  {(charges ?? []).map((c, i) => (
                    <tr key={i}>
                      <td className="py-1.5 capitalize">{c.charge_type.replace(/_/g, " ")}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatInr(c.approved_amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-neutral-900 font-bold">
                    <td className="py-2">Total</td>
                    <td className="py-2 text-right tabular-nums">{formatInr(totalCharges)}</td>
                  </tr>
                </tfoot>
              </table>
            </TableScroll>
          </div>
        )}

        {trip.notes && (
          <p className="mt-5 rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-600 print:bg-white print:px-0">
            <strong>Notes:</strong> {trip.notes}
          </p>
        )}

        <div className="mt-12 grid grid-cols-1 gap-8 text-xs text-neutral-500 sm:grid-cols-2 print:grid-cols-2">
          <div><div className="border-t border-neutral-400 pt-1.5">Driver signature</div></div>
          <div className="sm:text-right print:text-right">
            <div className="border-t border-neutral-400 pt-1.5">Supervisor · {org?.name}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
