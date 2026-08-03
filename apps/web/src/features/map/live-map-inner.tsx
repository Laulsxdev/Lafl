"use client";

import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export interface VehiclePosition {
  vehicle_id: string | null;
  reg_no: string;
  lat: number;
  lng: number;
  speed_kmh: number | null;
  ts: string;
  vehicle_status: string;
}

const COLOR: Record<string, string> = {
  on_trip: "#d97706", // amber — working
  available: "#15803d", // green — free
  maintenance: "#dc2626",
  inactive: "#737373",
};

export default function LiveMapInner({ positions }: { positions: VehiclePosition[] }) {
  return (
    <MapContainer
      center={[27.2, 79.5]}
      zoom={6}
      style={{ height: 420, width: "100%", borderRadius: 12 }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {positions.map((p) => (
        <CircleMarker
          key={p.reg_no}
          center={[p.lat, p.lng]}
          radius={7}
          pathOptions={{
            color: "#ffffff",
            weight: 1.5,
            fillColor: COLOR[p.vehicle_status] ?? "#2563eb",
            fillOpacity: 0.95,
          }}
        >
          <Tooltip>
            <div style={{ fontSize: 12 }}>
              <strong>{p.reg_no}</strong>
              <br />
              {p.vehicle_status.replace(/_/g, " ")} ·{" "}
              {p.speed_kmh !== null ? `${Math.round(p.speed_kmh)} km/h` : "—"}
              <br />
              {new Date(p.ts).toLocaleString("en-IN", {
                dateStyle: "short",
                timeStyle: "short",
              })}
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
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
