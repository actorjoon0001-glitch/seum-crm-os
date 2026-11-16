// 잔디로 보낼 메시지 만들기: 아침 브리핑 · 새 방문예약 · 대표번호 문의 · 관리자 요약
import type { SupabaseClient } from "@supabase/supabase-js";
import { CALLS_TABLE, SALES_CUSTOMERS_TABLE, SALES_CUSTOMER_LOGS_TABLE, VISITS_TABLE } from "@/lib/supabase/server";
import { showroomLabel, type CallLead, type VisitReservation } from "@/lib/types";
import { isOpenStage, type SalesCustomer } from "@/lib/sales-db";
import { getBranches, getSalespeople, groupByBranch, NO_BRANCH } from "@/lib/staff";
import { isResultPending } from "@/lib/visit-pending";
import { getVisitPendingSince } from "@/lib/visit-pending-since";
import { vf } from "@/app/admin/visits/fields";
import { addDays, dateLabel, kstDayStartISO, kstShort, kstToday } from "@/lib/kst";
import { ACTIVITY_TABLE } from "@/lib/activity";
import { appUrl, type JandiMessage, type JandiSection } from "@/lib/jandi";

const MAX_LINES = 25;
const lines = (arr: string[], empty: string) =>
  arr.length === 0
    ? empty
    : arr.slice(0, MAX_LINES).join("\n") + (arr.length > MAX_LINES ? `\n…외 ${arr.length - MAX_LINES}건` : "");

// 방문예약의 전시장: 직원이 넘긴 전시장(handoffBranch) 우선, 없으면 고객이 고른 전시장
function visitRoom(r: VisitReservation): string | null {
  const handed = vf(r, ["handoffBranch"]);
  if (handed) return handed;
  const code = vf(r, ["showroom"]);
  return code ? showroomLabel(code) : null;
}

function visitLine(r: VisitReservation, withDate = false): string {
  const name = vf(r, ["name"], "name") || "(이름없음)";
  const date = vf(r, ["visitDate"], "visit_date");
  const time = vf(r, ["visitTime"], "visit_time");
  const room = visitRoom(r) ?? "전시장 미선택";
  const who = r.assigned_to ? `담당 ${r.assigned_to}` : "⚠ 담당 미배정";
  return `• ${withDate ? `${dateLabel(date)} ` : ""}${time || "시간 미정"} ${name} · ${room} · ${who}`;
}

export interface BriefResult {
  team: JandiMessage;
  branches: Map<string, JandiMessage>; // 전시장 이름 → 그 전시장 것만
  admin: JandiMessage;
}

