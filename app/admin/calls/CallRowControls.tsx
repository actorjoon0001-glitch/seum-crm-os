"use client";

import { useState, useTransition } from "react";
import { updateCallField, deleteCallLead } from "./actions";
import { CALL_STATUSES, callStatusMeta } from "@/lib/types";

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

// 칸 단위 편집: blur / Enter 시 저장
export function CallTextInput({
  id,
  field,
  value,
  placeholder,
  multiline,
}: {
  id: string;
  field: "salesperson" | "memo";
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
