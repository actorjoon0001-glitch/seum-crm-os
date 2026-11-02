"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createCallLead, type CallFormResult } from "./actions";
import type { CallChannel } from "@/lib/types";

const input =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-seum";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="h-[38px] whitespace-nowrap rounded-lg bg-seum px-5 text-sm font-semibold text-white hover:bg-seum-dark disabled:opacity-50"
    >
      {pending ? "등록중…" : "+ 등록"}
    </button>
  );
}

// 전화 고객 수기 등록 폼 (1건씩)
export default function CallForm({
  channel,
  defaultCalledAt,
  salespeople,
}: {
  channel: CallChannel;
  defaultCalledAt: string;
  salespeople: string[];
}) {
  const [state, action] = useFormState<CallFormResult | null, FormData>(createCallLead, null);
  const isMobile = channel === "mobile";

  return (
    <form
      // 등록 성공할 때마다 key 가 바뀌어 입력칸이 비워짐
      key={state?.seq ?? 0}
      action={action}
      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <input type="hidden" name="channel" value={channel} />
      <div className="mb-2 text-sm font-bold text-gray-800">
        {isMobile ? "📱 영업사원 핸드폰 전화 고객 등록" : "☎️ 대표번호 전화 고객 등록"}
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        <label className="col-span-1">
          <span className="text-xs text-gray-500">통화일시</span>
          <input
            type="datetime-local"
            name="called_at"
            defaultValue={defaultCalledAt}
            className={input}
          />
        </label>
        <label>
          <span className="text-xs text-gray-500">고객명</span>
          <input name="name" placeholder="홍길동" className={input} />
        </label>
        <label>
          <span className="text-xs text-gray-500">연락처</span>
          <input name="phone" inputMode="tel" placeholder="010-0000-0000" className={input} />
        </label>
        <label>
          <span className="text-xs text-gray-500">
            {isMobile ? "영업사원 *" : "담당 영업사원"}
          </span>
          <input
            name="salesperson"
            list={`sp-${channel}`}
            placeholder={isMobile ? "본인 이름" : "배정 담당자"}
            className={input}
          />
          <datalist id={`sp-${channel}`}>
            {salespeople.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label>
          <span className="text-xs text-gray-500">지역 / 토지위치</span>
          <input name="region" placeholder="예: 양평 서종면" className={input} />
        </label>
        <label className="col-span-2 md:col-span-2 xl:col-span-2">
          <span className="text-xs text-gray-500">문의 내용</span>
          <input name="inquiry" placeholder="예: 30평 단층 견적 문의" className={input} />
        </label>
        <div className="flex items-end">
          <Submit />
        </div>
        <label className="col-span-2 md:col-span-4 xl:col-span-8">
          <span className="text-xs text-gray-500">직원 메모</span>
          <input name="memo" placeholder="통화 내용, 다음 연락 일정 등" className={input} />
        </label>
      </div>
      {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="mt-2 text-sm text-green-600">✓ 등록되었습니다.</p>}
    </form>
  );
}
