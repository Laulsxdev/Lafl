import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Live fleet positions for the dashboard map's auto-refresh (RLS-scoped). */
export async function GET() {
  const db = await createSupabaseServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await db
    .from("vehicle_latest_positions")
    .select("vehicle_id, reg_no, lat, lng, speed_kmh, heading, ts, vehicle_status")
    .order("ts", { ascending: false })
    .limit(300);

  return NextResponse.json({ positions: data ?? [] });
}
