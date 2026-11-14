// 영업 고객 DB (엑셀 '고객 DB 관리' 양식) — 타입 · 선택값 · KPI 계산
import { addDays, kstToday } from "@/lib/kst";

export interface SalesCustomer {
  id: string;
  db_no: string | null;
  received_date: string;
  customer_name: string | null;
  phone: string | null;
  phone_digits: string | null;
  region: string | null;
  inflow_type: string | null;
  inflow_route: string | null;
  interest_product: string | null;
  budget: string | null;
  branch: string | null;
  assignee: string;
  stage: string;
  memo: string | null;
  last_contact_date: string | null;
  next_action_date: string | null;
  source_ref: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface SalesCustomerLog {
  id: string;
  customer_id: string;
  assignee: string;
  log_date: string;
  kind: "created" | "stage" | "note";
  from_stage: string | null;
  to_stage: string | null;
  note: string | null;
  created_at: string;
}

// *유입구분
export const INFLOW_TYPES = ["배정", "개별"] as const;

// *유입경로
export const INFLOW_ROUTES = [
  "네이버",
  "유튜브",
  "블로그",
  "인스타그램",
  "온라인예약",
  "현장방문",
  "지인소개",
  "기존고객",
  "광고",
  "대표번호",
  "기타",
] as const;

// *진행단계 (순서대로)
export const STAGES: { value: string; color: string }[] = [
  { value: "1차상담", color: "bg-sky-100 text-sky-700" },
  { value: "방문예정", color: "bg-blue-100 text-blue-700" },
  { value: "방문완료", color: "bg-indigo-100 text-indigo-700" },
  { value: "견적발송", color: "bg-amber-100 text-amber-700" },
  { value: "계약협의", color: "bg-orange-100 text-orange-700" },
  { value: "계약보류", color: "bg-gray-200 text-gray-600" },
  { value: "계약완료", color: "bg-emerald-600 text-white" },
];

export const stageColor = (v: string | null | undefined) =>
  STAGES.find((s) => s.value === v)?.color ?? "bg-gray-100 text-gray-500";
export const isStage = (v: string) => STAGES.some((s) => s.value === v);
// 진행 중(종결 아님)
export const isOpenStage = (v: string) => v !== "계약완료" && v !== "계약보류";

// KPI 점수 가중치 — 숫자만 바꾸면 회사 기준으로 조정됩니다.
export const KPI_WEIGHTS = {
  newDb: 2, // 신규 고객 DB 등록 1명
  logDay: 1, // 일지 작성일 1일
  방문예정: 2,
  방문완료: 5,
  견적발송: 10,
  계약협의: 10,
  계약완료: 30,
} as const;

export const KPI_STAGES = ["방문예정", "방문완료", "견적발송", "계약협의", "계약완료"] as const;
type KpiStage = (typeof KPI_STAGES)[number];

export type PeriodKey = "today" | "week" | "month" | "lastmonth" | "custom";
export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "오늘" },
  { key: "week", label: "이번 주" },
  { key: "month", label: "이번 달" },
  { key: "lastmonth", label: "지난 달" },
];

export function periodRange(key: PeriodKey, from?: string, to?: string): [string, string] {
  const today = kstToday();
  const d = new Date(`${today}T00:00:00Z`);
  switch (key) {
    case "today":
      return [today, today];
    case "week":
      return [addDays(today, -((d.getUTCDay() + 6) % 7)), today];
    case "lastmonth": {
      const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
      const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0));
      return [first.toISOString().slice(0, 10), last.toISOString().slice(0, 10)];
    }
    case "custom":
      if (from && to) return from <= to ? [from, to] : [to, from];
      return periodRange("month");
    default:
      return [today.slice(0, 8) + "01", today];
  }
}

export interface KpiRow {
  assignee: string;
  logDays: number; // 일지 작성일수
  newDb: number; // 신규 DB
  assigned: number; // 신규 중 배정
  personal: number; // 신규 중 개별
  reached: Record<KpiStage, number>; // 기간 내 해당 단계로 진행한 고객 수
  open: number; // 현재 진행 중 고객 (기간 무관)
  total: number; // 보유 고객 DB 전체 (기간 무관)
  overdue: number; // 다음 연락일 지난 진행 중 고객
  visitRate: number; // 방문완료 / 신규 DB
  contractRate: number; // 계약완료 / 신규 DB
  score: number;
}

// customers: 전체 고객 DB, logs: 기간 내 일지 기록
export function computeKpi(
  customers: Pick<SalesCustomer, "id" | "assignee" | "received_date" | "inflow_type" | "stage" | "next_action_date">[],
  logs: Pick<SalesCustomerLog, "customer_id" | "assignee" | "log_date" | "kind" | "to_stage">[],
  from: string,
  to: string,
  people: string[] = []
): KpiRow[] {
  const today = kstToday();
  const names = new Set<string>(people);
  customers.forEach((c) => names.add(c.assignee));
  logs.forEach((l) => names.add(l.assignee));

  const rows: KpiRow[] = [];
  for (const name of Array.from(names)) {
    const mine = customers.filter((c) => c.assignee === name);
    const fresh = mine.filter((c) => c.received_date >= from && c.received_date <= to);
    const myLogs = logs.filter((l) => l.assignee === name);
    const reached = {} as Record<KpiStage, number>;
    for (const st of KPI_STAGES) {
      const ids = new Set(
        myLogs.filter((l) => l.to_stage === st && (l.kind === "stage" || l.kind === "created")).map((l) => l.customer_id)
      );
      reached[st] = ids.size;
    }
    const open = mine.filter((c) => isOpenStage(c.stage));
    const row: KpiRow = {
      assignee: name,
      logDays: new Set(myLogs.map((l) => l.log_date)).size,
      newDb: fresh.length,
      assigned: fresh.filter((c) => c.inflow_type === "배정").length,
      personal: fresh.filter((c) => c.inflow_type !== "배정").length,
      reached,
      open: open.length,
      total: mine.length,
      overdue: open.filter((c) => c.next_action_date && c.next_action_date < today).length,
      visitRate: fresh.length ? reached["방문완료"] / fresh.length : 0,
      contractRate: fresh.length ? reached["계약완료"] / fresh.length : 0,
      score: 0,
    };
    const w = KPI_WEIGHTS;
    row.score =
      row.newDb * w.newDb +
      row.logDays * w.logDay +
      KPI_STAGES.reduce((a, st) => a + row.reached[st] * w[st], 0);
    rows.push(row);
  }
  return rows.sort((a, b) => b.score - a.score || b.newDb - a.newDb || a.assignee.localeCompare(b.assignee, "ko"));
}

export const pct = (v: number) => `${Math.round(v * 100)}%`;
