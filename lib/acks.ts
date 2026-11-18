// 텔레그램 알림의 '확인 · 연락완료' 기록 (crm_settings 에 key = ack:v:<id> / ack:c:<id> 로 저장)
import { createServiceClient } from "@/lib/supabase/server";
import { SETTINGS_TABLE, setSetting } from "@/lib/settings";
import type { JandiMessage } from "@/lib/jandi";
import {
  ackKeyboard,
  getTelegramConfig,
  hhmm,
  sendTelegram,
  tgApi,
  tgReady,
  type AckKind,
  type AckRef,
  type AckState,
} from "@/lib/telegram";

export const ackKey = (kind: AckKind, id: string) => `ack:${kind}:${id}`;

export async function getAck(kind: AckKind, id: string): Promise<AckState | null> {
  const { data } = await createServiceClient().from(SETTINGS_TABLE).select("value").eq("key", ackKey(kind, id)).maybeSingle();
  return (data?.value as AckState) ?? null;
}

// 최근 기록 (목록 화면 표시용) — id → 기록
export async function getRecentAcks(kind: AckKind, days = 60): Promise<Map<string, AckState>> {
  const { data, error } = await createServiceClient()
    .from(SETTINGS_TABLE)
    .select("value")
    .like("key", `ack:${kind}:%`)
    .gte("updated_at", new Date(Date.now() - days * 86400000).toISOString())
    .limit(5000);
  const map = new Map<string, AckState>();
  if (error) return map;
  for (const r of (data ?? []) as { value: AckState }[]) if (r.value?.id) map.set(String(r.value.id), r.value);
  return map;
}

// 전시장 단톡방으로 텔레그램 알림 (전시장 방이 없으면 관리자 방). ref 가 있으면 확인 버튼 + 기록 시작
export async function tgNotify(
  branch: string | null | undefined,
  msg: JandiMessage,
  ref?: AckRef,
  report?: string[],
  label = "알림"
): Promise<void> {
  try {
    const { value: cfg, missing } = await getTelegramConfig();
    if (missing || !tgReady(cfg)) return;
    const branchChat = branch ? cfg.chats?.[branch] : undefined;
    const chat = branchChat || cfg.adminChat;
    if (!chat) return;
    const r = await sendTelegram(cfg, chat, msg, { ref });
    report?.push(`텔레그램 ${label}(${branchChat ? branch : "관리자"}): ${r.ok ? "전송" : `실패(${r.error})`}`);
    if (r.ok && ref) {
      const st: AckState = {
        kind: ref.kind,
        id: String(ref.id),
        name: ref.name,
        branch: branch ?? null,
        chat,
        mid: r.messageId,
        sentAt: new Date().toISOString(),
      };
      await setSetting(ackKey(ref.kind, String(ref.id)), st); // 새로 보낼 때마다 확인 절차를 새로 시작
    }
  } catch {
    /* 알림 실패는 본 작업에 영향 없음 */
  }
}

// 버튼 눌렀을 때: 기록 → 버튼 글자 갱신 → 단톡방에 한 줄 알림
export async function handleAckPress(opts: {
  action: "a" | "d";
  kind: AckKind;
  id: string;
  who: string;
  chatId: string;
  messageId?: number;
  callbackId: string;
}): Promise<void> {
  const { value: cfg } = await getTelegramConfig();
  if (!tgReady(cfg)) return;
  const now = new Date().toISOString();
  const cur: AckState = (await getAck(opts.kind, opts.id)) ?? { kind: opts.kind, id: opts.id };
  let toast = "";
  let line = "";
  const label = cur.name ? ` — ${cur.name}` : "";
  if (opts.action === "a") {
    if (cur.ackBy) toast = `이미 확인됨: ${cur.ackBy} ${hhmm(cur.ackAt)}`;
    else {
      cur.ackBy = opts.who;
      cur.ackAt = now;
      toast = "확인 기록됨";
      line = `✅ ${opts.who} 확인 (${hhmm(now)})${label}`;
    }
  } else {
    if (cur.doneBy) toast = `이미 연락완료: ${cur.doneBy} ${hhmm(cur.doneAt)}`;
    else {
      if (!cur.ackBy) {
        cur.ackBy = opts.who;
        cur.ackAt = now;
      }
      cur.doneBy = opts.who;
      cur.doneAt = now;
      toast = "연락완료 기록됨";
      line = `📞 ${opts.who} 연락완료 (${hhmm(now)})${label}`;
    }
  }
  if (line) await setSetting(ackKey(opts.kind, opts.id), cur);
  await tgApi(cfg.token, "answerCallbackQuery", { callback_query_id: opts.callbackId, text: toast });
  if (!line) return;
  if (opts.messageId)
    await tgApi(cfg.token, "editMessageReplyMarkup", {
      chat_id: opts.chatId,
      message_id: opts.messageId,
      reply_markup: ackKeyboard({ kind: opts.kind, id: opts.id }, cur),
    });
  await tgApi(cfg.token, "sendMessage", {
    chat_id: opts.chatId,
    text: line,
    ...(opts.messageId ? { reply_parameters: { message_id: opts.messageId, allow_sending_without_reply: true } } : {}),
  });
}

// N분 넘게 '확인' 안 된 알림 다시 보내기 (자동 실행에서 호출, 1번만)
export async function remindUnacked(report: string[]): Promise<void> {
  const { value: cfg, missing } = await getTelegramConfig();
  if (missing || !tgReady(cfg) || !(cfg.remindMin > 0)) return;
  const { data, error } = await createServiceClient()
    .from(SETTINGS_TABLE)
    .select("value")
    .like("key", "ack:%")
    .gte("updated_at", new Date(Date.now() - 86400000).toISOString())
    .limit(500);
  if (error) return;
  const due = ((data ?? []) as { value: AckState }[])
    .map((r) => r.value)
    .filter((a) => a?.chat && a.sentAt && !a.ackBy && !a.reminded && Date.now() - Date.parse(a.sentAt) >= cfg.remindMin * 60000);
  for (const a of due.slice(0, 20)) {
    a.reminded = true;
    await setSetting(ackKey(a.kind, a.id), a); // 먼저 기록 → 중복 재알림 방지
    const what = a.kind === "v" ? "방문예약" : "대표번호 문의";
    const r = await sendTelegram(
      cfg,
      a.chat!,
      { body: `⏰ ${cfg.remindMin}분째 아무도 '확인'을 누르지 않았습니다 — ${what} ${a.name ?? ""}`, sections: [] },
      { ref: { kind: a.kind, id: a.id, name: a.name }, replyTo: a.mid }
    );
    report.push(`텔레그램 미확인 재알림(${a.branch ?? "관리자"}): ${r.ok ? "전송" : `실패(${r.error})`}`);
    if (r.ok) {
      a.mid = r.messageId; // 버튼은 새 메시지 기준으로
      await setSetting(ackKey(a.kind, a.id), a);
    }
    if (cfg.adminChat && cfg.adminChat !== a.chat)
      await sendTelegram(cfg, cfg.adminChat, {
        body: `⏰ [${a.branch ?? "전시장 미지정"}] ${what} ${a.name ?? ""} — ${cfg.remindMin}분째 미확인`,
      });
  }
}
