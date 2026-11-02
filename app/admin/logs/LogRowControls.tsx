"use client";

import { useState, useTransition } from "react";
import { updateLogField, deleteSalesLog } from "./actions";
import { LOG_STAGES, stageMeta } from "@/lib/types";

export function StageSelect({ id, stage }: { id: string; stage: string }) {
  const [value, setValue] = useState(stage);
  const [pending, startTransition] = useTransition();
  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        setValue(next);
        startTransition(() => updateLogField(id, "stage", next));
      }}
      className={`w-full cursor-pointer rounded-full border-0 px-2 py-1 text-xs font-semibold outline-none ring-1 ring-inset ring-black/5 ${stageMeta(value).color} ${pending ? "opacity-50" : ""}`}
    >
      {LOG_STAGES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

export function NextDateInput({ id, value }: { id: string; value: string | null }) {
  const [val, setVal] = useState(value || "");
  const [pending, startTransition] = useTransition();
  return (
    <input
      type="date"
      value={val}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        setVal(next);
        startTransition(() => updateLogField(id, "next_action_date", next));
      }}
      className="w-full rounded-lg border border-gray-200 bg-white px-1.5 py-1 text-xs outline-none focus:border-seum"
    />
  );
}

export function LogDeleteButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`'${name}' 일지 기록을 삭제할까요?\n삭제하면 KPI에서도 빠집니다.`)) return;
        startTransition(() => deleteSalesLog(id));
      }}
      className="whitespace-nowrap rounded-lg px-2 py-1 text-xs font-medium text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      {pending ? "…" : "🗑"}
    </button>
  );
}
