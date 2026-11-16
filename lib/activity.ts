// 로그인 · 삭제 등 활동 기록 (crm_activity_logs). 테이블이 없으면 조용히 건너뜀.
import { headers } from "next/headers";
import { createServiceClient, hasSupabaseEnv } from "@/lib/supabase/server";

export const ACTIVITY_TABLE = "crm_activity_logs";

export type ActivityKind = "login" | "login_failed" | "auto_login" | "logout" | "delete" | "permission";

export const ACTIVITY_LABEL: Record<string, { label: string; color: string }> = {
  login: { label: "로그인", color: "bg-emerald-100 text-emerald-700" },
  auto_login: { label: "포털 자동로그인", color: "bg-sky-100 text-sky-700" },
  login_failed: { label: "로그인 실패", color: "bg-red-100 text-red-700" },
  logout: { label: "로그아웃", color: "bg-gray-100 text-gray-600" },
  delete: { label: "삭제", color: "bg-orange-100 text-orange-700" },
  permission: { label: "권한 변경", color: "bg-indigo-100 text-indigo-700" },
};

export function clientInfo(): { ip: string | null; ua: string | null } {
  try {
    const h = headers();
    const ip =
      h.get("x-nf-client-connection-ip") ||
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      null;
    return { ip, ua: h.get("user-agent") };
  } catch {
    return { ip: null, ua: null };
  }
}

export async function logActivity(
  kind: ActivityKind,
  opts: { actor?: string | null; role?: string | null; detail?: string | null; ip?: string | null; ua?: string | null } = {}
) {
  if (!hasSupabaseEnv()) return;
  try {
    const info = opts.ip !== undefined || opts.ua !== undefined ? { ip: opts.ip ?? null, ua: opts.ua ?? null } : clientInfo();
    await createServiceClient()
      .from(ACTIVITY_TABLE)
      .insert({
        kind,
        actor: opts.actor ?? null,
        role: opts.role ?? null,
        detail: opts.detail ?? null,
        ip: info.ip,
        user_agent: info.ua?.slice(0, 300) ?? null,
      });
  } catch {
    /* 기록 실패는 무시 (본 기능에 영향 없음) */
  }
}
