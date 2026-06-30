// 단일 관리자 비밀번호 인증.
// 비밀번호는 환경변수 ADMIN_PASSWORD 에 보관하고, 세션 쿠키에는
// 비밀번호 자체가 아니라 해시 토큰만 저장합니다.
// (미들웨어=Edge, 서버액션=Node 모두에서 Web Crypto 사용)

export const AUTH_COOKIE = "seum_auth";

export const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30일
};

export async function sessionToken(): Promise<string> {
  const secret = process.env.ADMIN_PASSWORD ?? "";
  const bytes = new TextEncoder().encode(`seum-os::${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
