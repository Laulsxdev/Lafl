"use client";

import dynamic from "next/dynamic";
import type { VehiclePosition } from "./live-map-inner";

// Leaflet touches `window` at import time — client-only, no SSR.
const LiveMapInner = dynamic(() => import("./live-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] w-full items-center justify-center rounded-xl bg-neutral-100 text-sm text-neutral-400">
      Loading map…
    </div>
  ),
});

export default function LiveMap({ positions }: { positions: VehiclePosition[] }) {
  return <LiveMapInner positions={positions} />;
}
