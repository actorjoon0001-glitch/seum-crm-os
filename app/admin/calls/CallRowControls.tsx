"use client";

import { useState, useTransition } from "react";
import { updateCallField, deleteCallLead } from "./actions";
import { CALL_STATUSES, callStatusMeta } from "@/lib/types";
import { GRADES, gradeColor } from "@/lib/sales-db";

export function CallStatusSelect({ id, status }: { id: string; status: string | null }) {
  const [value, setValue] = useState(status || "new");
  const [pending, startTransition] = useTransition();
  const meta = callStatusMeta(value);

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        setValue(next);
        startTransition(() => updateCallField(id, "status", next));
      }}
      className={`w-full cursor-pointer rounded-full border-0 px-2 py-1 text-xs font-semibold outline-none ring-1 ring-inset ring-black/5 ${meta.color} ${pending ? "opacity-50" : ""}`}
    >
      {CALL_STATUSES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

export function CallGradeSelect({ id, grade }: { id: string; grade: string | null | undefined }) {
  const [value, setValue] = useState(grade ?? "");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <select
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          const prev = value;
          setValue(next);
          setErr(null);
          start(async () => {
            try {
              await updateCallField(id, "grade", next);
            } catch (er) {
              setValue(prev);
              setErr(er instanceof Error ? er.message : "저장 실패");
            }
          });
        }}
        title={GRADES.find((g) => g.value === value)?.desc ?? "고객등급 선택"}
        className={`w-full cursor-pointer rounded-md border-0 px-1.5 py-1 text-center text-xs font-black outline-none ${gradeColor(value)} ${pending ? "opacity-50" : ""}`}
      >
        <option value="">-</option>
        {GRADES.map((g) => (
          <option key={g.value} value={g.value}>
            {g.value}
          </option>
        ))}
      </select>
      {err && <div className="mt-0.5 text-[10px] leading-tight text-red-600">{err}</div>}
    </div>
  );
}

// 대표번호 → 전시장으로 넘기기 (선택하면 그 전시장 잔디 토픽에 알림)
export function CallBranchSelect({
  id,
  branch,
  handedAt,
  branches,
}: {
  id: string;
  branch: string | null | undefined;
  handedAt: string | null | undefined;
  branches: string[];
}) {
  const [value, setValue] = useState(branch ?? "");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const opts = value && !branches.includes(value) ? [value, ...branches] : branches;
  return (
    <div>
      <select
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          const prev = value;
          if (next && !window.confirm(`이 문의를 [${next}]으로 넘길까요?\n해당 전시장 잔디 토픽으로 알림이 갑니다.`)) return;
          setValue(next);
          setErr(null);
          start(async () => {
            try {
              await updateCallField(id, "branch", next);
              setSent(!!next);
            } catch (er) {
              setValue(prev);
              setErr(er instanceof Error ? er.message : "저장 실패");
            }
          });
        }}
        className={`w-full cursor-pointer rounded-md px-1.5 py-1 text-xs font-semibold outline-none ${
          value ? "bg-indigo-600 text-white" : "border border-dashed border-gray-300 bg-white text-gray-400"
        } ${pending ? "opacity-50" : ""}`}
      >
        <option value="">넘기지 않음</option>
        {opts.map((b) => (
          <option key={b} value={b}>
            → {b}
          </option>
        ))}
      </select>
      {sent && <div className="mt-0.5 text-[10px] text-green-600">✓ 넘김 · 잔디 알림</div>}
      {!sent && value && handedAt && (
        <div className="mt-0.5 text-[10px] text-gray-400">
          {new Date(handedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })} 넘김
        </div>
      )}
      {err && <div className="mt-0.5 text-[10px] leading-tight text-red-600">{err}</div>}
    </div>
  );
}

// 칸 단위 편집: blur / Enter 시 저장
export function CallTextInput({
  id,
  field,
  value,
  placeholder,
  multiline,
}: {
  id: string;
  field: "salesperson" | "memo" | "inquiry";
  value: string | null;
  placeholder: string;
  multiline?: boolean;
}) {
  const [val, setVal] = useState(value || "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const save = () => {
    if (val.trim() === (value || "")) return;
    startTransition(async () => {
      await updateCallField(id, field, val);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  };

  const cls =
    "w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs outline-none focus:border-seum";

  return (
    <div className="relative">
      {multiline ? (
        <textarea
          value={val}
          disabled={pending}
          rows={2}
          onChange={(e) => setVal(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.target as HTMLTextAreaElement).blur();
            }
          }}
          placeholder={placeholder}
          className={`${cls} resize-y`}
        />
      ) : (
        <input
          value={val}
          disabled={pending}
          onChange={(e) => setVal(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          placeholder={placeholder}
          className={cls}
        />
      )}
      {saved && <span className="absolute -right-3 top-1 text-xs text-green-600">✓</span>}
    </div>
  );
}

export function CallDeleteButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`'${name}' 전화 고객을 삭제할까요?\n삭제하면 되돌릴 수 없습니다.`))
          return;
        startTransition(() => deleteCallLead(id));
      }}
      className="whitespace-nowrap rounded-lg px-2 py-1 text-xs font-medium text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      {pending ? "삭제중…" : "🗑 삭제"}
    </button>
  );
}
