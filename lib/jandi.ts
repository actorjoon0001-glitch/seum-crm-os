// 잔디(JANDI) Incoming Webhook 전송
// 잔디 토픽 → 커넥트 → Incoming Webhook 에서 발급한 URL 로 메시지를 보냅니다.

export interface JandiSection {
  title: string;
  description: string;
}

export interface JandiMessage {
  body: string;
  color?: string; // 왼쪽 띠 색
  sections?: JandiSection[];
}

const isJandiUrl = (u: string) => /^https:\/\/wh\.jandi\.com\/connect-api\/webhook\//.test(u);

export function validJandiUrl(u: string | null | undefined): boolean {
  return !!u && isJandiUrl(u.trim());
}

// 잔디는 섹션 내용이 너무 길면 거부하므로 적당히 자름
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export async function sendJandi(url: string, msg: JandiMessage): Promise<{ ok: boolean; error?: string }> {
  if (!validJandiUrl(url)) return { ok: false, error: "잔디 웹훅 URL 형식이 아닙니다." };
  try {
    const res = await fetch(url.trim(), {
      method: "POST",
      headers: {
        Accept: "application/vnd.tosslab.jandi-v2+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        body: clip(msg.body, 2000),
        connectColor: msg.color ?? "#1F6FEB",
        connectInfo: (msg.sections ?? []).slice(0, 10).map((s) => ({
          title: clip(s.title, 200),
          description: clip(s.description || "-", 1500),
        })),
      }),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: `잔디 응답 ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "전송 실패" };
  }
}

// 앱 주소 (링크용) — Netlify 가 URL 환경변수를 자동으로 넣어줌
export function appUrl(path = "/"): string {
  const base = (process.env.APP_URL || process.env.URL || "").replace(/\/+$/, "");
  return base ? `${base}${path}` : path;
}
