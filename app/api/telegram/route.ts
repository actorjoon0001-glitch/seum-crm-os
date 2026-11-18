import { NextRequest, NextResponse } from "next/server";
import { getTelegramConfig, migrateChat, rememberChat, tgApi, tgReady, tgWebhookSecret } from "@/lib/telegram";
import { handleAckPress } from "@/lib/acks";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

interface TgChat {
  id: number;
  title?: string;
  type?: string;
}
interface TgUser {
  first_name?: string;
  last_name?: string;
  username?: string;
}

const nameOf = (u?: TgUser) => [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.username || "누군가";

// 텔레그램 → 고객관리OS (봇 웹훅)
export async function POST(req: NextRequest) {
  const { value: cfg, missing } = await getTelegramConfig();
  if (missing || !tgReady(cfg)) return NextResponse.json({ ok: false }, { status: 404 });
  if (req.headers.get("x-telegram-bot-api-secret-token") !== (await tgWebhookSecret(cfg.token)))
    return NextResponse.json({ ok: false }, { status: 401 });

  const u = (await req.json().catch(() => null)) as Record<string, any> | null;
  if (!u) return NextResponse.json({ ok: true });

  try {
    // 봇이 단톡방에 초대되거나 내보내졌을 때
    if (u.my_chat_member) {
      const chat = u.my_chat_member.chat as TgChat;
      const st = u.my_chat_member.new_chat_member?.status as string;
      if (chat.type !== "private") {
        const removed = st === "left" || st === "kicked";
        await rememberChat(chat, removed);
        if (!removed && (u.my_chat_member.old_chat_member?.status === "left" || u.my_chat_member.old_chat_member?.status === "kicked"))
          await tgApi(cfg.token, "sendMessage", {
            chat_id: chat.id,
            text: "👋 세움 고객관리OS 알림봇입니다.\n관리자 페이지에서 이 방을 전시장에 연결하면 고객 알림이 여기로 옵니다.",
          });
      }
    }

    // 메시지 (방 이름 변경 · 슈퍼그룹 전환 · /start)
    if (u.message) {
      const m = u.message;
      const chat = m.chat as TgChat;
      if (m.migrate_to_chat_id) await migrateChat(String(chat.id), String(m.migrate_to_chat_id));
      else if (chat.type !== "private") await rememberChat(chat);
      const text = String(m.text ?? "");
      if (/^\/(start|id)\b/.test(text))
        await tgApi(cfg.token, "sendMessage", {
          chat_id: chat.id,
          text:
            chat.type === "private"
              ? "세움 고객관리OS 알림봇입니다. 전시장 단톡방에 저를 초대해 주세요."
              : `이 방(${chat.title ?? ""})이 고객관리OS에 등록됐습니다. 관리자 페이지에서 전시장을 지정해 주세요.`,
        });
    }

    // [✅ 확인] [📞 연락완료] 버튼
    if (u.callback_query) {
      const q = u.callback_query;
      const [action, kind, ...rest] = String(q.data ?? "").split(":");
      const id = rest.join(":");
      if ((action === "a" || action === "d") && (kind === "v" || kind === "c") && id) {
        await handleAckPress({
          action,
          kind,
          id,
          who: nameOf(q.from),
          chatId: String(q.message?.chat?.id ?? ""),
          messageId: q.message?.message_id,
          callbackId: q.id,
        });
      } else {
        await tgApi(cfg.token, "answerCallbackQuery", { callback_query_id: q.id });
      }
    }
  } catch {
    /* 텔레그램에는 항상 200 으로 답해야 같은 요청을 반복해서 보내지 않음 */
  }
  return NextResponse.json({ ok: true });
}
