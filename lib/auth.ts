// 세움OS 계정(Supabase Auth 이메일 · 비밀번호) 기반 로그인 세션.
// 로그인에 성공하면 직원 정보(이름 · 권한)를 서명한 쿠키를 발급합니다.
// 쿠키는 서버 비밀키로 HMAC 서명되므로 위조할 수 없습니다.

export const AUTH_COOKIE = "seum_auth";
// 영업일지에서 마지막으로 쓴 영업사원 이름(자동 선택용)
export const SP_COOKIE = "seum_sp";

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

export type Role = "owner" | "staff";

export interface Session {
  eid: string | null; // employees.id (포털 자동로그인은 null)
  name: string | null;
  email: string | null;
  role: Role;
  exp: number; // 만료(ms)
}

function secret(): string {
  return process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ADMIN_PASSWORD || "";
}

const b64url = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`seum-crm::${secret()}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64url(new Uint8Array(sig));
}

export async function signSession(s: Omit<Session, "exp">, maxAgeSec = COOKIE_OPTS.maxAge): Promise<string> {
  const body = b64url(new TextEncoder().encode(JSON.stringify({ ...s, exp: Date.now() + maxAgeSec * 1000 })));
  return `${body}.${await hmac(body)}`;
}

export async function verifySession(token: string | undefined | null): Promise<Session | null> {
  if (!token || !secret()) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if ((await hmac(body)) !== sig) return null;
  try {
    const s = JSON.parse(fromB64url(body).toString("utf8")) as Session;
    if (!s.exp || s.exp < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

// 세움OS 권한 → 고객관리OS 관리자 여부: role 또는 permission 이 'admin' 인 계정만
// (master 등 다른 상위 권한은 관리자 페이지를 볼 수 없음)
export function isOwnerEmployee(e: { role?: string | null; permission?: string | null; email?: string | null }): boolean {
  const r = (e.role ?? "").toLowerCase();
  const p = (e.permission ?? "").toLowerCase();
  if (r === "admin" || p === "admin") return true;
  // 추가 관리자: OWNER_EMAILS 환경변수 (쉼표로 구분)
  const extra = (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  return !!e.email && extra.includes(e.email.toLowerCase());
}
