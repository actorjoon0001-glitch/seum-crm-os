// 서버 컴포넌트(Node 런타임) 전용 인증 검사.
// 로그인 서버액션과 "완전히 같은" process.env.ADMIN_PASSWORD 를 사용하므로,
// Edge 미들웨어가 환경변수를 다르게(또는 못) 읽어서 화면 이동 때마다
// 다시 로그인시키던 문제가 발생하지 않습니다.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, sessionToken } from "@/lib/auth";

export async function isAuthed(): Promise<boolean> {
  if (!process.env.ADMIN_PASSWORD) return false;
  const token = cookies().get(AUTH_COOKIE)?.value;
  return Boolean(token) && token === (await sessionToken());
}

// 인증되지 않았으면 로그인 페이지로 보냅니다. (로그인 후 next 로 복귀)
export async function requireAuth(next: string): Promise<void> {
  if (!(await isAuthed())) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
}
