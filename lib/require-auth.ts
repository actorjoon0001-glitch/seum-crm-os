// 서버 컴포넌트 · 서버 액션 · 라우트 핸들러 공용 인증 검사.
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, isOwnerEmployee, verifySession, type Role, type Session } from "@/lib/auth";
import { createServiceClient, hasSupabaseEnv } from "@/lib/supabase/server";

export type { Role };

// 요청마다 1번만: 쿠키 서명 확인 + 세움OS에서 아직 승인된 직원인지 다시 확인
// (퇴사 · 차단 처리하면 고객관리OS도 즉시 접근 불가, 권한 변경도 바로 반영)
export const getSession = cache(async (): Promise<Session | null> => {
  const s = await verifySession(cookies().get(AUTH_COOKIE)?.value);
  if (!s) return null;
  if (!s.eid || !hasSupabaseEnv()) return s;
  try {
    const { data, error } = await createServiceClient()
      .from("employees")
      .select("*")
      .eq("id", s.eid)
      .maybeSingle();
    if (error) return s; // 조회 실패 시에는 기존 세션 유지
    if (!data || (data.status && data.status !== "approved")) return null;
    return { ...s, name: data.name ?? s.name, role: isOwnerEmployee({ ...data, email: data.email ?? s.email }) ? "owner" : "staff" };
  } catch {
    return s;
  }
});

export async function currentRole(): Promise<Role | null> {
  return (await getSession())?.role ?? null;
}

export async function isAuthed(): Promise<boolean> {
  return (await getSession()) !== null;
}

export async function isOwner(): Promise<boolean> {
  return (await currentRole()) === "owner";
}

export async function currentUserName(): Promise<string | null> {
  return (await getSession())?.name ?? null;
}

// 인증되지 않았으면 로그인 페이지로 보냅니다. (로그인 후 next 로 복귀)
export async function requireAuth(next: string): Promise<void> {
  if (!(await isAuthed())) redirect(`/login?next=${encodeURIComponent(next)}`);
}

// 관리자 전용 화면: 관리자가 아니면 홈으로
export async function requireOwner(next: string): Promise<void> {
  const role = await currentRole();
  if (!role) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (role !== "owner") redirect("/");
}
