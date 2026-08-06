"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, Tooltip } from "react-leaflet";
import { divIcon } from "leaflet";
import "leaflet/dist/leaflet.css";

export interface VehiclePosition {
  vehicle_id: string | null;
  reg_no: string;
  lat: number;
  lng: number;
  speed_kmh: number | null;
  heading: number | null;
  ts: string;
  vehicle_status: string;
}

const COLOR: Record<string, string> = {
  on_trip: "#d97706", // amber — working
  available: "#15803d", // green — free
  maintenance: "#dc2626",
  inactive: "#737373",
};

/** Top-view truck SVG, drawn pointing north, rotated to the GPS heading. */
export function truckIcon(color: string, heading: number | null, moving: boolean) {
  const rot = heading ?? 0;
  return divIcon({
    className: "", // kill Leaflet's default white box
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<div style="transform: rotate(${rot}deg); width:30px; height:30px; display:flex; align-items:center; justify-content:center; filter: drop-shadow(0 1px 2px rgba(0,0,0,.4));">
      <svg width="14" height="26" viewBox="0 0 14 26">
        <rect x="1" y="9" width="12" height="16" rx="2" fill="${color}" stroke="#fff" stroke-width="1.4"/>
        <rect x="2" y="1" width="10" height="7" rx="2" fill="${color}" stroke="#fff" stroke-width="1.4"/>
        <rect x="3.4" y="2.4" width="7.2" height="2.6" rx="1" fill="#fff" opacity=".85"/>
      </svg>
    </div>${moving ? "" : ""}`,
  });
}

export function agoLabel(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

export default function LiveMapInner({ positions: initial }: { positions: VehiclePosition[] }) {
  const [positions, setPositions] = useState(initial);
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const [, forceTick] = useState(0);
  const failures = useRef(0);

  // Auto-refresh: new positions every 30s, badge ticks every second.
  useEffect(() => {
    const refresh = async () => {
      try {
        const res = await fetch("/api/fleet/positions");
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { positions: VehiclePosition[] };
        setPositions(json.positions);
        setFetchedAt(Date.now());
        failures.current = 0;
      } catch {
        failures.current += 1; // keep showing the last good data
      }
    };
    const poll = setInterval(refresh, 30_000);
    const tick = setInterval(() => forceTick((n) => n + 1), 1_000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  const icons = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof divIcon>>();
    return (p: VehiclePosition) => {
      const color = COLOR[p.vehicle_status] ?? "#2563eb";
      const rot = Math.round((p.heading ?? 0) / 10) * 10; // 36 rotations per color max
      const key = `${color}|${rot}`;
      if (!cache.has(key)) cache.set(key, truckIcon(color, rot, (p.speed_kmh ?? 0) > 3));
      return cache.get(key)!;
    };
  }, []);

  return (
    <div className="relative w-full">
      <MapContainer
        center={[27.2, 79.5]}
        zoom={6}
        className="h-[320px] w-full rounded-xl sm:h-[380px] lg:h-[420px]"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {positions.map((p) => (
          <Marker key={p.reg_no} position={[p.lat, p.lng]} icon={icons(p)}>
            <Tooltip>
              <div style={{ fontSize: 12 }}>
                <strong>{p.reg_no}</strong>
                <br />
                {p.vehicle_status.replace(/_/g, " ")} ·{" "}
                {p.speed_kmh !== null ? `${Math.round(p.speed_kmh)} km/h` : "—"}
                <br />
                {agoLabel(Date.now() - Date.parse(p.ts))}
              </div>
            </Tooltip>
            {p.vehicle_id && (
              <Popup>
                <div style={{ fontSize: 13 }}>
                  <strong>{p.reg_no}</strong> ·{" "}
                  {p.speed_kmh !== null ? `${Math.round(p.speed_kmh)} km/h` : "stopped"}
                  <br />
                  <a href={`/vehicles/${p.vehicle_id}`} style={{ fontWeight: 600 }}>
                    View full vehicle details →
                  </a>
                </div>
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>
      <div className="pointer-events-none absolute right-2.5 top-2.5 z-[1000] max-w-[calc(100%-1.25rem)] truncate rounded-full bg-neutral-900/80 px-3 py-1 text-xs font-medium text-white shadow">
        {failures.current > 0 ? "reconnecting…" : `Live · updated ${agoLabel(Date.now() - fetchedAt)}`}
      </div>
      <div className="pointer-events-none absolute bottom-2.5 left-2.5 z-[1000] flex max-w-[calc(100%-1.25rem)] flex-wrap gap-x-3 gap-y-0.5 rounded-lg bg-white/90 px-2.5 py-1.5 text-xs font-medium text-neutral-700 shadow sm:px-3">
        <span className="whitespace-nowrap"><span style={{ color: COLOR.available }}>■</span> free</span>
        <span className="whitespace-nowrap"><span style={{ color: COLOR.on_trip }}>■</span> on trip</span>
        <span className="whitespace-nowrap"><span style={{ color: COLOR.maintenance }}>■</span> maintenance</span>
      </div>
    </div>
  );
}
