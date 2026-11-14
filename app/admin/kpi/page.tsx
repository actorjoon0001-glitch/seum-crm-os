import Link from "next/link";
import {
  createServiceClient,
  hasSupabaseEnv,
  SALES_CUSTOMERS_TABLE as CUST,
  SALES_CUSTOMER_LOGS_TABLE as LOGS,
} from "@/lib/supabase/server";
import { requireAuth } from "@/lib/require-auth";
import { isMissingTable } from "@/lib/db-errors";
import { SALES_DB_SQL } from "@/lib/sales-db-sql";
import {
  computeKpi,
  GRADES,
  INFLOW_ROUTES,
  KPI_STAGES,
  KPI_WEIGHTS,
  PERIODS,
  periodRange,
  pct,
  STAGES,
  type KpiRow,
  type PeriodKey,
  type SalesCustomer,
  type SalesCustomerLog,
} from "@/lib/sales-db";
import { getSalespeople, groupByBranch, NO_BRANCH } from "@/lib/staff";
import { dateLabel, isDateStr } from "@/lib/kst";
import AppNav from "@/app/AppNav";
import SetupSqlNotice from "@/app/SetupSqlNotice";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type Search = { period?: string; from?: string; to?: string; branch?: string };

export default async function KpiPage({ searchParams }: { searchParams: Search }) {
  await requireAuth("/admin/kpi");
  const custom = isDateStr(searchParams.from) && isDateStr(searchParams.to);
  const periodKey: PeriodKey = custom
    ? "custom"
    : PERIODS.some((p) => p.key === searchParams.period)
      ? (searchParams.period as PeriodKey)
      : "month";
  const [from, to] = periodRange(periodKey, searchParams.from, searchParams.to);

  const shell = (body: React.ReactNode) => (
    <main className="mx-auto max-w-none px-4 py-6">
      <AppNav active="kpi" />
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">📈 영업 KPI</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            고객 DB · 영업일지 기록으로 자동 집계 · {dateLabel(from)} ~ {dateLabel(to)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 text-sm font-semibold shadow-sm">
            {PERIODS.map((p) => (
              <Link
                key={p.key}
                href={`/admin/kpi?period=${p.key}${searchParams.branch ? `&branch=${encodeURIComponent(searchParams.branch)}` : ""}`}
                className={`rounded-lg px-3 py-1.5 ${periodKey === p.key ? "bg-seum text-white" : "text-gray-500 hover:text-gray-800"}`}
              >
                {p.label}
              </Link>
            ))}
          </div>
          <form action="/admin/kpi" className="flex items-center gap-1 text-sm">
            {searchParams.branch && <input type="hidden" name="branch" value={searchParams.branch} />}
            <input type="date" name="from" defaultValue={from} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5" />
            <span className="text-gray-400">~</span>
            <input type="date" name="to" defaultValue={to} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5" />
            <button className={`rounded-lg px-3 py-1.5 font-semibold text-white ${periodKey === "custom" ? "bg-seum" : "bg-gray-900"}`}>
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

  const [custRes, logRes] = await Promise.all([
    supabase
      .from(CUST)
      .select("*")
      .limit(50000),
    supabase
      .from(LOGS)
      .select("customer_id,assignee,log_date,kind,to_stage")
      .gte("log_date", from)
      .lte("log_date", to)
      .limit(50000),
  ]);
  if (custRes.error) {
    return shell(
      isMissingTable(custRes.error) ? (
        <SetupSqlNotice
          title="고객 DB 테이블"
          table="sales_customers"
          sql={SALES_DB_SQL}
          message={custRes.error.message}
          after="고객 DB · 일지 기록이 KPI로 집계됩니다."
        />
      ) : (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">불러오기 실패: {custRes.error.message}</div>
      )
    );
  }

  const allCustomers = (custRes.data ?? []) as SalesCustomer[];
  const allLogs = (logRes.data ?? []) as SalesCustomerLog[];
  const staff = await getSalespeople(supabase, Array.from(new Set(allCustomers.map((c) => c.assignee))));
  const groups = groupByBranch(staff);
  const branchOf = new Map(staff.map((s) => [s.name, s.branch?.trim() || NO_BRANCH]));
  const branch = (searchParams.branch ?? "").trim();
  const inBranch = (name: string) => !branch || (branchOf.get(name) ?? NO_BRANCH) === branch;
  const customers = allCustomers.filter((c) => inBranch(c.assignee));
  const logs = allLogs.filter((l) => inBranch(l.assignee));
  const people = staff.filter((s) => s.fromStaff && inBranch(s.name)).map((s) => s.name);
  const rows = computeKpi(customers, logs, from, to, people);
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams(
      periodKey === "custom" ? { from, to } : { period: periodKey }
    );
    for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
    return `/admin/kpi?${p}`;
  };
  const team = computeKpi(
    customers.map((c) => ({ ...c, assignee: "팀" })),
    logs.map((l) => ({ ...l, assignee: "팀" })),
    from,
    to
  )[0];
  const maxScore = Math.max(1, ...rows.map((r) => r.score));

  // 유입경로별 신규 DB (팀)
  const fresh = customers.filter((c) => c.received_date >= from && c.received_date <= to);
  const byRoute = INFLOW_ROUTES.map((r) => ({ label: r as string, n: fresh.filter((c) => c.inflow_route === r).length }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n);
  // 현재 진행단계 분포 (전체 보유 DB)
  const byStage = STAGES.map((s) => ({ label: s.value, n: customers.filter((c) => c.stage === s.value).length }));
  // 고객등급 분포 (진행 중 고객 기준)
  const openCustomers = customers.filter((c) => c.stage !== "계약완료" && c.stage !== "계약보류");
  const byGrade = [
    ...GRADES.map((g) => ({ label: `${g.value} ${g.desc}`, n: openCustomers.filter((c) => c.grade === g.value).length })),
    { label: "미분류", n: openCustomers.filter((c) => !c.grade).length },
  ];

  return shell(
    <>
      {/* 전시장 필터 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Link
          href={qs({})}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${!branch ? "bg-gray-900 text-white" : "border border-gray-200 bg-white text-gray-600 hover:text-seum"}`}
        >
          🏢 전체 전시장
        </Link>
        {groups.map((g) => (
          <Link
            key={g.branch}
            href={qs({ branch: g.branch })}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${branch === g.branch ? "bg-seum text-white" : "border border-gray-200 bg-white text-gray-600 hover:text-seum"}`}
          >
            {g.branch} <span className="text-xs opacity-70">{g.people.length}명</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile label={branch ? `KPI 점수 (${branch})` : "KPI 점수 (팀)"} value={fmt(team?.score ?? 0)} accent />
        <Tile label="신규 고객 DB" value={fmt(team?.newDb ?? 0)} unit="명" sub={`배정 ${team?.assigned ?? 0} · 개별 ${team?.personal ?? 0}`} />
        <Tile label="방문완료" value={fmt(team?.reached["방문완료"] ?? 0)} unit="명" sub={`방문전환율 ${pct(team?.visitRate ?? 0)}`} />
        <Tile label="견적발송" value={fmt(team?.reached["견적발송"] ?? 0)} unit="명" />
        <Tile label="계약완료" value={fmt(team?.reached["계약완료"] ?? 0)} unit="명" sub={`계약전환율 ${pct(team?.contractRate ?? 0)}`} />
        <Tile label="연락 지연" value={fmt(team?.overdue ?? 0)} unit="명" sub="다음 연락일 지난 진행중 고객" warn={(team?.overdue ?? 0) > 0} />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-400">
          집계할 데이터가 없습니다.{" "}
          <Link href="/admin/logs" className="font-semibold text-seum underline">
            고객 DB · 일지 쓰러 가기 →
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full min-w-[1150px] text-left text-xs">
            <thead className="border-b border-gray-100 bg-gray-50 text-gray-500">
              <tr>
                <th className="px-3 py-2 text-center font-medium">순위</th>
                <th className="px-3 py-2 font-medium">영업사원</th>
                <th className="px-3 py-2 font-medium">전시장</th>
                <th className="w-[17%] px-3 py-2 font-medium">KPI 점수</th>
                <Th>일지 작성일</Th>
                <Th>신규 DB</Th>
                <Th>배정/개별</Th>
                {KPI_STAGES.map((s) => (
                  <Th key={s}>{s}</Th>
                ))}
                <Th>방문전환율</Th>
                <Th>계약전환율</Th>
                <Th>진행중</Th>
                <Th>보유 DB</Th>
                <Th>연락 지연</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r, i) => (
                <KpiTr key={r.assignee} r={r} rank={i + 1} maxScore={maxScore} branch={branchOf.get(r.assignee) ?? NO_BRANCH} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <BarList title="유입경로별 신규 DB (기간 내)" items={byRoute} empty="기간 내 신규 DB가 없습니다." />
        <BarList title="진행단계 현황 (현재 보유 DB 전체)" items={byStage} empty="고객 DB가 없습니다." />
        <BarList title="고객등급 현황 (진행 중 고객)" items={byGrade} empty="진행 중 고객이 없습니다." wide />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-xs leading-relaxed text-gray-500">
        <p className="font-semibold text-gray-700">KPI 계산 기준</p>
        <p className="mt-1">
          <b>KPI 점수</b> = 신규 DB ×{KPI_WEIGHTS.newDb} + 일지 작성일 ×{KPI_WEIGHTS.logDay} + 방문예정 ×{KPI_WEIGHTS["방문예정"]} +
          방문완료 ×{KPI_WEIGHTS["방문완료"]} + 견적발송 ×{KPI_WEIGHTS["견적발송"]} + 계약협의 ×{KPI_WEIGHTS["계약협의"]} + 계약완료 ×
          {KPI_WEIGHTS["계약완료"]}
        </p>
        <p>
          <b>신규 DB</b>: 접수일이 기간 안인 고객 · <b>방문예정~계약완료</b>: 기간 안에 그 단계로 진행(또는 그 단계로 등록)한 고객 수 ·{" "}
          <b>일지 작성일</b>: 등록·단계변경·상담기록을 남긴 날짜 수
        </p>
        <p>
          <b>방문전환율 / 계약전환율</b>: 방문완료 · 계약완료 고객 ÷ 신규 DB · <b>진행중 / 보유 DB / 연락 지연</b>: 기간과 무관한 현재 기준
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

function KpiTr({ r, rank, maxScore, branch }: { r: KpiRow; rank: number; maxScore: number; branch: string }) {
  const medal = r.score <= 0 ? "-" : rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank);
  const w = r.score > 0 ? Math.max(2, (r.score / maxScore) * 100) : 0;
  return (
    <tr className="hover:bg-gray-50/50">
      <td className="px-3 py-2.5 text-center text-sm">{medal}</td>
      <td className="whitespace-nowrap px-3 py-2.5">
        <Link href={`/admin/logs?sp=${encodeURIComponent(r.assignee)}`} className="text-sm font-semibold text-gray-900 hover:text-seum">
          {r.assignee}
        </Link>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-gray-500">{branch}</td>
      <td className="px-3 py-2.5" title={`KPI 점수 ${fmt(r.score)}점`}>
        <div className="flex items-center gap-2">
          <div className="h-2.5 flex-1 rounded-full bg-gray-100">
            <div className="h-2.5 rounded-full bg-seum" style={{ width: `${w}%` }} />
          </div>
          <span className="w-10 text-right text-sm font-bold tabular-nums text-gray-900">{fmt(r.score)}</span>
        </div>
      </td>
      <Td>{r.logDays}일</Td>
      <Td strong>{r.newDb}</Td>
      <Td>
        {r.assigned}/{r.personal}
      </Td>
      {KPI_STAGES.map((s) => (
        <Td key={s} strong={s === "계약완료"}>
          {r.reached[s]}
        </Td>
      ))}
      <Td>{r.newDb ? pct(r.visitRate) : "-"}</Td>
      <Td>{r.newDb ? pct(r.contractRate) : "-"}</Td>
      <Td>{r.open}</Td>
      <Td>{r.total}</Td>
      <Td warn={r.overdue > 0}>{r.overdue ? `${r.overdue}명` : "-"}</Td>
    </tr>
  );
}

function BarList({
  title,
  items,
  empty,
  wide,
}: {
  title: string;
  items: { label: string; n: number }[];
  empty: string;
  wide?: boolean;
}) {
  const max = Math.max(1, ...items.map((i) => i.n));
  const total = items.reduce((a, i) => a + i.n, 0);
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold text-gray-800">{title}</h2>
      {total === 0 ? (
        <p className="mt-3 text-sm text-gray-400">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {items.map((i) => (
            <li key={i.label} className="flex items-center gap-2 text-xs" title={`${i.label} ${i.n}명`}>
              <span className={`${wide ? "w-44 truncate" : "w-16"} shrink-0 text-gray-600`}>{i.label}</span>
              <div className="h-3 flex-1 rounded bg-gray-100">
                {i.n > 0 && <div className="h-3 rounded bg-seum" style={{ width: `${Math.max(2, (i.n / max) * 100)}%` }} />}
              </div>
              <span className="w-14 shrink-0 text-right tabular-nums text-gray-700">
                {i.n}명 <span className="text-gray-400">{pct(i.n / total)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Tile({
  label,
  value,
  unit,
  sub,
  accent,
  warn,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${accent ? "border-seum bg-seum-light" : "border-gray-200 bg-white"}`}>
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${accent ? "text-seum-dark" : warn ? "text-red-600" : "text-gray-900"}`}>
        {value}
        {unit && <span className="ml-0.5 text-sm font-semibold text-gray-400">{unit}</span>}
      </div>
      {sub && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}
