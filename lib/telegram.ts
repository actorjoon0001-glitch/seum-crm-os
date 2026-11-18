// 텔레그램 봇 알림 (서버 전용)
// - 관리자 페이지에서 봇 토큰을 저장하면 웹훅(/api/telegram)을 자동으로 등록합니다.
// - 봇을 전시장 단톡방에 초대하면 그 방이 '감지된 단톡방' 목록에 올라오고, 관리자가 전시장에 짝지어 줍니다.
// - 고객 알림에는 [✅ 확인] [📞 연락완료] 버튼이 붙고, 누르면 누가 몇 시에 눌렀는지 기록됩니다.
import { getSetting, setSetting } from "@/lib/settings";
import { appUrl, type JandiMessage } from "@/lib/jandi";

export interface TelegramConfig {
  token: string; // 봇 토큰 (BotFather 발급) — 화면에는 끝자리만 표시
  botUsername: string; // @이름 (토큰 저장 시 확인)
  chats: Record<string, string>; // 전시장 이름 → 단톡방 chat id
  adminChat: string; // 관리자 단톡방 chat id
  maskPhone: boolean; // 전화번호 가운데 가리기
  remindMin: number; // N분 동안 '확인' 없으면 다시 알림 (0 = 끔)
}

export const DEFAULT_TELEGRAM: TelegramConfig = {
  token: "",
  botUsername: "",
  chats: {},
  adminChat: "",
  maskPhone: false,
  remindMin: 30,
};

export interface DetectedChat {
  id: string;
  title: string;
  type: string;
  at: string;
}

export const getTelegramConfig = () => getSetting<TelegramConfig>("telegram", DEFAULT_TELEGRAM);

export async function getDetectedChats(): Promise<DetectedChat[]> {
  const { value } = await getSetting<{ list: DetectedChat[] }>("telegram_chats", { list: [] });
  return Array.isArray(value.list) ? value.list : [];
}

export function tgReady(cfg: TelegramConfig): boolean {
  return /^\d+:[\w-]{20,}$/.test((cfg.token ?? "").trim());
}

const API = () => (process.env.TELEGRAM_API_BASE || "https://api.telegram.org").replace(/\/+$/, "");

