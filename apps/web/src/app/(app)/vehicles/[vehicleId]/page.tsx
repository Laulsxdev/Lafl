import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgStaff } from "@/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getLiveVehicleSnapshot } from "@/server/services/intangles.service";
import VehicleMap from "@/features/map/vehicle-map";
import { STATUS_PILL, statusLabel } from "@/features/status";
import { EmptyState, cardCls, pillCls, tdCls, thCls } from "@/components/ui";

const fmt = (d: string | number | null | undefined) =>
  d
    ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "—";

const HEALTH_PILL: Record<string, string> = {
  GOOD: "bg-green-100 text-green-800",
  MINOR: "bg-amber-100 text-amber-800",
  MAJOR: "bg-red-100 text-red-800",
};

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ vehicleId: string }>;
}) {
  const profile = await requireOrgStaff();
  const { vehicleId } = await params;
  const db = await createSupabaseServerClient();

  const { data: vehicle } = await db
    .from("vehicles")
    .select("*")
    .eq("id", vehicleId)
    .maybeSingle();
  if (!vehicle) notFound();

  const [{ data: trail }, { data: trips }, live] = await Promise.all([
    db
      .from("gps_logs")
      .select("lat, lng, ts, speed_kmh")
      .eq("vehicle_id", vehicleId)
      .order("ts", { ascending: false })
      .limit(50),
    db
      .from("trips")
      .select("id, trip_no, status, created_at, eta, routes(origin_city, dest_city)")
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false })
      .limit(10),
    getLiveVehicleSnapshot(profile.org_id, vehicle.reg_no),
  ]);

  const lastFix = trail?.[0];
  const pos = live?.lat != null && live?.lng != null
    ? { lat: live.lat, lng: live.lng, ts: live.fixTime, speed: live.speedKmh }
    : lastFix
      ? { lat: lastFix.lat, lng: lastFix.lng, ts: lastFix.ts, speed: lastFix.speed_kmh }
      : null;
  const liveTrip = (trips ?? []).find((t) =>
    ["ready", "in_transit", "at_destination", "unloaded"].includes(t.status),
  );

  const stat = (label: string, value: React.ReactNode) => (
    <div className={`p-4 ${cardCls}`}>
      <div className="text-xs font-medium text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-neutral-900">{value}</div>
    </div>
  );

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/vehicles" className="text-sm text-neutral-400 hover:text-neutral-700">
          ← Vehicles
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{vehicle.reg_no}</h1>
        <span className={`${pillCls} bg-neutral-100 px-3 py-1 text-neutral-700`}>
          {vehicle.vehicle_type} · {vehicle.ownership} · {statusLabel(vehicle.status)}
        </span>
        {live?.health && (
          <span className={`${pillCls} px-3 py-1 ${HEALTH_PILL[live.health] ?? "bg-neutral-100 text-neutral-600"}`}>
            Engine: {live.health}
          </span>
        )}
        {live && (
          <span className={`${pillCls} px-3 py-1 ${live.connected ? "bg-green-50 text-green-700" : "bg-neutral-100 text-neutral-500"}`}>
            {live.connected ? "● GPS Connected" : "○ GPS Offline"}
          </span>
        )}
      </div>

      {/* live stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
        {stat("Speed", pos?.speed != null ? `${Math.round(Number(pos.speed))} km/h` : "—")}
        {stat("State", live?.state ? statusLabel(live.state.toLowerCase()) : "—")}
        {stat("Fuel", live?.fuelLitres != null ? `${Math.round(live.fuelLitres)} L` : "—")}
        {stat("AdBlue", live?.adbluePct != null ? `${live.adbluePct}%` : "—")}
        {stat("Odometer", live?.odoKm != null ? `${live.odoKm.toLocaleString("en-IN")} km` : "—")}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900">Location & recent trail</h2>
            <span className="text-xs text-neutral-400">
              last fix: {fmt(pos?.ts ?? null)}
            </span>
          </div>
          {pos ? (
            <div className="overflow-hidden rounded-xl border border-neutral-200 shadow-xs">
              <VehicleMap
                lat={pos.lat}
                lng={pos.lng}
                label={vehicle.reg_no}
                trail={(trail ?? []).map((t) => ({ lat: t.lat, lng: t.lng })).reverse()}
                vehicleId={vehicle.id}
              />
            </div>
          ) : (
            <div className="flex h-[320px] items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white">
              <EmptyState
                icon="pin"
                title="No GPS data for this truck yet"
                hint="Run the poller or check the device."
              />
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">Details</h2>
          <div className={`p-4 text-sm ${cardCls}`}>
            <dl className="space-y-2">
              {[
                ["GPS Device", vehicle.gps_device_id ? "Intangles ✓" : "—"],
                ["Insurance expiry", vehicle.insurance_expiry ?? "— (to be filled)"],
                ["Permit expiry", vehicle.permit_expiry ?? "— (to be filled)"],
                ["Fitness expiry", vehicle.fitness_expiry ?? "—"],
                ["Capacity", vehicle.capacity_kg ? `${vehicle.capacity_kg} kg` : "—"],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-2">
                  <dt className="text-neutral-500">{k}</dt>
                  <dd className="text-right font-medium text-neutral-900">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {liveTrip && (
            <Link
              href={`/trips/${liveTrip.id}`}
              className="mt-3 block rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm shadow-xs hover:bg-amber-100"
            >
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">Live trip</div>
              <div className="mt-1 font-semibold text-neutral-900">{liveTrip.trip_no}</div>
              <div className="text-neutral-600">
                {liveTrip.routes ? `${liveTrip.routes.origin_city} → ${liveTrip.routes.dest_city}` : ""}
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* trip history */}
      <h2 className="mt-10 text-sm font-semibold text-neutral-900">Trip history</h2>
      <div className={`mt-3 overflow-hidden ${cardCls}`}>
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-100 bg-neutral-50/80">
            <tr>
              <th className={thCls}>Trip</th>
              <th className={thCls}>Route</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {(trips ?? []).map((t) => (
              <tr key={t.id} className="hover:bg-neutral-50">
                <td className={`${tdCls} font-medium text-neutral-900`}>
                  <Link href={`/trips/${t.id}`} className="hover:underline">
                    {t.trip_no}
                  </Link>
                </td>
                <td className={`${tdCls} text-neutral-600`}>
                  {t.routes ? `${t.routes.origin_city} → ${t.routes.dest_city}` : "—"}
                </td>
                <td className={tdCls}>
                  <span className={`${pillCls} ${STATUS_PILL[t.status] ?? "bg-neutral-100 text-neutral-600"}`}>
                    {statusLabel(t.status)}
                  </span>
                </td>
                <td className={`${tdCls} text-neutral-400`}>{fmt(t.created_at)}</td>
              </tr>
            ))}
            {(trips ?? []).length === 0 && (
              <tr>
                <td colSpan={4}>
                  <EmptyState icon="truck" title="No trips on this truck yet" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
