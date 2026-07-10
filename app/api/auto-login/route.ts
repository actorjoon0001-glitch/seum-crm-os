import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, COOKIE_OPTS, sessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 포털(seum-platform)에 iframe 으로 임베드할 때, 비밀번호 입력 화면 없이
// 자동으로 로그인시키기 위한 진입점.
//
//   <iframe src="https://<crm-도메인>/api/auto-login?key=<PORTAL_KEY>&next=/admin">
//
// key 가 맞으면 세션 쿠키를 설정하고 next 경로로 이동합니다.
// key 가 없거나 틀리면 일반 로그인 페이지로 보냅니다.
// 자동로그인 키는 PORTAL_KEY 환경변수로 지정하며, 없으면 ADMIN_PASSWORD 로 대체합니다.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const key = params.get("key") ?? "";
  const nextRaw = params.get("next") ?? "/admin";
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/admin";

  const expected = process.env.PORTAL_KEY || process.env.ADMIN_PASSWORD || "";

  if (!expected || key !== expected) {
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(next)}`, req.url)
    );
  }

  const res = NextResponse.redirect(new URL(next, req.url));
  res.cookies.set(AUTH_COOKIE, await sessionToken(), COOKIE_OPTS);
  return res;
}
