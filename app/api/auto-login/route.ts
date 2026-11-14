import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, COOKIE_OPTS, signSession, verifySession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

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
  const nextRaw = params.get("next") ?? "/";
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";

  const expected = process.env.PORTAL_KEY || process.env.ADMIN_PASSWORD || "";

  const ip =
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null;
  const ua = req.headers.get("user-agent");
  // 포털에서 이름을 넘겨주면(&name=홍길동) 기록에 남김
  const name = (params.get("name") ?? "").trim().slice(0, 30) || null;

  if (!expected || key !== expected) {
    if (key) await logActivity("login_failed", { actor: name, detail: "포털 자동로그인 키 불일치", ip, ua });
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(next)}`, req.url)
    );
  }

  const res = NextResponse.redirect(new URL(next, req.url));
  // 이미 로그인된 상태(세움OS 계정 로그인 포함)로 포털을 다시 연 경우는 그대로 유지
  const existing = await verifySession(req.cookies.get(AUTH_COOKIE)?.value);
  if (existing) return res;
  res.cookies.set(AUTH_COOKIE, await signSession({ eid: null, name, email: null, role: "staff" }), COOKIE_OPTS);
  await logActivity("auto_login", { actor: name, role: "staff", ip, ua });
  return res;
}
