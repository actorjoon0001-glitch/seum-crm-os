import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, sessionToken } from "@/lib/auth";

// 보호 대상: 홈(/) 과 모든 /admin 경로. 로그인하지 않으면 /login 으로 보냄.
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const expected = await sessionToken();
  const authed = Boolean(process.env.ADMIN_PASSWORD) && token === expected;

  if (!authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/admin/:path*"],
};
