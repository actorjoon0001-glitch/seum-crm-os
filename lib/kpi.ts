// 영업일지(sales_logs) → 영업사원별 KPI 계산
import type { SalesLog } from "@/lib/types";
import { addDays, kstToday } from "@/lib/kst";

// KPI 점수 가중치 — 활동 1건당 점수. 회사 기준에 맞게 여기 숫자만 바꾸면 됩니다.
export const KPI_WEIGHTS = {
  newCustomer: 2, // 신규 고객 1명
  call: 1, // 전화상담
  message: 0.5, // 문자·카톡
  visit: 5, // 방문상담
  site: 5, // 현장답사
  quote: 10, // 견적제출
  contract: 30, // 계약
} as const;

export type PeriodKey = "today" | "week" | "month" | "lastmonth" | "custom";

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "오늘" },
  { key: "week", label: "이번 주" },
  { key: "month", label: "이번 달" },
  { key: "lastmonth", label: "지난 달" },
];

// 기간 → [from, to] (둘 다 포함, YYYY-MM-DD, KST)
export function periodRange(key: PeriodKey, from?: string, to?: string): [string, string] {
  const today = kstToday();
  const d = new Date(`${today}T00:00:00Z`);
  switch (key) {
    case "today":
      return [today, today];
    case "week": {
      const dow = (d.getUTCDay() + 6) % 7; // 월요일=0
      return [addDays(today, -dow), today];
    }
    case "lastmonth": {
      const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
      const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0));
      return [first.toISOString().slice(0, 10), last.toISOString().slice(0, 10)];
    }
    case "custom":
      if (from && to) return from <= to ? [from, to] : [to, from];
      return periodRange("month");
    case "month":
    default:
      return [today.slice(0, 8) + "01", today];
  }
}

// 동일 고객 판별 키: 연락처 숫자 → 없으면 이름
export function customerKey(r: Pick<SalesLog, "phone_digits" | "customer_name">): string {
  if (r.phone_digits) return `p:${r.phone_digits}`;
  return `n:${(r.customer_name ?? "").trim()}`;
}

export interface KpiRow {
  salesperson: string;
  days: number; // 일지 작성일수
  total: number; // 총 활동
  customers: number; // 상담 고객(중복 제외)
  newCustomers: number;
  call: number;
  message: number;
  visit: number;
  site: number;
  quote: number;
  contract: number;
  amount: number; // 계약 금액(만원)
  contractRate: number; // 계약 고객 / 상담 고객
  meetRate: number; // 대면(방문·현장) 고객 / 상담 고객
  overdue: number; // 후속 연락 지연
  assigned: number; // 배정 리드(방문예약·전화고객)
  score: number;
}

export function computeKpi(
  rows: SalesLog[],
  opts: { overdue?: Map<string, number>; assigned?: Map<string, number> } = {}
): KpiRow[] {
  const by = new Map<string, SalesLog[]>();
  for (const r of rows) {
    const sp = r.salesperson?.trim() || "(미지정)";
    if (!by.has(sp)) by.set(sp, []);
    by.get(sp)!.push(r);
  }
  // 배정만 있고 일지가 없는 영업사원도 표에 노출
  for (const sp of Array.from(opts.assigned?.keys() ?? [])) if (!by.has(sp)) by.set(sp, []);

  const out: KpiRow[] = [];
  for (const [sp, list] of Array.from(by.entries())) {
    const count = (a: string) => list.filter((r) => r.activity === a).length;
    const keys = new Set(list.map(customerKey));
    const contracted = new Set(
      list.filter((r) => r.activity === "contract" || r.stage === "contracted").map(customerKey)
    );
    const met = new Set(
      list.filter((r) => r.activity === "visit" || r.activity === "site").map(customerKey)
    );
    const row: KpiRow = {
      salesperson: sp,
      days: new Set(list.map((r) => r.log_date)).size,
      total: list.length,
      customers: keys.size,
      newCustomers: list.filter((r) => r.is_new).length,
      call: count("call"),
      message: count("message"),
      visit: count("visit"),
      site: count("site"),
      quote: count("quote"),
      contract: count("contract"),
      amount: list.reduce(
        (a, r) => a + (r.activity === "contract" ? Number(r.contract_amount) || 0 : 0),
        0
      ),
      contractRate: keys.size ? contracted.size / keys.size : 0,
      meetRate: keys.size ? met.size / keys.size : 0,
      overdue: opts.overdue?.get(sp) ?? 0,
      assigned: opts.assigned?.get(sp) ?? 0,
      score: 0,
    };
    const w = KPI_WEIGHTS;
    row.score =
      row.newCustomers * w.newCustomer +
      row.call * w.call +
      row.message * w.message +
      row.visit * w.visit +
      row.site * w.site +
      row.quote * w.quote +
      row.contract * w.contract;
    out.push(row);
  }
  return out.sort((a, b) => b.score - a.score || b.total - a.total);
}

export type FollowUpRow = Pick<
  SalesLog,
  | "id"
  | "salesperson"
  | "customer_name"
  | "phone"
  | "phone_digits"
  | "stage"
  | "next_action_date"
  | "next_action"
  | "log_date"
  | "created_at"
>;

// 고객별 "가장 최근 기록" 기준으로, 다음 연락일이 기준일 이하이고 아직 진행 중인 고객
export function dueFollowUps(rows: FollowUpRow[], until: string): FollowUpRow[] {
  const latest = new Map<string, FollowUpRow>();
  for (const r of rows) {
    const k = `${r.salesperson}|${customerKey(r)}`;
    const cur = latest.get(k);
    if (
      !cur ||
      r.log_date > cur.log_date ||
      (r.log_date === cur.log_date && r.created_at > cur.created_at)
    )
      latest.set(k, r);
  }
  return Array.from(latest.values())
    .filter(
      (r) =>
        r.next_action_date &&
        r.next_action_date <= until &&
        r.stage !== "contracted" &&
        r.stage !== "lost"
    )
    .sort((a, b) => (a.next_action_date! < b.next_action_date! ? -1 : 1));
}

export const pct = (v: number) => `${Math.round(v * 100)}%`;
