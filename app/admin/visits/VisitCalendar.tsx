import Link from "next/link";
import type { VisitReservation } from "@/lib/types";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
const isDate = (s: string | null | undefined) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");

// 데이터가 있는 달을 기본으로 열어줌 (오늘 이후 가장 가까운 방문, 없으면 마지막 방문)
export function defaultVisitMonth(rows: VisitReservation[], today: Date): string {
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const dates = rows
    .map((r) => r.visit_date)
    .filter(isDate)
    .sort() as string[];
  if (dates.length === 0)
    return `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
  const future = dates.find((d) => d >= todayStr);
  return (future || dates[dates.length - 1]).slice(0, 7);
}

function monthUrl(ym: string, params: Record<string, string>) {
  const sp = new URLSearchParams({ view: "calendar", month: ym });
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  return `/admin/visits?${sp.toString()}`;
}

export default function VisitCalendar({
  rows,
  month,
  todayStr,
  params,
}: {
  rows: VisitReservation[];
  month: string; // YYYY-MM
  todayStr: string; // YYYY-MM-DD
  params: Record<string, string>;
}) {
  const [year, m] = month.split("-").map(Number); // m: 1-indexed
  const monthIdx = m - 1;

  // 날짜별 방문 그룹
  const byDate = new Map<string, VisitReservation[]>();
  for (const r of rows) {
    if (!isDate(r.visit_date)) continue;
    const key = r.visit_date as string;
    if (key.slice(0, 7) !== month) continue;
    const arr = byDate.get(key) ?? [];
    arr.push(r);
    byDate.set(key, arr);
  }
  Array.from(byDate.values()).forEach((arr) =>
    arr.sort((a, b) => (a.visit_time || "").localeCompare(b.visit_time || ""))
  );

  const firstWeekday = new Date(year, monthIdx, 1).getDay();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const prevYm = monthIdx === 0 ? `${year - 1}-12` : `${year}-${pad(m - 1)}`;
  const nextYm = monthIdx === 11 ? `${year + 1}-01` : `${year}-${pad(m + 1)}`;
  const monthCount = Array.from(byDate.values()).reduce((s, a) => s + a.length, 0);

  return (
    <div className="mt-4">
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between">
        <Link
          href={monthUrl(prevYm, params)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          ‹ 이전달
        </Link>
        <div className="text-lg font-bold">
          {year}년 {m}월
          <span className="ml-2 text-sm font-normal text-gray-400">
            방문 {monthCount}건
          </span>
        </div>
        <Link
          href={monthUrl(nextYm, params)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          다음달 ›
        </Link>
      </div>

      {/* 요일 헤더 */}
      <div className="mt-3 grid grid-cols-7 gap-px overflow-hidden rounded-t-xl border border-gray-200 bg-gray-200 text-center text-xs font-semibold">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`bg-gray-50 py-2 ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-500"}`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* 날짜 셀 */}
      <div className="grid grid-cols-7 gap-px rounded-b-xl border border-t-0 border-gray-200 bg-gray-200">
        {cells.map((d, i) => {
          if (d === null)
            return <div key={i} className="min-h-[96px] bg-gray-50/50" />;
          const dateKey = `${year}-${pad(m)}-${pad(d)}`;
          const visits = byDate.get(dateKey) ?? [];
          const isToday = dateKey === todayStr;
          const weekday = i % 7;
          return (
            <div key={i} className="min-h-[96px] bg-white p-1.5">
              <div
                className={`text-xs font-semibold ${
                  isToday
                    ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-seum text-white"
                    : weekday === 0
                      ? "text-red-500"
                      : weekday === 6
                        ? "text-blue-500"
                        : "text-gray-600"
                }`}
              >
                {d}
              </div>
              <div className="mt-1 space-y-1">
                {visits.map((v) => (
                  <Link
                    key={v.id}
                    href={`/admin/visits/${v.id}`}
                    className="block truncate rounded bg-seum-light px-1.5 py-0.5 text-[11px] font-medium text-seum-dark hover:bg-seum hover:text-white"
                    title={`${v.visit_time || ""} ${v.name || ""} (${v.visitor_count || "-"})`}
                  >
                    {v.visit_time ? `${v.visit_time} ` : ""}
                    {v.name || "(이름없음)"}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
