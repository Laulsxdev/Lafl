"use client";

import dynamic from "next/dynamic";
import type { TrailPoint } from "./vehicle-map-inner";

const VehicleMapInner = dynamic(() => import("./vehicle-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[320px] w-full items-center justify-center rounded-xl bg-neutral-100 text-sm text-neutral-400">
      Loading map…
    </div>
  ),
});

export default function VehicleMap(props: {
  lat: number;
  lng: number;
  label: string;
  trail: TrailPoint[];
  vehicleId?: string;
}) {
  return <VehicleMapInner {...props} />;
}
