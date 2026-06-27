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

  if (!process.env.ADMIN_PASSWORD) {
    return { error: "서버에 ADMIN_PASSWORD 환경변수가 설정되지 않았습니다." };
  }
  if (pw !== process.env.ADMIN_PASSWORD) {
    return { error: "비밀번호가 올바르지 않습니다." };
  }

  cookies().set(AUTH_COOKIE, await sessionToken(), COOKIE_OPTS);
  redirect(next);
}

export async function logout() {
  cookies().delete(AUTH_COOKIE);
  redirect("/login");
}
