"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createCustomer, updateCustomer, type FormResult } from "./actions";
import { INFLOW_ROUTES, INFLOW_TYPES, STAGES, type SalesCustomer } from "@/lib/sales-db";
import type { Salesperson } from "@/lib/staff";

const input =
  "w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-seum";
const lbl = "block text-[11px] font-semibold text-gray-500";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="h-[34px] w-full whitespace-nowrap rounded-md bg-seum px-4 text-sm font-semibold text-white hover:bg-seum-dark disabled:opacity-50"
    >
      {pending ? "저장중…" : label}
    </button>
  );
}

function Group({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <fieldset className={`rounded-lg border border-sky-200 ${className}`}>
      <legend className="ml-2 rounded bg-sky-100 px-2 text-xs font-bold text-sky-800">{title}</legend>
      <div className="grid gap-2 p-2 pt-0">{children}</div>
    </fieldset>
  );
}

// '고객 DB 관리' 엑셀 양식과 같은 구성: 기본정보 / 유입정보 / 영업진행
export default function CustomerForm({
  mode,
  salespeople,
  assignee,
  branch,
  today,
  customer,
}: {
  mode: "create" | "edit";
  salespeople: Salesperson[];
  assignee: string;
  branch: string;
  today: string;
  customer?: SalesCustomer;
}) {
  const [state, action] = useFormState<FormResult | null, FormData>(
    mode === "create" ? createCustomer : updateCustomer,
    null
  );
  const c = customer;
  const formKey = mode === "create" ? state?.seq ?? 0 : "edit";

  return (
    <form key={formKey} action={action} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid gap-3 lg:grid-cols-[5fr_4fr_4fr]">
        <Group title="기본정보">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label>
              <span className={lbl}>접수일</span>
              <input type="date" name="received_date" defaultValue={c?.received_date ?? today} className={input} />
            </label>
            <label>
              <span className={lbl}>고객명</span>
              <input name="customer_name" defaultValue={c?.customer_name ?? ""} placeholder="홍길동" className={input} />
            </label>
            <label>
              <span className={lbl}>연락처</span>
              <input
                name="phone"
                defaultValue={c?.phone ?? ""}
                inputMode="tel"
                placeholder="010-0000-0000"
                className={input}
              />
            </label>
            <label>
              <span className={lbl}>지역</span>
              <input name="region" defaultValue={c?.region ?? ""} placeholder="서울" className={input} />
            </label>
          </div>
        </Group>

        <Group title="유입정보">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label>
              <span className={lbl}>*유입구분</span>
              <select name="inflow_type" defaultValue={c?.inflow_type ?? "개별"} className={input}>
                {INFLOW_TYPES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              <span className={lbl}>*유입경로</span>
              <select name="inflow_route" defaultValue={c?.inflow_route ?? ""} className={input}>
                <option value="">선택</option>
                {INFLOW_ROUTES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              <span className={lbl}>관심제품</span>
              <input name="interest_product" defaultValue={c?.interest_product ?? ""} placeholder="20평" className={input} />
            </label>
            <label>
              <span className={lbl}>예상예산</span>
              <input name="budget" defaultValue={c?.budget ?? ""} placeholder="1억5천만원" className={input} />
            </label>
          </div>
        </Group>

        <Group title="영업진행">
          <div className="grid grid-cols-3 gap-2">
            <label>
              <span className={lbl}>담당지점</span>
              <input name="branch" defaultValue={c?.branch ?? branch} placeholder="마곡" className={input} />
            </label>
            <label>
              <span className={lbl}>배정담당자</span>
              <select name="assignee" defaultValue={c?.assignee ?? assignee} className={input}>
                <option value="">선택</option>
                {salespeople.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={lbl}>*진행단계</span>
              <select name="stage" defaultValue={c?.stage ?? "1차상담"} className={input}>
                {STAGES.map((s) => (
                  <option key={s.value}>{s.value}</option>
                ))}
              </select>
            </label>
          </div>
        </Group>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_160px_140px]">
        {mode === "create" ? (
          <label>
            <span className={lbl}>상담 내용 (일지)</span>
            <input name="memo" placeholder="첫 통화 내용, 고객 요구사항 등" className={input} />
          </label>
        ) : (
          <div />
        )}
        <label>
          <span className={lbl}>다음 연락일</span>
          <input type="date" name="next_action_date" defaultValue={c?.next_action_date ?? ""} className={input} />
        </label>
        <div className="flex items-end">
          <Submit label={mode === "create" ? "+ 고객 등록" : "저장"} />
        </div>
      </div>
      {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="mt-2 text-sm text-green-600">✓ {state.message}</p>}
    </form>
  );
}
