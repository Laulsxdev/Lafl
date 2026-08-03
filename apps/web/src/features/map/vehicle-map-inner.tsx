"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { agoLabel, truckIcon } from "./live-map-inner";

export interface TrailPoint {
  lat: number;
  lng: number;
}

interface Latest {
  lat: number;
  lng: number;
  speed_kmh: number | null;
  heading: number | null;
  ts: string;
}

export default function VehicleMapInner({
  lat,
  lng,
  label,
  trail: initialTrail,
  vehicleId,
}: {
  lat: number;
  lng: number;
  label: string;
  trail: TrailPoint[];
  vehicleId?: string;
}) {
  const [shown, setShown] = useState<TrailPoint>({ lat, lng }); // animated marker position
  const [latest, setLatest] = useState<Latest>({ lat, lng, speed_kmh: null, heading: null, ts: new Date().toISOString() });
  const [trail, setTrail] = useState(initialTrail);
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const [, forceTick] = useState(0);
  const animRef = useRef<number | null>(null);

  // Glide the marker from its old position to the new fix over ~2s.
  const animateTo = (to: TrailPoint) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const start = performance.now();
    const dur = 2000;
    setShown((from) => {
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        const ease = t * (2 - t); // easeOutQuad
        setShown({
          lat: from.lat + (to.lat - from.lat) * ease,
          lng: from.lng + (to.lng - from.lng) * ease,
        });
        if (t < 1) animRef.current = requestAnimationFrame(step);
      };
      animRef.current = requestAnimationFrame(step);
      return from;
    });
  };

  useEffect(() => {
    if (!vehicleId) return;
    const refresh = async () => {
      try {
        const res = await fetch(`/api/fleet/track/${vehicleId}`);
        if (!res.ok) return;
        const json = (await res.json()) as { latest: Latest | null; trail: TrailPoint[] };
        if (!json.latest) return;
        setLatest(json.latest);
        setTrail(json.trail);
        setFetchedAt(Date.now());
        animateTo({ lat: json.latest.lat, lng: json.latest.lng });
      } catch {
        // keep last good data
      }
    };
    const poll = setInterval(refresh, 30_000);
    const tick = setInterval(() => forceTick((n) => n + 1), 1_000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [vehicleId]);

  const moving = (latest.speed_kmh ?? 0) > 3;

  return (
    <div className="relative">
      <MapContainer
        center={[lat, lng]}
        zoom={10}
        style={{ height: 320, width: "100%", borderRadius: 12 }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {trail.length > 1 && (
          <Polyline
            positions={trail.map((p) => [p.lat, p.lng] as [number, number])}
            pathOptions={{ color: "#2563eb", weight: 3, opacity: 0.6, dashArray: "6 6" }}
          />
        )}
        <Marker
          position={[shown.lat, shown.lng]}
          icon={truckIcon("#d97706", latest.heading, moving)}
        >
          <Tooltip permanent direction="top" offset={[0, -14]}>
            <strong>{label}</strong>
            {latest.speed_kmh !== null ? ` · ${Math.round(latest.speed_kmh)} km/h` : ""}
          </Tooltip>
        </Marker>
      </MapContainer>
      {vehicleId && (
        <div className="pointer-events-none absolute right-2.5 top-2.5 z-[1000] rounded-full bg-neutral-900/80 px-3 py-1 text-xs font-medium text-white shadow">
          Live · updated {agoLabel(Date.now() - fetchedAt)}
        </div>
      )}
    </div>
  );
}
