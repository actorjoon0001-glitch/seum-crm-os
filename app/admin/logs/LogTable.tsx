import Link from "next/link";
import type { SalesLog } from "@/lib/types";
import { activityMeta, sourceMeta } from "@/lib/types";
import { formatManWon } from "@/lib/format";
import { dateLabel } from "@/lib/kst";
import { StageSelect, NextDateInput, LogDeleteButton } from "./LogRowControls";

export function customerHref(r: Pick<SalesLog, "phone_digits" | "customer_name">) {
  const p = new URLSearchParams();
  if (r.phone_digits) p.set("phone", r.phone_digits);
  else p.set("name", r.customer_name ?? "");
  return `/admin/logs/customer?${p}`;
}

// 영업일지 기록 표 (일지 화면 · 고객 이력 화면 공용)
export default function LogTable({
  rows,
  showSalesperson,
  showDate,
}: {
  rows: SalesLog[];
  showSalesperson?: boolean;
  showDate?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full min-w-[900px] table-fixed text-left text-xs">
        <colgroup>
          {showDate && <col className="w-[7%]" />}
          {showSalesperson && <col className="w-[7%]" />}
          <col className="w-[12%]" />
          <col className="w-[8%]" />
          <col className="w-[7%]" />
          <col className="w-[8%]" />
          <col className="w-[12%]" />
          <col />
          <col className="w-[16%]" />
          <col className="w-[4%]" />
        </colgroup>
        <thead className="border-b border-gray-100 bg-gray-50 text-gray-500">
          <tr>
            {showDate && <th className="px-2.5 py-2 font-medium">날짜</th>}
            {showSalesperson && <th className="px-2.5 py-2 font-medium">영업사원</th>}
            <th className="px-2.5 py-2 font-medium">고객</th>
            <th className="px-2.5 py-2 font-medium">유입경로</th>
            <th className="px-2.5 py-2 font-medium">활동</th>
            <th className="px-2.5 py-2 font-medium">단계</th>
            <th className="px-2.5 py-2 font-medium">지역 · 관심</th>
            <th className="px-2.5 py-2 font-medium">상담 내용</th>
            <th className="px-2.5 py-2 font-medium">다음 연락</th>
            <th className="px-2.5 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((r) => {
            const name = r.customer_name || "(이름없음)";
            const act = activityMeta(r.activity);
            return (
              <tr key={r.id} className="align-top hover:bg-gray-50/50">
                {showDate && (
                  <td className="whitespace-nowrap px-2.5 py-2 text-gray-500">{dateLabel(r.log_date)}</td>
                )}
                {showSalesperson && (
                  <td className="px-2.5 py-2 font-medium text-gray-700">{r.salesperson}</td>
                )}
                <td className="px-2.5 py-2">
                  <Link href={customerHref(r)} className="font-semibold text-gray-900 hover:text-seum">
                    {name}
                  </Link>
                  {r.is_new && (
                    <span className="ml-1 rounded bg-seum-light px-1 text-[10px] font-bold text-seum-dark">
                      신규
                    </span>
                  )}
                  {r.phone && (
                    <a href={`tel:${r.phone}`} className="block text-gray-400 hover:text-seum">
                      {r.phone}
                    </a>
                  )}
                </td>
                <td className="px-2.5 py-2 text-gray-500">{r.source ? sourceMeta(r.source).label : "-"}</td>
                <td className="px-2.5 py-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${act.color}`}>
                    {act.label}
                  </span>
                  {r.activity === "contract" && r.contract_amount ? (
                    <div className="mt-0.5 font-semibold text-emerald-700">{formatManWon(r.contract_amount)}</div>
                  ) : null}
                </td>
                <td className="px-2.5 py-2">
                  <StageSelect id={r.id} stage={r.stage} />
                </td>
                <td className="break-words px-2.5 py-2 text-gray-600">
                  {[r.region, r.interest].filter(Boolean).join(" · ") || "-"}
                </td>
                <td className="whitespace-pre-wrap break-words px-2.5 py-2 text-gray-600">{r.memo || "-"}</td>
                <td className="px-2.5 py-2">
                  <NextDateInput id={r.id} value={r.next_action_date} />
                  {r.next_action && <div className="mt-0.5 break-words text-gray-500">{r.next_action}</div>}
                </td>
                <td className="px-1 py-2 text-right">
                  <LogDeleteButton id={r.id} name={name} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
