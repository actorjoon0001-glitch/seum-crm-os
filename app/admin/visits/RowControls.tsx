"use client";

import { useState, useTransition } from "react";
import {
  updateVisitStatus,
  updateVisitAssignee,
  updateVisitStaffMemo,
  updateVisitBranch,
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
      className={`w-full cursor-pointer rounded-full border-0 px-2 py-1 text-xs font-semibold outline-none ring-1 ring-inset ring-black/5 ${meta.color} ${pending ? "opacity-50" : ""}`}
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
        className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs outline-none focus:border-seum"
      />
      {saved && (
        <span className="absolute -right-4 top-1.5 text-xs text-green-600">✓</span>
      )}
    </div>
  );
}

// 방문예약 → 전시장으로 넘기기 (선택하면 그 전시장 잔디 영업팀 토픽에 알림)
export function VisitBranchSelect({
  id,
  branch,
  handedAt,
  handedBy,
  branches,
}: {
  id: string;
  branch: string | null;
  handedAt: string | null;
  handedBy?: string | null;
  branches: string[];
}) {
  const [value, setValue] = useState(branch ?? "");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sentBy, setSentBy] = useState<string | null>(null);
  const opts = value && !branches.includes(value) ? [value, ...branches] : branches;
  return (
    <div>
      <select
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          const prev = value;
          if (next && !window.confirm(`이 방문예약을 [${next}]으로 넘길까요?\n${next} 잔디 영업팀 토픽으로 알림이 갑니다.`)) return;
          setValue(next);
          setErr(null);
          startTransition(async () => {
            try {
              const res = await updateVisitBranch(id, next);
              setSent(!!next);
              setSentBy(res?.by ?? null);
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
        <option value="">선택</option>
        {opts.map((b) => (
          <option key={b} value={b}>
            → {b}
          </option>
        ))}
      </select>
      {sent && (
        <div className="mt-0.5 text-[10px] text-green-600">
          ✓ {sentBy ? <b className="font-semibold">{sentBy}</b> : null} 넘김 · 잔디 알림
        </div>
      )}
      {!sent && value && handedAt && (
        <div className="mt-0.5 text-[10px] text-gray-400">
          {new Date(handedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}{" "}
          {handedBy ? <b className="font-semibold text-gray-600">{handedBy}</b> : null} 넘김
        </div>
      )}
      {err && <div className="mt-0.5 text-[10px] leading-tight text-red-600">{err}</div>}
    </div>
  );
}

export function StaffMemoInput({
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
      await updateVisitStaffMemo(id, val.trim());
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
        placeholder="직원 메모"
        className="w-full resize-y rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs outline-none focus:border-seum"
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
      className="whitespace-nowrap rounded-lg px-2 py-1 text-xs font-medium text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      {pending ? "삭제중…" : "🗑 삭제"}
    </button>
  );
}
