"use client";

import { useState, useTransition } from "react";
import { updateMemo, updateAssignee } from "../actions";

const inputClass =
  "w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm outline-none focus:border-seum";

export function MemoEditor({ id, memo }: { id: string; memo: string | null }) {
  const [value, setValue] = useState(memo ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div>
      <textarea
        rows={5}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        className={inputClass}
        placeholder="상담 메모를 입력하세요"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await updateMemo(id, value);
              setSaved(true);
            })
          }
          className="rounded-lg bg-seum px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "저장 중..." : "메모 저장"}
        </button>
        {saved && <span className="text-xs text-green-600">저장됨 ✓</span>}
      </div>
    </div>
  );
}

export function AssigneeEditor({
  id,
  assignee,
}: {
  id: string;
  assignee: string | null;
}) {
  const [value, setValue] = useState(assignee ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        placeholder="담당자명"
        className={inputClass}
      />
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await updateAssignee(id, value);
            setSaved(true);
          })
        }
        className="shrink-0 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "..." : "지정"}
      </button>
      {saved && <span className="shrink-0 text-xs text-green-600">✓</span>}
    </div>
  );
}
