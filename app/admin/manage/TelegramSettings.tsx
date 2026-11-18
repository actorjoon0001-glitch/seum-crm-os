"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { reconnectTelegram, saveTelegram, testTelegram, type ActionResult } from "./actions";

const input = "w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-seum";

function Save() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-seum disabled:opacity-50">
      {pending ? "저장중…" : "텔레그램 설정 저장"}
    </button>
  );
}

function TestButton({ target, disabled }: { target: string; disabled: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ActionResult | null>(null);
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => start(async () => setMsg(await testTelegram(target)))}
        className="whitespace-nowrap rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-semibold text-gray-700 hover:border-seum hover:text-seum disabled:opacity-40"
      >
        {pending ? "전송중…" : "테스트"}
      </button>
      {msg && <span className={`text-xs ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.ok ? "✓" : msg.error}</span>}
    </span>
  );
}

export interface ChatOption {
  id: string;
  title: string;
}

export default function TelegramSettings({
  connected,
  botUsername,
  tokenTail,
  branches,
  chats,
  adminChat,
  detected,
  maskPhone,
  remindMin,
}: {
  connected: boolean;
  botUsername: string;
  tokenTail: string;
  branches: string[];
  chats: Record<string, string>;
  adminChat: string;
  detected: ChatOption[];
  maskPhone: boolean;
  remindMin: number;
}) {
  const [state, action] = useFormState<ActionResult | null, FormData>(saveTelegram, null);
  const [rc, setRc] = useState<ActionResult | null>(null);
  const [rcPending, startRc] = useTransition();

  // 저장돼 있지만 감지 목록에 없는 방도 선택지에 남김
  const known = new Map(detected.map((c) => [c.id, c.title]));
  for (const id of [...Object.values(chats), adminChat]) if (id && !known.has(id)) known.set(id, `(목록에 없음 · ${id})`);
  const options = Array.from(known.entries());

  const ChatSelect = ({ name, value }: { name: string; value: string }) => (
    <select name={name} defaultValue={value} className={input}>
      <option value="">— 연결 안 함 —</option>
      {options.map(([id, title]) => (
        <option key={id} value={id}>
          {title}
        </option>
      ))}
    </select>
  );

  return (
    <form action={action} className="space-y-4">
      {/* 1. 봇 연결 */}
      <div className="rounded-lg border border-gray-200 p-3">
        <div className="text-sm font-semibold text-gray-800">① 알림봇 연결</div>
        {connected ? (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">✓ 연결됨</span>
            <b>@{botUsername || "봇"}</b>
            <span className="text-xs text-gray-400">토큰 …{tokenTail}</span>
            <button
              type="button"
              disabled={rcPending}
              onClick={() => startRc(async () => setRc(await reconnectTelegram()))}
              className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-600 hover:border-seum hover:text-seum disabled:opacity-40"
            >
              {rcPending ? "연결중…" : "다시 연결"}
            </button>
            {rc && <span className={`text-xs ${rc.ok ? "text-green-600" : "text-red-600"}`}>{rc.ok ? `✓ ${rc.message}` : rc.error}</span>}
            <label className="ml-auto inline-flex items-center gap-1 text-[11px] text-gray-500">
              <input type="checkbox" name="tgToken__clear" /> 연결 해제
            </label>
          </div>
        ) : (
          <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-xs text-gray-600">
            <li>
              텔레그램에서 <b>@BotFather</b> 검색 → 대화 시작 → <code className="rounded bg-gray-100 px-1">/newbot</code> 입력
            </li>
            <li>봇 이름(예: 세움 알림봇)과 아이디(예: seum_crm_bot, 끝이 bot)를 정하면 <b>토큰</b>을 줍니다</li>
            <li>그 토큰을 아래 칸에 붙여넣고 저장 (채팅에는 붙여넣지 마세요)</li>
          </ol>
        )}
        <input
          name="tgToken"
          type="password"
          autoComplete="off"
          placeholder={connected ? "토큰을 바꿀 때만 입력" : "123456789:AA… (BotFather 가 준 토큰)"}
          className={`${input} mt-2`}
        />
      </div>

      {/* 2. 전시장 단톡방 */}
      <div className={`rounded-lg border border-gray-200 p-3 ${connected ? "" : "pointer-events-none opacity-50"}`}>
        <div className="text-sm font-semibold text-gray-800">② 전시장별 단톡방</div>
        <p className="mb-2 text-[11px] text-gray-500">
          텔레그램에서 전시장 단톡방을 만들고 봇(@{botUsername || "봇"})을 초대하면 아래 목록에 나타납니다. 안 보이면 방에서{" "}
          <code className="rounded bg-gray-100 px-1">/start</code> 를 보내고 이 페이지를 새로고침하세요. 감지된 방 {detected.length}개
        </p>
        <div className="space-y-2">
          {branches.map((b, i) => (
            <div key={b} className="grid gap-1 sm:grid-cols-[160px_1fr_auto] sm:items-center sm:gap-2">
              <div className="text-sm font-semibold text-gray-700">{b}</div>
              <input type="hidden" name={`tgBranchName_${i}`} value={b} />
              <ChatSelect name={`tgChat_${i}`} value={chats[b] ?? ""} />
              <TestButton target={b} disabled={!chats[b]} />
            </div>
          ))}
          <div className="grid gap-1 border-t border-gray-100 pt-2 sm:grid-cols-[160px_1fr_auto] sm:items-center sm:gap-2">
            <div className="text-sm font-semibold text-gray-700">
              관리자 방
              <span className="block text-[11px] font-normal text-gray-400">관리자 요약 · 미확인 재알림 · 전시장 방 없는 알림</span>
            </div>
            <ChatSelect name="tgAdminChat" value={adminChat} />
            <TestButton target="admin" disabled={!adminChat} />
          </div>
        </div>
      </div>

      {/* 3. 옵션 */}
      <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 text-sm ${connected ? "" : "pointer-events-none opacity-50"}`}>
        <input type="hidden" name="tgOptions" value="1" />
        <label className="inline-flex items-center gap-1.5">
          <b className="text-gray-700">미확인 재알림</b>
          <select name="tgRemindMin" defaultValue={String(remindMin)} className="rounded-lg border border-gray-300 px-2 py-1">
            <option value="0">끄기</option>
            {[10, 20, 30, 60].map((m) => (
              <option key={m} value={m}>
                {m}분 후
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" name="tgMaskPhone" defaultChecked={maskPhone} className="h-4 w-4" />
          전화번호 가운데 가리기 (010-****-5678)
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Save />
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state?.ok && <span className="text-sm text-green-600">✓ {state.message}</span>}
      </div>
      <p className="text-[11px] text-gray-400">
        알림 종류(아침 브리핑 · 새 방문예약 · 대표번호 · 관리자)와 브리핑 시각은 위 잔디 설정의 체크를 같이 따릅니다. 고객 알림에는{" "}
        <b>✅ 확인 · 📞 연락완료</b> 버튼이 붙고, 누가 몇 시에 눌렀는지 방문예약 · 대표번호 목록에 표시됩니다.
      </p>
    </form>
  );
}
