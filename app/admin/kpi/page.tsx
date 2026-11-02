import Link from "next/link";
import {
  createServiceClient,
  hasSupabaseEnv,
  LOGS_TABLE,
  CALLS_TABLE,
  VISITS_TABLE,
} from "@/lib/supabase/server";
import { requireAuth } from "@/lib/require-auth";
import { isMissingTable } from "@/lib/db-errors";
import { SALES_LOGS_SQL } from "@/lib/sales-logs-sql";
import type { SalesLog } from "@/lib/types";
import { formatManWon } from "@/lib/format";
import { addDays, dateLabel, isDateStr, kstDayStartISO, kstToday } from "@/lib/kst";
import {
  computeKpi,
  dueFollowUps,
  KPI_WEIGHTS,
  PERIODS,
  periodRange,
  pct,
  type FollowUpRow,
  type KpiRow,
  type PeriodKey,
} from "@/lib/kpi";
import AppNav from "@/app/AppNav";
import SetupSqlNotice from "@/app/SetupSqlNotice";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type Search = { period?: string; from?: string; to?: string };

export default async function KpiPage({ searchParams }: { searchParams: Search }) {
  await requireAuth("/admin/kpi");

  const custom = isDateStr(searchParams.from) && isDateStr(searchParams.to);
  const periodKey: PeriodKey = custom
    ? "custom"
    : PERIODS.some((p) => p.key === searchParams.period)
      ? (searchParams.period as PeriodKey)
      : "month";
  const [from, to] = periodRange(periodKey, searchParams.from, searchParams.to);
  const today = kstToday();

  const shell = (body: React.ReactNode) => (
    <main className="mx-auto max-w-none px-4 py-6">
      <AppNav active="kpi" />
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">📈 영업 KPI</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            영업일지 기록으로 자동 집계 · {dateLabel(from)} ~ {dateLabel(to)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 text-sm font-semibold shadow-sm">
            {PERIODS.map((p) => (
              <Link
                key={p.key}
                href={`/admin/kpi?period=${p.key}`}
                className={`rounded-lg px-3 py-1.5 ${
                  periodKey === p.key ? "bg-seum text-white" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {p.label}
              </Link>
            ))}
          </div>
          <form action="/admin/kpi" className="flex items-center gap-1 text-sm">
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 outline-none focus:border-seum"
            />
            <span className="text-gray-400">~</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 outline-none focus:border-seum"
            />
            <button
              className={`rounded-lg px-3 py-1.5 font-semibold ${
                periodKey === "custom" ? "bg-seum text-white" : "bg-gray-900 text-white"
              }`}
            >
              조회
            </button>
          </form>
        </div>
      </div>
      <div className="mt-5 space-y-5">{body}</div>
    </main>
  );

  if (!hasSupabaseEnv()) return shell(<p className="text-sm text-gray-400">Supabase 연결이 필요합니다.</p>);
  const supabase = createServiceClient();
  const fromISO = kstDayStartISO(from);
  const toISO = kstDayStartISO(addDays(to, 1));

  const [logsRes, fuRes, visitRes, callRes] = await Promise.all([
    supabase.from(LOGS_TABLE).select("*").gte("log_date", from).lte("log_date", to).limit(20000),
    supabase
      .from(LOGS_TABLE)
      .select("id,salesperson,customer_name,phone,phone_digits,stage,next_action_date,next_action,log_date,created_at")
      .not("next_action_date", "is", null)
      .limit(20000),
    supabase
      .from(VISITS_TABLE)
      .select("assigned_to")
      .not("assigned_to", "is", null)
      .gte("submitted_at", fromISO)
      .lt("submitted_at", toISO)
      .limit(5000),
    supabase
      .from(CALLS_TABLE)
      .select("salesperson")
      .not("salesperson", "is", null)
      .gte("called_at", fromISO)
      .lt("called_at", toISO)
      .limit(5000),
  ]);

  if (logsRes.error) {
    return shell(
      isMissingTable(logsRes.error, "sales_logs") ? (
        <SetupSqlNotice
          title="영업일지 테이블"
          table="sales_logs"
          sql={SALES_LOGS_SQL}
          message={logsRes.error.message}
          after="영업일지 기록이 KPI로 집계됩니다."
        />
      ) : (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          불러오기 실패: {logsRes.error.message}
        </div>
      )
    );
  }

  const logs = (logsRes.data ?? []) as SalesLog[];

  // 후속 연락 지연: 고객별 최신 기록의 다음 연락일이 어제 이전인데 진행 중
  const overdue = new Map<string, number>();
  for (const f of dueFollowUps((fuRes.data ?? []) as FollowUpRow[], addDays(today, -1)))
    overdue.set(f.salesperson, (overdue.get(f.salesperson) ?? 0) + 1);

  // 배정 리드: 기간 내 방문예약(담당 영업사원) + 전화 고객(영업사원)
  const assigned = new Map<string, number>();
  const addAssigned = (name: unknown) => {
    const n = String(name ?? "").trim();
    if (n) assigned.set(n, (assigned.get(n) ?? 0) + 1);
  };
  for (const r of visitRes.data ?? []) addAssigned((r as { assigned_to?: string }).assigned_to);
  for (const r of callRes.data ?? []) addAssigned((r as { salesperson?: string }).salesperson);

  const rows = computeKpi(logs, { overdue, assigned });
  const team = computeKpi(
    logs.map((l) => ({ ...l, salesperson: "팀 전체" })),
    {
      overdue: new Map([["팀 전체", Array.from(overdue.values()).reduce((a, b) => a + b, 0)]]),
      assigned: new Map([["팀 전체", Array.from(assigned.values()).reduce((a, b) => a + b, 0)]]),
    }
  )[0];
  const maxScore = Math.max(1, ...rows.map((r) => r.score));

  return shell(
    <>
      {/* 팀 합계 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile label="KPI 점수 (팀)" value={fmt(team?.score ?? 0)} accent />
        <Tile label="총 활동" value={fmt(team?.total ?? 0)} unit="건" />
        <Tile label="신규 고객" value={fmt(team?.newCustomers ?? 0)} unit="명" />
        <Tile label="대면 상담 (방문·현장)" value={fmt((team?.visit ?? 0) + (team?.site ?? 0))} unit="건" />
        <Tile label="계약" value={fmt(team?.contract ?? 0)} unit="건" sub={team?.amount ? formatManWon(team.amount) : undefined} />
        <Tile label="계약 전환율" value={pct(team?.contractRate ?? 0)} sub={`상담 고객 ${fmt(team?.customers ?? 0)}명 중`} />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-400">
          이 기간에 기록된 영업일지가 없습니다.{" "}
          <Link href="/admin/logs" className="font-semibold text-seum underline">
            영업일지 쓰러 가기 →
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full min-w-[1100px] text-left text-xs">
            <thead className="border-b border-gray-100 bg-gray-50 text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">순위</th>
                <th className="px-3 py-2 font-medium">영업사원</th>
                <th className="w-[18%] px-3 py-2 font-medium">KPI 점수</th>
                <Th>일지 작성일</Th>
                <Th>총 활동</Th>
                <Th>상담 고객</Th>
                <Th>신규</Th>
                <Th>전화</Th>
                <Th>방문</Th>
                <Th>현장</Th>
                <Th>견적</Th>
                <Th>계약</Th>
                <Th>계약 금액</Th>
                <Th>계약 전환율</Th>
                <Th>대면율</Th>
                <Th>배정 리드</Th>
                <Th>연락 지연</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r, i) => (
                <KpiTr key={r.salesperson} r={r} rank={i + 1} maxScore={maxScore} from={from} to={to} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-xs leading-relaxed text-gray-500">
        <p className="font-semibold text-gray-700">KPI 계산 기준</p>
        <p className="mt-1">
          <b>KPI 점수</b> = 신규 고객 ×{KPI_WEIGHTS.newCustomer} + 전화상담 ×{KPI_WEIGHTS.call} + 문자·카톡 ×
          {KPI_WEIGHTS.message} + 방문상담 ×{KPI_WEIGHTS.visit} + 현장답사 ×{KPI_WEIGHTS.site} + 견적제출 ×
          {KPI_WEIGHTS.quote} + 계약 ×{KPI_WEIGHTS.contract}
        </p>
        <p>
          <b>상담 고객</b>: 기간 내 일지에 기록된 고객 수(같은 연락처는 1명) · <b>신규</b>: 처음 기록된 연락처 ·{" "}
          <b>계약 전환율</b>: 계약 고객 ÷ 상담 고객 · <b>대면율</b>: 방문·현장 상담 고객 ÷ 상담 고객
        </p>
        <p>
          <b>배정 리드</b>: 기간 내 방문예약의 담당 영업사원 + 전화 고객의 영업사원으로 지정된 건수 ·{" "}
          <b>연락 지연</b>: 다음 연락일이 지났는데 계약·이탈이 아닌 고객 수(기간 무관, 현재 기준)
        </p>
      </div>
    </>
  );
}

const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString("ko-KR");

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-2 text-right font-medium">{children}</th>;
}

function Td({ children, strong, warn }: { children: React.ReactNode; strong?: boolean; warn?: boolean }) {
  return (
    <td
      className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${
        warn ? "font-semibold text-red-600" : strong ? "font-semibold text-gray-900" : "text-gray-600"
      }`}
    >
      {children}
    </td>
  );
}

function KpiTr({
  r,
  rank,
  maxScore,
  from,
  to,
}: {
  r: KpiRow;
  rank: number;
  maxScore: number;
  from: string;
  to: string;
}) {
  const medal =
    r.score <= 0 ? "-" : rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank);
  const w = r.score > 0 ? Math.max(2, (r.score / maxScore) * 100) : 0;
  return (
    <tr className="hover:bg-gray-50/50">
      <td className="px-3 py-2.5 text-center text-sm">{medal}</td>
      <td className="whitespace-nowrap px-3 py-2.5">
        <Link
          href={`/admin/logs?${new URLSearchParams({ sp: r.salesperson, date: to })}`}
          className="text-sm font-semibold text-gray-900 hover:text-seum"
          title={`${from} ~ ${to} 일지 보기`}
        >
          {r.salesperson}
        </Link>
      </td>
      <td className="px-3 py-2.5" title={`KPI 점수 ${fmt(r.score)}점`}>
        <div className="flex items-center gap-2">
          <div className="h-2.5 flex-1 rounded-full bg-gray-100">
            <div className="h-2.5 rounded-full bg-seum" style={{ width: `${w}%` }} />
          </div>
          <span className="w-10 text-right text-sm font-bold tabular-nums text-gray-900">{fmt(r.score)}</span>
        </div>
      </td>
      <Td>{r.days}일</Td>
      <Td strong>{r.total}</Td>
      <Td>{r.customers}</Td>
      <Td>{r.newCustomers}</Td>
      <Td>{r.call}</Td>
      <Td>{r.visit}</Td>
      <Td>{r.site}</Td>
      <Td>{r.quote}</Td>
      <Td strong>{r.contract}</Td>
      <Td>{r.amount ? formatManWon(r.amount) : "-"}</Td>
      <Td>{r.customers ? pct(r.contractRate) : "-"}</Td>
      <Td>{r.customers ? pct(r.meetRate) : "-"}</Td>
      <Td>{r.assigned || "-"}</Td>
      <Td warn={r.overdue > 0}>{r.overdue ? `${r.overdue}명` : "-"}</Td>
    </tr>
  );
}

function Tile({
  label,
  value,
  unit,
  sub,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${accent ? "border-seum bg-seum-light" : "border-gray-200 bg-white"}`}>
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${accent ? "text-seum-dark" : "text-gray-900"}`}>
        {value}
        {unit && <span className="ml-0.5 text-sm font-semibold text-gray-400">{unit}</span>}
      </div>
      {sub && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}
