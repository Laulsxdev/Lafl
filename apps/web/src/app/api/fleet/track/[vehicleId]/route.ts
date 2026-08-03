import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Latest fix + 50-point trail for one vehicle — vehicle-detail live map. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ vehicleId: string }> },
) {
  const db = await createSupabaseServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { vehicleId } = await params;
  const { data: fixes } = await db
    .from("gps_logs")
    .select("lat, lng, speed_kmh, heading, ts")
    .eq("vehicle_id", vehicleId)
    .order("ts", { ascending: false })
    .limit(50);

  const latest = fixes?.[0] ?? null;
  return NextResponse.json({
    latest,
    trail: (fixes ?? []).slice().reverse().map((f) => ({ lat: f.lat, lng: f.lng })),
  });
}
