"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveJandi, sendBriefNow, testJandi, type ActionResult } from "./actions";

export interface UrlState {
  set: boolean;
  tail: string; // 저장된 URL 끝부분 (확인용)
}

const input =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-seum";

function Save() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-seum disabled:opacity-50">
      {pending ? "저장중…" : "설정 저장"}
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
        onClick={() => start(async () => setMsg(await testJandi(target)))}
        className="whitespace-nowrap rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-semibold text-gray-700 hover:border-seum hover:text-seum disabled:opacity-40"
      >
        {pending ? "전송중…" : "테스트"}
      </button>
      {msg && <span className={`text-xs ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.ok ? "✓" : msg.error}</span>}
    </span>
  );
}

function UrlRow({ name, label, hint, state }: { name: string; label: string; hint?: string; state: UrlState }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[160px_1fr_auto] sm:items-center sm:gap-2">
      <div className="text-sm font-semibold text-gray-700">
        {label}
        {hint && <span className="block text-[11px] font-normal text-gray-400">{hint}</span>}
      </div>
      <div>
        <input
          name={name}
          type="url"
          autoComplete="off"
          placeholder={state.set ? `저장됨 (…${state.tail}) — 바꾸려면 새 URL 입력` : "https://wh.jandi.com/connect-api/webhook/…"}
          className={input}
        />
        {state.set && (
          <label className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-gray-500">
            <input type="checkbox" name={`${name}__clear`} /> 연결 해제
          </label>
        )}
      </div>
      <TestButton target={name === "teamUrl" ? "team" : name === "adminUrl" ? "admin" : name.replace(/^branch:/, "")} disabled={!state.set} />
    </div>
  );
}

export default function JandiSettings({
  team,
  admin,
  branches,
  briefHour,
  briefMinute,
  toggles,
  lastTickAt,
  lastBriefDate,
}: {
  team: UrlState;
  admin: UrlState;
  branches: { branch: string; state: UrlState }[];
  briefHour: number;
  briefMinute: number;
  toggles: { brief: boolean; newVisit: boolean; newCall: boolean; admin: boolean };
  lastTickAt?: string;
  lastBriefDate?: string;
}) {
  const [state, action] = useFormState<ActionResult | null, FormData>(saveJandi, null);
  const [briefMsg, setBriefMsg] = useState<ActionResult | null>(null);
  const [briefPending, startBrief] = useTransition();

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <UrlRow name="teamUrl" label="영업팀 토픽" hint="아침 브리핑 · 새 방문예약 · 대표번호 문의" state={team} />
        <UrlRow name="adminUrl" label="관리자 토픽" hint="관리자 일일 요약 · 로그인 실패 경고" state={admin} />
      </div>

      <details className="rounded-lg border border-gray-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-gray-700">
          전시장별 토픽 (선택) — 연결한 전시장은 그 전시장 것만 따로 받습니다
        </summary>
        <div className="mt-2 space-y-2">
          {branches.map((b) => (
            <div key={b.branch}>
              <input type="hidden" name="branch" value={b.branch} />
              <UrlRow name={`branch:${b.branch}`} label={b.branch} state={b.state} />
            </div>
          ))}
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="flex items-center gap-1">
          <b className="text-gray-700">아침 브리핑</b>
          <select name="briefHour" defaultValue={briefHour} className="rounded-lg border border-gray-300 px-2 py-1">
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}시
              </option>
            ))}
          </select>
          <select name="briefMinute" defaultValue={briefMinute - (briefMinute % 5)} className="rounded-lg border border-gray-300 px-2 py-1">
            {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, "0")}분
              </option>
            ))}
          </select>
        </span>
        {(
          [
            ["brief", "1. 매일 아침 브리핑", toggles.brief],
            ["newVisit", "2. 새 방문예약 알림", toggles.newVisit],
            ["newCall", "2. 대표번호 문의 알림", toggles.newCall],
            ["admin", "3. 관리자 알림", toggles.admin],
          ] as const
        ).map(([k, label, on]) => (
          <label key={k} className="inline-flex items-center gap-1.5">
            <input type="checkbox" name={k} defaultChecked={on} className="h-4 w-4" />
            {label}
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Save />
        <button
          type="button"
          disabled={briefPending || !team.set}
          onClick={() => startBrief(async () => setBriefMsg(await sendBriefNow()))}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-seum hover:text-seum disabled:opacity-40"
        >
          {briefPending ? "보내는 중…" : "아침 브리핑 지금 보내보기"}
        </button>
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state?.ok && <span className="text-sm text-green-600">✓ {state.message}</span>}
        {briefMsg && <span className={`text-sm ${briefMsg.ok ? "text-green-600" : "text-red-600"}`}>{briefMsg.ok ? `✓ ${briefMsg.message}` : briefMsg.error}</span>}
      </div>

      <p className="text-xs text-gray-400">
        자동 실행: 5분마다 확인 · 마지막 실행 {lastTickAt ? new Date(lastTickAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false }) : "아직 없음"}
        {lastBriefDate && ` · 마지막 브리핑 ${lastBriefDate}`}
      </p>
    </form>
  );
}
