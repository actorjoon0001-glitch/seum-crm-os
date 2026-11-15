// 5분마다 고객관리OS 의 잔디 알림 실행기를 호출합니다. (Netlify Scheduled Function)
// - 새 방문예약 알림, 아침 브리핑(설정 시각), 로그인 실패 급증 경고
import { createHash } from "node:crypto";

export default async () => {
  const base = (process.env.APP_URL || process.env.URL || "").replace(/\/+$/, "");
  const key = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!base || !key) return new Response("missing URL or key", { status: 500 });
  const secret = createHash("sha256").update(`seum-cron::${key}`).digest("hex");
  const res = await fetch(`${base}/api/cron/tick`, { headers: { "x-cron-secret": secret } });
  return new Response(await res.text(), { status: res.status });
};

export const config = { schedule: "*/5 * * * *" };