// 매일 아침 브리핑 (영업팀 · 전시장별 · 관리자)
export async function buildDailyBrief(supabase: SupabaseClient): Promise<BriefResult> {
  const today = kstToday();
  const yesterday = addDays(today, -1);

  const [todayVisitsRes, openVisitsRes, custRes, ylogRes, actRes, staff, handedRes] = await Promise.all([
    supabase.from(VISITS_TABLE).select("*").eq("visit_date", today).limit(500),
    supabase.from(VISITS_TABLE).select("*").or("status.is.null,status.in.(new,scheduled)").limit(3000),
    supabase
      .from(SALES_CUSTOMERS_TABLE)
      .select("id,db_no,customer_name,assignee,stage,next_action_date")
      .lte("next_action_date", today)
      .limit(5000),
    supabase.from(SALES_CUSTOMER_LOGS_TABLE).select("assignee").eq("log_date", yesterday).limit(20000),
    supabase
      .from(ACTIVITY_TABLE)
      .select("kind,actor,detail")
      .gte("created_at", kstDayStartISO(yesterday))
      .lt("created_at", kstDayStartISO(today))
      .limit(5000),
    getSalespeople(supabase),
    // 대표번호에서 전시장으로 넘어왔는데 아직 '신규' 상태인 문의
    supabase.from(CALLS_TABLE).select("*").eq("channel", "main").not("branch", "is", null).eq("status", "new").limit(500),
  ]);
  const handed = ((handedRes.error ? [] : handedRes.data) ?? []) as CallLead[];

  const people = staff.filter((s) => s.fromStaff);
  const branchOf = new Map(people.map((p) => [p.name, p.branch?.trim() || NO_BRANCH]));
  const groups = groupByBranch(people);

  const todayVisits = ((todayVisitsRes.data ?? []) as VisitReservation[]).sort((a, b) =>
    (vf(a, ["visitTime"], "visit_time") || "").localeCompare(vf(b, ["visitTime"], "visit_time") || "")
  );
  const pendingSince = await getVisitPendingSince(supabase);
  const pending = ((openVisitsRes.data ?? []) as VisitReservation[]).filter((r) => isResultPending(r, today, pendingSince));
  const followUps = ((custRes.data ?? []) as SalesCustomer[]).filter((c) => isOpenStage(c.stage) && c.next_action_date);
  const wrote = new Set(((ylogRes.data ?? []) as { assignee: string }[]).map((r) => r.assignee));

  const build = (branch: string | null): JandiMessage => {
    const inBranchVisit = (r: VisitReservation) =>
      !branch || visitRoom(r) === branch || (r.assigned_to && branchOf.get(r.assigned_to) === branch);
    const inBranchPerson = (name: string) => !branch || branchOf.get(name) === branch;

    const tv = todayVisits.filter(inBranchVisit);
    const pv = pending.filter(inBranchVisit);
    const fu = followUps.filter((c) => inBranchPerson(c.assignee));

    // 영업사원별 연락할 고객
    const byPerson = new Map<string, string[]>();
    for (const c of fu.sort((a, b) => (a.next_action_date! < b.next_action_date! ? -1 : 1))) {
      const late = c.next_action_date! < today;
      const arr = byPerson.get(c.assignee) ?? [];
      arr.push(`${c.customer_name || "(이름없음)"}(${c.stage}${late ? ` ⚠${dateLabel(c.next_action_date)}` : ""})`);
      byPerson.set(c.assignee, arr);
    }
    const missed = (branch ? groups.filter((g) => g.branch === branch) : groups)
      .map((g) => ({ branch: g.branch, names: g.people.filter((p) => !wrote.has(p.name)).map((p) => p.name) }))
      .filter((g) => g.names.length > 0);

    const hc = handed.filter((c) => !branch || c.branch === branch);
    const sections: JandiSection[] = [
      { title: `🏠 오늘 방문 예정 ${tv.length}건`, description: lines(tv.map((r) => visitLine(r)), "오늘 방문 예정 고객이 없습니다.") },
      {
        title: `⏰ 방문 결과 미입력 ${pv.length}건`,
        description: lines(pv.map((r) => visitLine(r, true)), "모두 입력되었습니다. 👍"),
      },
      {
        title: `📨 대표번호에서 넘어온 미처리 문의 ${hc.length}건`,
        description: lines(
          hc.map(
            (c) =>
              `• ${branch ? "" : `[${c.branch}] `}${c.name || "(이름없음)"}${c.phone ? ` ${c.phone}` : ""}${c.inquiry ? ` · ${c.inquiry}` : ""} · ${c.salesperson ? `담당 ${c.salesperson}` : "⚠ 담당 미배정"}`
          ),
          "없음"
        ),
      },
      {
        title: `📌 오늘 연락할 고객 ${fu.length}명 (⚠ = 연락일 지남)`,
        description: lines(
          Array.from(byPerson.entries()).map(([n, list]) => `• ${n}: ${list.join(", ")}`),
          "연락 예정 고객이 없습니다."
        ),
      },
      {
        title: `📝 어제(${dateLabel(yesterday)}) 일지 미작성 ${missed.reduce((a, g) => a + g.names.length, 0)}명`,
        description: lines(
          missed.map((g) => (branch ? g.names.join(", ") : `• ${g.branch}: ${g.names.join(", ")}`)),
          "모두 작성했습니다. 👏"
        ),
      },
    ];
    return {
      body: `☀️ [${branch ?? "세움 영업팀"}] ${dateLabel(today)} 아침 브리핑\n고객관리OS 바로가기: ${appUrl("/")}`,
      color: "#1F6FEB",
      sections,
    };
  };

  const branches = new Map<string, JandiMessage>();
  // 소속 직원이 없는 전시장(예: 3전시장)도 그 전시장을 고른 방문예약이 브리핑되도록 전체 전시장 기준
  for (const b of await getBranches(supabase)) branches.set(b, build(b));

  // 관리자 요약
  const acts = (actRes.data ?? []) as { kind: string; actor: string | null; detail: string | null }[];
  const logins = acts.filter((a) => a.kind === "login" || a.kind === "auto_login");
  const fails = acts.filter((a) => a.kind === "login_failed");
  const deletes = acts.filter((a) => a.kind === "delete");
  const wroteCount = people.filter((p) => wrote.has(p.name)).length;
  // 어느 전시장 토픽에도 안 가는 오늘 방문 (전시장 미선택 + 담당 미배정)
  const orphan = todayVisits.filter((r) => !visitRoom(r) || !r.assigned_to);
  const admin: JandiMessage = {
    body: `🛡️ [관리자] ${dateLabel(yesterday)} 고객관리OS 요약\n관리자 화면: ${appUrl("/admin/manage")}`,
    color: "#111827",
    sections: [
      {
        title: `🔐 로그인 ${logins.length}건 · ${new Set(logins.map((l) => l.actor || "-")).size}명`,
        description: Array.from(new Set(logins.map((l) => l.actor || "(이름 없음)"))).join(", ") || "접속 없음",
      },
      {
        title: `🚫 로그인 실패 ${fails.length}건`,
        description: lines(fails.map((f) => `• ${f.actor ?? "-"} — ${f.detail ?? ""}`), "없음"),
      },
      { title: `🗑 삭제 ${deletes.length}건`, description: lines(deletes.map((d) => `• ${d.actor ?? "-"}: ${d.detail ?? ""}`), "없음") },
      {
        title: `📝 일지 작성 ${wroteCount} / ${people.length}명`,
        description: `미작성: ${people.filter((p) => !wrote.has(p.name)).map((p) => p.name).join(", ") || "없음"}`,
      },
      { title: `⏰ 방문 결과 미입력 ${pending.length}건`, description: lines(pending.map((r) => visitLine(r, true)), "없음") },
      {
        title: `⚠ 오늘 방문 중 전시장 미선택 · 담당 미배정 ${orphan.length}건`,
        description: lines(orphan.map((r) => visitLine(r)), "없음"),
      },
    ],
  };

  return { team: build(null), branches, admin };
}

