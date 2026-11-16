"use client";

import { Fragment, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveAccess, type ActionResult } from "./actions";

export interface AccessRow {
  id: string;
  name: string;
  team: string | null;
  position: string | null;
  branch: string | null; // 소속 전시장
  isAdmin: boolean;
  scope: "own" | "all" | "branches";
  branches: string[];
}

function Save() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-seum disabled:opacity-50">
      {pending ? "저장중…" : "권한 저장"}
    </button>
  );
}

function Row({ r, i, allBranches }: { r: AccessRow; i: number; allBranches: string[] }) {
  const [scope, setScope] = useState(r.scope);
  return (
    <tr className="align-top">
      <td className="whitespace-nowrap px-2 py-1.5 font-semibold text-gray-800">
        <input type="hidden" name={`eid_${i}`} value={r.id} />
        {r.name}
        {r.position && <span className="ml-1 text-xs font-normal text-gray-400">{r.position}</span>}
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 text-gray-500">{r.team || "-"}</td>
      <td className="whitespace-nowrap px-2 py-1.5 text-gray-600">{r.branch || <span className="text-amber-600">미지정</span>}</td>
      <td className="px-2 py-1.5">
        {r.isAdmin ? (
          <span className="rounded bg-gray-900 px-2 py-0.5 text-xs font-bold text-white">관리자 · 전체</span>
        ) : (
          <div className="space-y-1">
            <select
              name={`scope_${i}`}
              value={scope}
              onChange={(e) => setScope(e.target.value as AccessRow["scope"])}
              className={`rounded-md border px-2 py-1 text-xs ${scope === "own" ? "border-gray-300" : "border-indigo-400 bg-indigo-50 font-semibold text-indigo-800"}`}
            >
              <option value="own">기본 · 소속 전시장만{r.branch ? ` (${r.branch})` : " (본인 고객만)"}</option>
              <option value="branches">소속 + 지정한 전시장</option>
              <option value="all">전체 전시장</option>
            </select>
            {scope === "branches" && (
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {allBranches
                  .filter((b) => b !== r.branch)
                  .map((b) => (
                    <label key={b} className="inline-flex items-center gap-1 text-xs text-gray-700">
                      <input type="checkbox" name={`br_${i}`} value={b} defaultChecked={r.branches.includes(b)} />
                      {b}
                    </label>
                  ))}
              </div>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

export default function AccessSettings({ rows, allBranches }: { rows: AccessRow[]; allBranches: string[] }) {
  const [state, action] = useFormState<ActionResult | null, FormData>(saveAccess, null);
  const [q, setQ] = useState("");
  const shown = rows.filter((r) => !q || r.name.includes(q) || (r.branch ?? "").includes(q) || (r.team ?? "").includes(q));
  return (
    <form action={action}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이름 · 전시장 · 팀 검색"
          className="w-48 rounded-lg border border-gray-300 px-2 py-1 text-xs outline-none focus:border-seum"
        />
        <span className="text-xs text-gray-500">
          넓은 권한 {rows.filter((r) => !r.isAdmin && r.scope !== "own").length}명 · 기본 {rows.filter((r) => !r.isAdmin && r.scope === "own").length}명
        </span>
      </div>
      <div className="max-h-[480px] overflow-auto rounded-lg border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-2 py-1.5 font-medium">이름</th>
              <th className="px-2 py-1.5 font-medium">팀</th>
              <th className="px-2 py-1.5 font-medium">소속</th>
              <th className="px-2 py-1.5 font-medium">보기 범위</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r, i) =>
              shown.includes(r) ? (
                <Fragment key={r.id}>
                  {/* 전시장이 바뀌는 곳마다 전시장 제목 줄 */}
                  {(shown.indexOf(r) === 0 || shown[shown.indexOf(r) - 1].branch !== r.branch) && (
                    <tr className="bg-seum-light/60">
                      <td colSpan={4} className="px-2 py-1.5 text-xs font-bold text-seum-dark">
                        🏢 {r.branch ?? "전시장 미지정"}{" "}
                        <span className="font-medium text-gray-500">
                          {rows.filter((x) => x.branch === r.branch).length}명
                        </span>
                      </td>
                    </tr>
                  )}
                  <Row r={r} i={i} allBranches={allBranches} />
                </Fragment>
              ) : (
                // 검색으로 가려진 행도 기존 값이 유지되도록 숨겨서 전송
                <tr key={r.id} className="hidden">
                  <td>
                    <input type="hidden" name={`eid_${i}`} value={r.id} />
                    {!r.isAdmin && <input type="hidden" name={`scope_${i}`} value={r.scope} />}
                    {r.branches.map((b) => (
                      <input key={b} type="hidden" name={`br_${i}`} value={b} />
                    ))}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Save />
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state?.ok && <span className="text-sm text-green-600">✓ {state.message}</span>}
      </div>
    </form>
  );
}
