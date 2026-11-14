"use client";

import { useState, useTransition } from "react";
import { addNote, changeGrade, changeStage, deleteCustomer, importAssigned, setNextDate } from "./actions";
import { GRADES, STAGES, gradeColor, stageColor } from "@/lib/sales-db";

export function StageSelect({ id, stage }: { id: string; stage: string }) {
  const [value, setValue] = useState(stage);
  const [pending, start] = useTransition();
  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        setValue(next);
        start(() => changeStage(id, next));
      }}
      className={`w-full cursor-pointer rounded-full border-0 px-2 py-1 text-xs font-semibold outline-none ring-1 ring-inset ring-black/5 ${stageColor(value)} ${pending ? "opacity-50" : ""}`}
    >
      {STAGES.map((s) => (
        <option key={s.value}>{s.value}</option>
      ))}
    </select>
  );
}

export function GradeSelect({ id, grade }: { id: string; grade: string | null | undefined }) {
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
              await changeGrade(id, next);
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

// 오늘 상담 내용 한 줄 기록 (Enter 저장)
export function NoteInput({ id }: { id: string }) {
  const [val, setVal] = useState("");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const save = () => {
    const t = val.trim();
    if (!t) return;
    start(async () => {
      await addNote(id, t);
      setVal("");
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  };
  return (
    <div className="relative">
      <input
        value={val}
        disabled={pending}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
        }}
        onBlur={save}
        placeholder="오늘 상담 내용 입력 후 Enter"
        className="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs outline-none focus:border-seum"
      />
      {saved && <span className="absolute -right-3 top-1 text-xs text-green-600">✓</span>}
    </div>
  );
}

export function NextDateInput({ id, value }: { id: string; value: string | null }) {
  const [val, setVal] = useState(value || "");
  const [pending, start] = useTransition();
  return (
    <input
      type="date"
      value={val}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        setVal(next);
        start(() => setNextDate(id, next));
      }}
      className="w-full rounded-md border border-gray-200 bg-white px-1 py-1 text-xs outline-none focus:border-seum"
    />
  );
}

export function DeleteButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`'${name}' 고객을 삭제할까요?\n일지 기록도 함께 삭제되고 KPI에서 빠집니다.`)) return;
        start(() => deleteCustomer(id));
      }}
      className="rounded-md px-1.5 py-1 text-xs text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      title="삭제"
    >
      {pending ? "…" : "🗑"}
    </button>
  );
}

export function ImportButton({ refId, assignee, branch }: { refId: string; assignee: string; branch: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await importAssigned(refId, assignee, branch);
            setMsg(r.ok ? "✓" : r.error ?? "실패");
          })
        }
        className="rounded-md bg-seum px-2 py-1 text-xs font-semibold text-white hover:bg-seum-dark disabled:opacity-50"
      >
        {pending ? "추가중…" : "내 DB에 추가"}
      </button>
      {msg && <span className={`text-xs ${msg === "✓" ? "text-green-600" : "text-red-600"}`}>{msg}</span>}
    </span>
  );
}
