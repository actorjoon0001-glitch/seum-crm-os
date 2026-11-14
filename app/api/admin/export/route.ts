import { NextRequest, NextResponse } from "next/server";
import {
  createServiceClient,
  hasSupabaseEnv,
  VISITS_TABLE,
  CALLS_TABLE,
  SALES_CUSTOMERS_TABLE,
  SALES_CUSTOMER_LOGS_TABLE,
} from "@/lib/supabase/server";
import { isOwner } from "@/lib/require-auth";
import { ACTIVITY_TABLE } from "@/lib/activity";
import { kstToday } from "@/lib/kst";

export const dynamic = "force-dynamic";

type Col = [header: string, get: (r: Record<string, unknown>) => unknown];

const kst = (v: unknown) =>
  typeof v === "string" && v
    ? new Date(v).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false })
    : "";
const p = (r: Record<string, unknown>, k: string) => {
  const pl = r.payload;
  const obj = typeof pl === "object" && pl ? (pl as Record<string, unknown>) : {};
  return obj[k] ?? "";
};

const EXPORTS: Record<string, { file: string; table: string; order: string; filter?: [string, string]; cols: Col[] }> = {
  customers: {
    file: "고객DB",
    table: SALES_CUSTOMERS_TABLE,
    order: "db_no",
    cols: [
      ["DB번호", (r) => r.db_no],
      ["접수일", (r) => r.received_date],
      ["고객명", (r) => r.customer_name],
      ["연락처", (r) => r.phone],
      ["지역", (r) => r.region],
      ["유입구분", (r) => r.inflow_type],
      ["유입경로", (r) => r.inflow_route],
      ["관심제품", (r) => r.interest_product],
      ["예상예산", (r) => r.budget],
      ["담당지점", (r) => r.branch],
      ["배정담당자", (r) => r.assignee],
      ["진행단계", (r) => r.stage],
      ["고객등급", (r) => r.grade],
      ["최근 상담내용", (r) => r.memo],
      ["최근 기록일", (r) => r.last_contact_date],
      ["다음 연락일", (r) => r.next_action_date],
    ],
  },
  logs: {
    file: "영업일지",
    table: SALES_CUSTOMER_LOGS_TABLE,
    order: "created_at",
    cols: [
      ["날짜", (r) => r.log_date],
      ["기록시각", (r) => kst(r.created_at)],
      ["영업사원", (r) => r.assignee],
      ["구분", (r) => ({ created: "신규 등록", stage: "단계 변경", note: "상담 기록", grade: "등급 변경" })[String(r.kind)] ?? r.kind],
      ["이전", (r) => r.from_stage],
      ["변경", (r) => r.to_stage],
      ["내용", (r) => r.note],
      ["고객ID", (r) => r.customer_id],
    ],
  },
  visits: {
    file: "방문예약",
    table: VISITS_TABLE,
    order: "submitted_at",
    cols: [
      ["접수일시", (r) => kst(r.submitted_at)],
      ["고객명", (r) => r.name || p(r, "name")],
      ["연락처", (r) => r.phone || p(r, "phone")],
      ["방문일", (r) => r.visit_date || p(r, "visitDate")],
      ["방문시간", (r) => r.visit_time || p(r, "visitTime")],
      ["전시장", (r) => p(r, "showroom")],
      ["관심유형", (r) => p(r, "houseType") || r.interest_type],
      ["평수", (r) => p(r, "pyeong") || r.size],
      ["예산", (r) => r.budget || p(r, "budget")],
      ["토지보유", (r) => r.land_owned || p(r, "landOwned")],
      ["토지주소", (r) => p(r, "landAddress") || r.addr_jibun],
      ["고객메모", (r) => r.memo || p(r, "memo")],
      ["상태", (r) => r.status],
      ["담당영업사원", (r) => r.assigned_to],
      ["직원메모", (r) => p(r, "staffMemo")],
    ],
  },
  calls_main: {
    file: "대표번호_전화고객",
    table: CALLS_TABLE,
    order: "called_at",
    filter: ["channel", "main"],
    cols: callCols(),
  },
  calls_mobile: {
    file: "영업폰_전화고객",
    table: CALLS_TABLE,
    order: "called_at",
    filter: ["channel", "mobile"],
    cols: callCols(),
  },
  activity: {
    file: "로그인_활동기록",
    table: ACTIVITY_TABLE,
    order: "created_at",
    cols: [
      ["일시", (r) => kst(r.created_at)],
      ["구분", (r) => r.kind],
      ["이름", (r) => r.actor],
      ["권한", (r) => (r.role === "owner" ? "관리자" : r.role === "staff" ? "직원" : "")],
      ["내용", (r) => r.detail],
      ["IP", (r) => r.ip],
      ["기기", (r) => r.user_agent],
    ],
  },
};

function callCols(): Col[] {
  return [
    ["통화일시", (r) => kst(r.called_at)],
    ["고객명", (r) => r.name],
    ["연락처", (r) => r.phone],
    ["영업사원", (r) => r.salesperson],
    ["지역", (r) => r.region],
    ["문의내용", (r) => r.inquiry],
    ["상태", (r) => r.status],
    ["직원메모", (r) => r.memo],
  ];
}

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// 관리자 전용 CSV 내보내기 (엑셀 한글 깨짐 방지용 BOM 포함)
export async function GET(req: NextRequest) {
  if (!(await isOwner())) return new NextResponse("관리자만 내려받을 수 있습니다.", { status: 403 });
  if (!hasSupabaseEnv()) return new NextResponse("Supabase 연결이 필요합니다.", { status: 500 });

  const type = req.nextUrl.searchParams.get("type") ?? "";
  const ex = EXPORTS[type];
  if (!ex) return new NextResponse("잘못된 요청입니다.", { status: 400 });

  const supabase = createServiceClient();
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < 100000; from += 1000) {
    let q = supabase.from(ex.table).select("*").order(ex.order, { ascending: false }).range(from, from + 999);
    if (ex.filter) q = q.eq(ex.filter[0], ex.filter[1]);
    const { data, error } = await q;
    if (error) return new NextResponse(`내보내기 실패: ${error.message}`, { status: 500 });
    rows.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < 1000) break;
  }

  const lines = [ex.cols.map(([h]) => esc(h)).join(","), ...rows.map((r) => ex.cols.map(([, get]) => esc(get(r))).join(","))];
  const filename = `${ex.file}_${kstToday()}.csv`;
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="export.csv"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
