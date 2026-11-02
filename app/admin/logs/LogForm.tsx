"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createSalesLog, type LogFormResult } from "./actions";
import { LOG_ACTIVITIES, LOG_SOURCES, LOG_STAGES } from "@/lib/types";

const input =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-seum";
const label = "text-xs font-medium text-gray-500";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="h-[38px] w-full whitespace-nowrap rounded-lg bg-seum px-5 text-sm font-semibold text-white hover:bg-seum-dark disabled:opacity-50"
    >
      {pending ? "저장중…" : "✓ 일지 기록"}
    </button>
  );
}

export interface LogPrefill {
  customer_name?: string;
  phone?: string;
  source?: string;
  region?: string;
  interest?: string;
}

// 영업일지 1건 입력 폼 — 기록 후 고객 칸만 비워지고 영업사원·날짜는 유지
export default function LogForm({
  salesperson,
  logDate,
  salespeople,
  prefill,
}: {
  salesperson: string;
  logDate: string;
  salespeople: string[];
  prefill?: LogPrefill;
}) {
  const [state, action] = useFormState<LogFormResult | null, FormData>(createSalesLog, null);
  const [activity, setActivity] = useState("call");
  // 성공 후에는 미리채움(prefill)을 쓰지 않음
  const pf = state?.seq ? {} : prefill ?? {};

  return (
    <form
      key={state?.seq ?? 0}
      action={action}
      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
        <label>
          <span className={label}>영업사원 *</span>
          <input
            name="salesperson"
            defaultValue={salesperson}
            list="log-sp"
            placeholder="본인 이름"
            className={input}
          />
          <datalist id="log-sp">
            {salespeople.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label>
          <span className={label}>날짜</span>
          <input type="date" name="log_date" defaultValue={logDate} className={input} />
        </label>
        <label>
          <span className={label}>고객명</span>
          <input name="customer_name" defaultValue={pf.customer_name} placeholder="홍길동" className={input} />
        </label>
        <label>
          <span className={label}>연락처</span>
          <input
            name="phone"
            defaultValue={pf.phone}
            inputMode="tel"
            placeholder="010-0000-0000"
            className={input}
          />
        </label>
        <label>
          <span className={label}>유입경로</span>
          <select name="source" defaultValue={pf.source ?? ""} className={input}>
            <option value="">선택</option>
            {LOG_SOURCES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={label}>지역 / 토지위치</span>
          <input name="region" defaultValue={pf.region} placeholder="예: 양평 서종면" className={input} />
        </label>

        <label>
          <span className={label}>활동 *</span>
          <select
            name="activity"
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            className={input}
          >
            {LOG_ACTIVITIES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={label}>고객 단계 *</span>
          <select
            name="stage"
            key={activity}
            defaultValue={
              activity === "contract" ? "contracted" : activity === "quote" ? "quoted" : "consulting"
            }
            className={input}
          >
            {LOG_STAGES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={label}>관심 상품 / 평수</span>
          <input name="interest" defaultValue={pf.interest} placeholder="예: 전원주택 30평" className={input} />
        </label>
        {activity === "contract" ? (
          <label>
            <span className={label}>계약 금액 (만원)</span>
            <input name="contract_amount" inputMode="numeric" placeholder="예: 18000" className={input} />
          </label>
        ) : (
          <label>
            <span className={label}>다음 연락일</span>
            <input type="date" name="next_action_date" className={input} />
          </label>
        )}
        <label className="col-span-2">
          <span className={label}>다음 할 일</span>
          <input name="next_action" placeholder="예: 견적서 보내고 주말 재통화" className={input} />
        </label>

        <label className="col-span-2 md:col-span-3 xl:col-span-5">
          <span className={label}>상담 내용</span>
          <textarea
            name="memo"
            rows={2}
            placeholder="고객 요구사항, 예산, 반응 등"
            className={`${input} resize-y`}
          />
        </label>
        <div className="col-span-2 flex items-end md:col-span-1">
          <Submit />
        </div>
      </div>
      {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      {state?.ok && (
        <p className="mt-2 text-sm text-green-600">
          ✓ 기록되었습니다{state.isNew ? " · 🆕 신규 고객으로 집계됩니다" : ""}.
        </p>
      )}
    </form>
  );
}
