"use client";

import { useState, useTransition } from "react";
import {
  updateVisitStatus,
  updateVisitAssignee,
  updateVisitMemo,
  deleteVisit,
} from "./actions";
import { VISIT_STATUSES, statusMeta } from "./fields";

export function StatusSelect({
  id,
  status,
}: {
  id: string;
  status: string | null;
}) {
  const [value, setValue] = useState(status || "new");
  const [pending, startTransition] = useTransition();
  const meta = statusMeta(value);

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        setValue(next);
        startTransition(() => updateVisitStatus(id, next));
      }}
      className={`cursor-pointer rounded-full border-0 px-2.5 py-1 text-xs font-semibold outline-none ring-1 ring-inset ring-black/5 ${meta.color} ${pending ? "opacity-50" : ""}`}
    >
      {VISIT_STATUSES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

export function AssigneeInput({
  id,
  value,
}: {
  id: string;
  value: string | null;
}) {
  const [val, setVal] = useState(value || "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const save = () => {
    if (val === (value || "")) return;
    startTransition(async () => {
      await updateVisitAssignee(id, val);
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
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        placeholder="담당자"
        className="w-24 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs outline-none focus:border-seum"
      />
      {saved && (
        <span className="absolute -right-4 top-1.5 text-xs text-green-600">✓</span>
      )}
    </div>
  );
}

export function MemoInput({
  id,
  value,
}: {
  id: string;
  value: string | null;
}) {
  const [val, setVal] = useState(value || "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const save = () => {
    if (val === (value || "")) return;
    startTransition(async () => {
      await updateVisitMemo(id, val.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  };

  return (
    <div className="relative">
      <textarea
        value={val}
        disabled={pending}
        rows={2}
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          // Enter=저장(줄바꿈은 Shift+Enter)
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            (e.target as HTMLTextAreaElement).blur();
          }
        }}
        placeholder="메모 입력"
        className="w-44 resize-y rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs outline-none focus:border-seum"
      />
      {saved && (
        <span className="absolute -right-3 top-1 text-xs text-green-600">✓</span>
      )}
    </div>
  );
}

export function DeleteButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`'${name}' 방문예약을 삭제할까요?\n삭제하면 되돌릴 수 없습니다.`))
          return;
        startTransition(() => deleteVisit(id));
      }}
      title="삭제"
      className="rounded-lg px-2 py-1 text-xs font-medium text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      {pending ? "삭제중…" : "🗑 삭제"}
    </button>
  );
}
