import { NextRequest, NextResponse } from "next/server";
import { cronSecret, runTick } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 25;

// Netlify 예약 함수(netlify/functions/crm-tick.mjs)가 5분마다 호출
export async function GET(req: NextRequest) {
  const secret = await cronSecret();
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const result = await runTick();
  return NextResponse.json(result);
}
