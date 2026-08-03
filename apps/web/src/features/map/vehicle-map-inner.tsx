"use client";

import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export interface TrailPoint {
  lat: number;
  lng: number;
}

export default function VehicleMapInner({
  lat,
  lng,
  label,
  trail,
}: {
  lat: number;
  lng: number;
  label: string;
  trail: TrailPoint[];
}) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={10}
      style={{ height: 320, width: "100%", borderRadius: 12 }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {trail.length > 1 && (
        <Polyline
          positions={trail.map((p) => [p.lat, p.lng] as [number, number])}
          pathOptions={{ color: "#2563eb", weight: 3, opacity: 0.6, dashArray: "6 6" }}
        />
      )}
      <CircleMarker
        center={[lat, lng]}
        radius={9}
        pathOptions={{ color: "#fff", weight: 2, fillColor: "#d97706", fillOpacity: 1 }}
      >
        <Tooltip permanent direction="top" offset={[0, -8]}>
          <strong>{label}</strong>
        </Tooltip>
      </CircleMarker>
    </MapContainer>
  );
}