export async function tgApi<T = unknown>(
  token: string,
  method: string,
  body: Record<string, unknown> = {}
): Promise<{ ok: boolean; result?: T; error?: string }> {
  try {
    const res = await fetch(`${API()}/bot${token.trim()}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const j = (await res.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null;
    if (!res.ok || !j?.ok) return { ok: false, error: j?.description || `텔레그램 응답 ${res.status}` };
    return { ok: true, result: j.result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "텔레그램 전송 실패" };
  }
}

// 웹훅 요청 확인용 비밀값 (토큰에서 계산 — 토큰이 바뀌면 같이 바뀜)
export async function tgWebhookSecret(token: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`seum-tg::${token.trim()}`));
  return Array.from(new Uint8Array(d))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function webhookUrl(): string | null {
  const u = appUrl("/api/telegram");
  return /^https:\/\//.test(u) ? u : null;
}

export async function registerWebhook(token: string): Promise<{ ok: boolean; error?: string }> {
  const url = webhookUrl();
  if (!url) return { ok: false, error: "사이트 주소(https)를 알 수 없어 웹훅을 등록하지 못했습니다." };
  const r = await tgApi(token, "setWebhook", {
    url,
    secret_token: await tgWebhookSecret(token),
    allowed_updates: ["message", "my_chat_member", "callback_query"],
    drop_pending_updates: true,
  });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

// ---------- 메시지 ----------
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function maskPhones(s: string): string {
  return s.replace(/(01[016789])[-\s.]?(\d{3,4})[-\s.]?(\d{4})/g, "$1-****-$3");
}

// 잔디 메시지 형식 → 텔레그램 HTML
export function toTelegramHtml(msg: JandiMessage, mask: boolean): string {
  const m = (s: string) => (mask ? maskPhones(s) : s);
  const parts = [`<b>${esc(m(msg.body))}</b>`];
  for (const s of msg.sections ?? []) {
    parts.push(`\n<b>${esc(m(s.title))}</b>\n${esc(m(s.description || "-"))}`);
  }
  const text = parts.join("\n");
  return text.length > 4000 ? text.slice(0, 3990) + "…" : text;
}

export type AckKind = "v" | "c"; // v = 방문예약, c = 대표번호
export interface AckRef {
  kind: AckKind;
  id: string;
  name?: string;
}
export interface AckState {
  kind: AckKind;
  id: string;
  name?: string;
  branch?: string | null;
  chat?: string;
  mid?: number;
  sentAt?: string;
  ackBy?: string;
  ackAt?: string;
  doneBy?: string;
  doneAt?: string;
  reminded?: boolean;
}

export const hhmm = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false })
    : "";

export function ackLink(ref: { kind: AckKind; id: string }): string | null {
  const u = appUrl(ref.kind === "v" ? `/admin/visits/${ref.id}` : "/admin/calls/main");
  return /^https:\/\//.test(u) ? u : null;
}

// [✅ 확인] [📞 연락완료] (+ 고객관리OS 링크) 버튼
export function ackKeyboard(ref: { kind: AckKind; id: string }, st?: Partial<AckState>) {
  const rows: { text: string; callback_data?: string; url?: string }[][] = [
    [
      { text: st?.ackBy ? `✅ ${st.ackBy} ${hhmm(st.ackAt)}` : "✅ 확인", callback_data: `a:${ref.kind}:${ref.id}`.slice(0, 64) },
      {
        text: st?.doneBy ? `📞 ${st.doneBy} ${hhmm(st.doneAt)} 연락완료` : "📞 연락완료",
        callback_data: `d:${ref.kind}:${ref.id}`.slice(0, 64),
      },
    ],
  ];
  const link = ackLink(ref);
  if (link) rows.push([{ text: "🔗 고객관리OS에서 보기", url: link }]);
  return { inline_keyboard: rows };
}

export async function sendTelegram(
  cfg: TelegramConfig,
  chatId: string,
  msg: JandiMessage,
  opts: { ref?: AckRef; replyTo?: number } = {}
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  if (!tgReady(cfg) || !chatId) return { ok: false, error: "텔레그램 미연결" };
  const r = await tgApi<{ message_id: number }>(cfg.token, "sendMessage", {
    chat_id: chatId,
    text: toTelegramHtml(msg, cfg.maskPhone),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(opts.ref ? { reply_markup: ackKeyboard(opts.ref) } : {}),
    ...(opts.replyTo ? { reply_parameters: { message_id: opts.replyTo, allow_sending_without_reply: true } } : {}),
  });
  return r.ok ? { ok: true, messageId: r.result?.message_id } : { ok: false, error: r.error };
}

// 감지된 단톡방 목록 갱신 (봇이 들어가거나 메시지를 받을 때)
export async function rememberChat(chat: { id: number | string; title?: string; type?: string }, removed = false) {
  const id = String(chat.id);
  const list = await getDetectedChats();
  const i = list.findIndex((c) => c.id === id);
  if (removed) {
    if (i < 0) return;
    list.splice(i, 1);
  } else {
    const title = chat.title || "(이름 없는 방)";
    if (i >= 0 && list[i].title === title) return; // 바뀐 게 없으면 저장 안 함
    const item = { id, title, type: chat.type || "", at: new Date().toISOString() };
    if (i >= 0) list[i] = item;
    else list.unshift(item);
  }
  await setSetting("telegram_chats", { list: list.slice(0, 50) });
}

// 일반 그룹 → 슈퍼그룹 전환 시 chat id 가 바뀜: 저장된 연결도 새 id 로
export async function migrateChat(oldId: string, newId: string) {
  const { value: cfg } = await getTelegramConfig();
  let changed = false;
  const chats = { ...(cfg.chats ?? {}) };
  for (const [b, c] of Object.entries(chats))
    if (c === oldId) {
      chats[b] = newId;
      changed = true;
    }
  let adminChat = cfg.adminChat;
  if (adminChat === oldId) {
    adminChat = newId;
    changed = true;
  }
  if (changed) await setSetting("telegram", { ...cfg, chats, adminChat });
  const list = await getDetectedChats();
  const item = list.find((c) => c.id === oldId);
  if (item) {
    item.id = newId;
    await setSetting("telegram_chats", { list });
  }
}