// 새 방문예약 알림
export function newVisitMessage(r: VisitReservation): { msg: JandiMessage; branch: string | null } {
  const name = vf(r, ["name"], "name") || "(이름없음)";
  const phone = vf(r, ["phone"], "phone");
  const room = visitRoom(r);
  const interest = [vf(r, ["houseType", "interestType"], "interest_type"), vf(r, ["pyeong", "size"], "size")]
    .filter(Boolean)
    .join(" · ");
  const land = [vf(r, ["landOwned"], "land_owned"), vf(r, ["landAddress", "addrJibun"], "addr_jibun")].filter(Boolean).join(" · ");
  const memo = vf(r, ["memo"], "memo");
  return {
    branch: room,
    msg: {
      body: `🏠 새 방문예약이 접수되었습니다 — ${name}`,
      color: "#10B981",
      sections: [
        {
          title: `${name}${phone ? ` · ${phone}` : ""}`,
          description: [
            `방문: ${vf(r, ["visitDate"], "visit_date") || "-"} ${vf(r, ["visitTime"], "visit_time") || ""}`,
            `전시장: ${room ?? "⚠ 전시장 미선택"}`,
            interest && `관심: ${interest}`,
            vf(r, ["budget"], "budget") && `예산: ${vf(r, ["budget"], "budget")}`,
            land && `토지: ${land}`,
            memo && `메모: ${memo}`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
        { title: "담당자 배정하기", description: appUrl(`/admin/visits/${r.id}`) },
      ],
    },
  };
}

// 대표번호 문의 등록 알림
export function newCallMessage(
  c: Pick<CallLead, "name" | "phone" | "inquiry" | "region" | "salesperson" | "called_at"> & { grade?: string | null },
  by: string | null
): JandiMessage {
  return {
    body: `☎️ 대표번호 문의가 등록되었습니다 — ${c.name || "(이름없음)"}`,
    color: "#F59E0B",
    sections: [
      {
        title: `${c.name || "(이름없음)"}${c.phone ? ` · ${c.phone}` : ""}`,
        description: [
          `통화: ${kstShort(c.called_at)}`,
          c.region && `지역: ${c.region}`,
          c.inquiry && `문의: ${c.inquiry}`,
          c.grade && `고객등급: ${c.grade}`,
          `담당: ${c.salesperson || "⚠ 미배정"}`,
          by && `등록: ${by}`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
      { title: "대표번호 고객 보기", description: appUrl("/admin/calls/main") },
    ],
  };
}

