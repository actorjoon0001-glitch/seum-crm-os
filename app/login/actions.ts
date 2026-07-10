"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, COOKIE_OPTS, sessionToken } from "@/lib/auth";

export interface LoginState {
  error?: string;
}

export async function login(
  _prev: LoginState | null,
  formData: FormData
): Promise<LoginState> {
  const pw = String(formData.get("password") ?? "");
  const nextRaw = String(formData.get("next") ?? "/admin");
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/admin";
  // "자동 로그인" 체크박스. 켜져 있으면 30일 유지, 꺼져 있으면 브라우저 종료 시 로그아웃.
  const remember = formData.get("remember") != null;

  if (!process.env.ADMIN_PASSWORD) {
    return { error: "서버에 ADMIN_PASSWORD 환경변수가 설정되지 않았습니다." };
  }
  if (pw !== process.env.ADMIN_PASSWORD) {
    return { error: "비밀번호가 올바르지 않습니다." };
  }

  const opts = remember ? COOKIE_OPTS : { ...COOKIE_OPTS, maxAge: undefined };
  cookies().set(AUTH_COOKIE, await sessionToken(), opts);
  redirect(next);
}

export async function logout() {
  cookies().delete(AUTH_COOKIE);
  redirect("/login");
}
