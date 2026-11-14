"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { AUTH_COOKIE, COOKIE_OPTS, isOwnerEmployee, signSession } from "@/lib/auth";
import { createServiceClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { getSession } from "@/lib/require-auth";
import { logActivity } from "@/lib/activity";

export interface LoginState {
  error?: string;
}

// 세움OS 계정(이메일 · 비밀번호)으로 로그인 → 승인된 직원만 허용
export async function login(_prev: LoginState | null, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const pw = String(formData.get("password") ?? "");
  const nextRaw = String(formData.get("next") ?? "/");
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";
  // "자동 로그인" 체크박스. 켜져 있으면 30일 유지, 꺼져 있으면 브라우저 종료 시 로그아웃.
  const remember = formData.get("remember") != null;

  if (!email || !pw) return { error: "이메일과 비밀번호를 입력해 주세요." };
  if (!hasSupabaseEnv()) return { error: "서버에 Supabase 환경변수가 설정되지 않았습니다." };

  // Supabase Auth 로 비밀번호 확인 (세션은 서버에 저장하지 않음)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const authClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authErr } = await authClient.auth.signInWithPassword({ email, password: pw });
  if (authErr || !auth.user) {
    await logActivity("login_failed", { actor: email, detail: authErr?.message === "Invalid login credentials" ? "이메일 또는 비밀번호 틀림" : authErr?.message ?? "로그인 실패" });
    return {
      error:
        authErr?.message === "Invalid login credentials"
          ? "이메일 또는 비밀번호가 올바르지 않습니다."
          : authErr?.message === "Email not confirmed"
            ? "이메일 인증이 완료되지 않은 계정입니다."
            : "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }

  // 세움OS 직원 정보 확인 (auth_user_id → 없으면 이메일)
  const db = createServiceClient();
  let { data: emp } = await db.from("employees").select("*").eq("auth_user_id", auth.user.id).maybeSingle();
  if (!emp) ({ data: emp } = await db.from("employees").select("*").ilike("email", email).limit(1).maybeSingle());

  if (!emp) {
    await logActivity("login_failed", { actor: email, detail: "세움OS 직원 정보 없음" });
    return { error: "세움OS 직원 정보가 없습니다. 세움OS에서 가입 후 관리자 승인을 받아 주세요." };
  }
  if (emp.status && emp.status !== "approved") {
    await logActivity("login_failed", { actor: emp.name ?? email, detail: `승인되지 않은 계정 (${emp.status})` });
    return { error: "승인되지 않은 계정입니다. 세움OS 관리자에게 승인을 요청해 주세요." };
  }

  const role = isOwnerEmployee({ ...emp, email: emp.email ?? auth.user.email }) ? "owner" : "staff";
  const maxAge = remember ? COOKIE_OPTS.maxAge : 60 * 60 * 12;
  const token = await signSession(
    { eid: String(emp.id), name: emp.name ?? email, email: auth.user.email ?? email, role },
    maxAge
  );
  cookies().set(AUTH_COOKIE, token, remember ? COOKIE_OPTS : { ...COOKIE_OPTS, maxAge: undefined });
  await logActivity("login", { actor: emp.name ?? email, role, detail: `${auth.user.email ?? email}${remember ? " · 자동 로그인 유지" : ""}` });
  redirect(next);
}

export async function logout() {
  const s = await getSession();
  if (s) await logActivity("logout", { actor: s.name, role: s.role });
  cookies().delete(AUTH_COOKIE);
  redirect("/login");
}
