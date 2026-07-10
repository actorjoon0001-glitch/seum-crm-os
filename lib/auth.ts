// 단일 관리자 비밀번호 인증.
// 비밀번호는 환경변수 ADMIN_PASSWORD 에 보관하고, 세션 쿠키에는
// 비밀번호 자체가 아니라 해시 토큰만 저장합니다.
// (미들웨어=Edge, 서버액션=Node 모두에서 Web Crypto 사용)

export const AUTH_COOKIE = "seum_auth";

// 이 앱은 seum-platform 포털 안에 iframe 으로 임베드되어 사용됩니다.
// iframe(교차 사이트) 안에서 쿠키가 유지되려면 sameSite:"none" 이어야 하고,
// none 은 secure:true 가 필수입니다. partitioned(CHIPS)는 최신 브라우저의
// 서드파티 쿠키 차단 환경에서도 임베드별로 쿠키를 저장하도록 해줍니다.
export const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "none" as const,
  partitioned: true,
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
