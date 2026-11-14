import Link from "next/link";
import { cookies } from "next/headers";
import {
  createServiceClient,
  hasSupabaseEnv,
  SALES_CUSTOMERS_TABLE as CUST,
  SALES_CUSTOMER_LOGS_TABLE as LOGS,
  VISITS_TABLE,
  CALLS_TABLE,
} from "@/lib/supabase/server";
import { requireAuth } from "@/lib/require-auth";
import { SP_COOKIE } from "@/lib/auth";
import { isMissingTable } from "@/lib/db-errors";
import { SALES_DB_SQL } from "@/lib/sales-db-sql";
import { STAGES, isOpenStage, stageColor, type SalesCustomer, type SalesCustomerLog } from "@/lib/sales-db";
import { getSalespeople } from "@/lib/staff";
import { addDays, dateLabel, isDateStr, kstToday } from "@/lib/kst";
import AppNav from "@/app/AppNav";
import SetupSqlNotice from "@/app/SetupSqlNotice";
import CustomerForm from "./CustomerForm";
import { StageSelect, NoteInput, NextDateInput, DeleteButton, ImportButton } from "./RowControls";
import LogText from "./LogText";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type Search = { sp?: string; date?: string; q?: string; stage?: string };
type LogWithCustomer = SalesCustomerLog & {
  sales_customers: { customer_name: string | null; db_no: string | null } | null;
};

export default async function SalesDbPage({ searchParams }: { searchParams: Search }) {
  await requireAuth("/admin/logs");
  const today = kstToday();
  const date = isDateStr(searchParams.date) ? searchParams.date : today;
  const q = (searchParams.q ?? "").trim();
  const stageFilter = (searchParams.stage ?? "").trim();

  // 담당자: 주소 → 없으면 마지막으로 기록한 이름(쿠키)
  let sp = "";
  if (searchParams.sp !== undefined) sp = searchParams.sp.trim();
  else {
    try {
      sp = decodeURIComponent(cookies().get(SP_COOKIE)?.value ?? "");
    } catch {
      sp = "";
    }
  }

  const shell = (body: React.ReactNode) => (
    <main className="mx-auto max-w-none px-4 py-6">
      <AppNav active="logs" />
      <div className="mt-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">📒 고객 DB 관리 · 영업일지</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            영업사원별로 고객을 등록하고, 매일 진행단계와 상담 내용을 기록하세요. 기록이 KPI로 자동 집계됩니다.
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-4">{body}</div>
    </main>
  );

  if (!hasSupabaseEnv()) return shell(<p className="text-sm text-gray-400">Supabase 연결이 필요합니다.</p>);
  const supabase = createServiceClient();

  // 전체 고객의 담당자 (탭 건수) + 오늘 기록한 담당자
  const [allRes, todayLogsRes] = await Promise.all([
    supabase.from(CUST).select("assignee").limit(20000),
    supabase.from(LOGS).select("assignee").eq("log_date", today).limit(20000),
  ]);
  if (allRes.error) {
    return shell(
      isMissingTable(allRes.error) ? (
        <SetupSqlNotice
          title="고객 DB 테이블"
          table="sales_customers"
          sql={SALES_DB_SQL}
          message={allRes.error.message}
          after="영업사원별 고객 DB와 일지를 바로 쓸 수 있습니다. (이전 영업일지 기록이 있으면 자동으로 옮겨집니다)"
        />
      ) : (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">불러오기 실패: {allRes.error.message}</div>
      )
    );
  }
  const countBy = new Map<string, number>();
  for (const r of (allRes.data ?? []) as { assignee: string }[])
    countBy.set(r.assignee, (countBy.get(r.assignee) ?? 0) + 1);
  const wroteToday = new Set(((todayLogsRes.data ?? []) as { assignee: string }[]).map((r) => r.assignee));

  const salespeople = await getSalespeople(supabase, Array.from(countBy.keys()));
  const me = salespeople.find((s) => s.name === sp);
  const notWritten = salespeople.filter((s) => s.fromStaff && !wroteToday.has(s.name));

  // 고객 DB 시트
  let custQ = supabase
    .from(CUST)
    .select("*")
    .order("received_date", { ascending: false })
    .order("db_no", { ascending: false })
    .limit(2000);
  if (sp) custQ = custQ.eq("assignee", sp);
  if (stageFilter) custQ = custQ.eq("stage", stageFilter);
  if (q) {
    const s = q.replace(/[,()]/g, " ");
    custQ = custQ.or(
      `customer_name.ilike.%${s}%,phone.ilike.%${s}%,region.ilike.%${s}%,db_no.ilike.%${s}%,memo.ilike.%${s}%`
    );
  }

  // 선택 날짜의 일지
  let dayQ = supabase
    .from(LOGS)
    .select("*, sales_customers(customer_name,db_no)")
    .eq("log_date", date)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (sp) dayQ = dayQ.eq("assignee", sp);

  const [custRes, dayRes, visitRes, callRes] = await Promise.all([
    custQ,
    dayQ,
    sp
      ? supabase
          .from(VISITS_TABLE)
          .select("id,name,phone,submitted_at,payload")
          .eq("assigned_to", sp)
          .order("submitted_at", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
    sp
      ? supabase
          .from(CALLS_TABLE)
          .select("id,name,phone,called_at,channel,inquiry")
          .eq("salesperson", sp)
          .order("called_at", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const customers = (custRes.data ?? []) as SalesCustomer[];
  const dayLogs = (dayRes.data ?? []) as LogWithCustomer[];

  // 배정됐지만 아직 내 DB에 없는 고객
  type Pending = { ref: string; name: string; phone: string; when: string; label: string };
  const pending: Pending[] = [];
  if (sp) {
    const { data: mineAll } = await supabase.from(CUST).select("phone_digits,source_ref").eq("assignee", sp).limit(5000);
    const haveDigits = new Set((mineAll ?? []).map((r) => r.phone_digits).filter(Boolean));
    const haveRefs = new Set((mineAll ?? []).map((r) => r.source_ref).filter(Boolean));
    const has = (ref: string, phone: string | null) =>
      haveRefs.has(ref) || (phone ? haveDigits.has(phone.replace(/\D/g, "")) : false);
    for (const v of (visitRes.data ?? []) as { id: string; name: string | null; phone: string | null; submitted_at: string | null; payload: unknown }[]) {
      const p = (typeof v.payload === "object" && v.payload ? v.payload : {}) as Record<string, unknown>;
      const name = v.name || (typeof p.name === "string" ? p.name : "") || "(이름없음)";
      const phone = v.phone || (typeof p.phone === "string" ? p.phone : "");
      const ref = `visit:${v.id}`;
      if (!has(ref, phone)) pending.push({ ref, name, phone, when: (v.submitted_at ?? "").slice(0, 10), label: "🏠 방문예약" });
    }
    for (const c of (callRes.data ?? []) as { id: string; name: string | null; phone: string | null; called_at: string | null; channel: string }[]) {
      const ref = `call:${c.id}`;
      if (!has(ref, c.phone))
        pending.push({
          ref,
          name: c.name || "(이름없음)",
          phone: c.phone ?? "",
          when: (c.called_at ?? "").slice(0, 10),
          label: c.channel === "main" ? "☎️ 대표번호" : "📱 핸드폰",
        });
    }
  }

  const followUps = sp
    ? customers
        .filter((c) => isOpenStage(c.stage) && c.next_action_date && c.next_action_date <= today)
        .sort((a, b) => (a.next_action_date! < b.next_action_date! ? -1 : 1))
    : [];

  const link = (p: Record<string, string>) => `/admin/logs?${new URLSearchParams({ sp, ...p })}`;
  const tabCls = (on: boolean) =>
    `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
      on ? "bg-gray-900 text-white" : "border border-gray-200 bg-white text-gray-600 hover:border-seum hover:text-seum"
    }`;

  return shell(
    <>
      {/* 영업사원 탭 — 세움OS 영업팀 명단 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href="/admin/logs?sp=" className={tabCls(!sp)}>
            👥 전체 <span className="text-xs opacity-70">{allRes.data?.length ?? 0}</span>
          </Link>
          {salespeople.map((s) => (
            <Link key={s.name} href={`/admin/logs?sp=${encodeURIComponent(s.name)}`} className={tabCls(sp === s.name)}>
              <span
                className={`h-2 w-2 rounded-full ${wroteToday.has(s.name) ? "bg-emerald-500" : "bg-gray-300"}`}
                title={wroteToday.has(s.name) ? "오늘 일지 작성" : "오늘 일지 미작성"}
              />
              {s.name}
              <span className="text-xs opacity-70">{countBy.get(s.name) ?? 0}</span>
            </Link>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />오늘 일지 작성 {wroteToday.size}명
          {notWritten.length > 0 && (
            <>
              {" · "}
              <span className="text-orange-600">
                미작성 {notWritten.length}명: {notWritten.map((s) => s.name).join(", ")}
              </span>
            </>
          )}
          {salespeople.length === 0 && " · 세움OS 직원 명단(영업팀)을 불러오지 못했습니다."}
        </p>
      </div>

      {sp && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">
            담당자 : {sp}
            {me?.position && <span className="ml-1 text-sm font-medium text-gray-500">{me.position}</span>}
            {me?.branch && <span className="ml-2 text-sm font-medium text-gray-400">· {me.branch}</span>}
          </h2>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <Chip label="보유 DB" n={countBy.get(sp) ?? 0} strong />
            <Chip label="진행중" n={customers.filter((c) => isOpenStage(c.stage)).length} />
            <Chip label="계약완료" n={customers.filter((c) => c.stage === "계약완료").length} />
            <Chip label="오늘 기록" n={dayLogs.length} />
          </div>
        </div>
      )}

      <CustomerForm
        key={sp}
        mode="create"
        salespeople={salespeople}
        assignee={sp}
        branch={me?.branch ?? ""}
        today={today}
      />

      {pending.length > 0 && (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3">
          <h3 className="text-sm font-bold text-indigo-900">
            📥 {sp} 님에게 배정됐지만 아직 고객 DB에 없는 고객 {pending.length}명
          </h3>
          <ul className="mt-2 grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
            {pending.slice(0, 30).map((p) => (
              <li key={p.ref} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs shadow-sm">
                <span className="shrink-0 text-gray-500">{p.label}</span>
                <span className="min-w-0 flex-1 truncate">
                  <b className="text-gray-900">{p.name}</b> <span className="text-gray-400">{p.phone}</span>
                  <span className="ml-1 text-gray-400">{p.when}</span>
                </span>
                <ImportButton refId={p.ref} assignee={sp} branch={me?.branch ?? ""} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {followUps.length > 0 && (
        <section className="rounded-2xl border border-orange-200 bg-orange-50/60 p-3">
          <h3 className="text-sm font-bold text-orange-800">📌 오늘 연락할 고객 {followUps.length}명 (다음 연락일이 오늘이거나 지남)</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {followUps.map((c) => (
              <Link
                key={c.id}
                href={`/admin/logs/customer?id=${c.id}`}
                className="rounded-lg bg-white px-3 py-1.5 text-xs shadow-sm hover:ring-1 hover:ring-orange-300"
              >
                <b>{c.customer_name || "(이름없음)"}</b>{" "}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${stageColor(c.stage)}`}>{c.stage}</span>{" "}
                <span className={c.next_action_date! < today ? "font-semibold text-red-600" : "text-orange-700"}>
                  {dateLabel(c.next_action_date)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 고객 DB 시트 */}
      <section>
        <form action="/admin/logs" className="mb-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="sp" value={sp} />
          <input
            name="q"
            defaultValue={q}
            placeholder="고객명 · 연락처 · 지역 · DB번호"
            className="w-60 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-seum"
          />
          <select
            name="stage"
            defaultValue={stageFilter}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-seum"
          >
            <option value="">전체 진행단계</option>
            {STAGES.map((s) => (
              <option key={s.value}>{s.value}</option>
            ))}
          </select>
          <button className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white">검색</button>
          {(q || stageFilter) && (
            <Link href={link({})} className="text-sm text-gray-400 hover:text-gray-600">
              초기화
            </Link>
          )}
          <span className="ml-auto text-sm text-gray-500">{customers.length}명</span>
        </form>

        {customers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
            {q || stageFilter ? "조건에 맞는 고객이 없습니다." : "등록된 고객이 없습니다. 위 양식으로 1명씩 등록하세요."}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-300 bg-white shadow-sm">
            <table className="w-full min-w-[1200px] border-collapse text-xs">
              <thead className="text-gray-700">
                <tr className="bg-sky-100 text-center font-bold">
                  <th colSpan={5} className="border border-gray-300 py-1">기본정보</th>
                  <th colSpan={4} className="border border-gray-300 py-1">유입정보</th>
                  <th colSpan={3} className="border border-gray-300 py-1">영업진행</th>
                  <th colSpan={3} className="border border-gray-300 bg-amber-50 py-1">일지</th>
                </tr>
                <tr className="bg-sky-50 text-center font-semibold">
                  {["DB번호", "접수일", "고객명", "연락처", "지역", "*유입구분", "*유입경로", "관심제품", "예상예산", "담당지점", "배정담당자", "*진행단계"].map(
                    (h) => (
                      <th key={h} className="whitespace-nowrap border border-gray-300 px-2 py-1">
                        {h}
                      </th>
                    )
                  )}
                  <th className="border border-gray-300 bg-amber-50 px-2 py-1">최근 기록 · 오늘 기록</th>
                  <th className="whitespace-nowrap border border-gray-300 bg-amber-50 px-2 py-1">다음 연락</th>
                  <th className="border border-gray-300 bg-amber-50 px-1 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const name = c.customer_name || "(이름없음)";
                  return (
                    <tr key={c.id} className="align-top hover:bg-gray-50">
                      <td className="whitespace-nowrap border border-gray-200 px-2 py-1.5 text-center">
                        <Link href={`/admin/logs/customer?id=${c.id}`} className="font-mono text-seum hover:underline">
                          {c.db_no ?? "-"}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap border border-gray-200 px-2 py-1.5 text-center">{dateLabel(c.received_date)}</td>
                      <td className="whitespace-nowrap border border-gray-200 px-2 py-1.5 text-center font-semibold">
                        <Link href={`/admin/logs/customer?id=${c.id}`} className="hover:text-seum">
                          {name}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap border border-gray-200 px-2 py-1.5 text-center">
                        {c.phone ? <a href={`tel:${c.phone}`}>{c.phone}</a> : "-"}
                      </td>
                      <td className="border border-gray-200 px-2 py-1.5 text-center">{c.region || "-"}</td>
                      <td className="whitespace-nowrap border border-gray-200 px-2 py-1.5 text-center">{c.inflow_type || "-"}</td>
                      <td className="whitespace-nowrap border border-gray-200 px-2 py-1.5 text-center">{c.inflow_route || "-"}</td>
                      <td className="border border-gray-200 px-2 py-1.5 text-center">{c.interest_product || "-"}</td>
                      <td className="whitespace-nowrap border border-gray-200 px-2 py-1.5 text-center">{c.budget || "-"}</td>
                      <td className="whitespace-nowrap border border-gray-200 px-2 py-1.5 text-center">{c.branch || "-"}</td>
                      <td className="whitespace-nowrap border border-gray-200 px-2 py-1.5 text-center">{c.assignee}</td>
                      <td className="w-[104px] border border-gray-200 px-1.5 py-1">
                        <StageSelect id={c.id} stage={c.stage} />
                      </td>
                      <td className="min-w-[240px] border border-gray-200 bg-amber-50/30 px-1.5 py-1">
                        {c.memo && (
                          <div className="mb-1 line-clamp-2 break-words text-gray-600" title={c.memo}>
                            {c.last_contact_date && <span className="mr-1 text-gray-400">{dateLabel(c.last_contact_date)}</span>}
                            {c.memo}
                          </div>
                        )}
                        <NoteInput id={c.id} />
                      </td>
                      <td className="w-[118px] border border-gray-200 bg-amber-50/30 px-1 py-1">
                        <NextDateInput id={c.id} value={c.next_action_date} />
                      </td>
                      <td className="border border-gray-200 bg-amber-50/30 px-0.5 py-1 text-center">
                        <DeleteButton id={c.id} name={name} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-gray-400">
          ▶ *진행단계: 1차상담 → 방문예정 → 방문완료 → 견적발송 → 계약협의 → 계약보류 → 계약완료 · 단계를 바꾸거나 오늘 기록을
          입력하면 그날 일지에 자동으로 남습니다.
        </p>
      </section>

      {/* 날짜별 일지 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold">📝 {sp ? `${sp} 님` : "전체"} 일지</h3>
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-0.5 text-sm">
            <Link href={link({ date: addDays(date, -1) })} className="rounded px-2 text-gray-500 hover:bg-gray-100">◀</Link>
            <span className="px-1 font-semibold">{dateLabel(date)}</span>
            <Link href={link({ date: addDays(date, 1) })} className="rounded px-2 text-gray-500 hover:bg-gray-100">▶</Link>
            {date !== today && (
              <Link href={link({ date: today })} className="rounded px-2 text-xs font-semibold text-seum">오늘</Link>
            )}
          </div>
          <span className="text-xs text-gray-500">{dayLogs.length}건</span>
        </div>
        {dayLogs.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">이 날짜의 기록이 없습니다.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100 text-sm">
            {dayLogs.map((l) => (
              <li key={l.id} className="flex flex-wrap items-baseline gap-x-2 py-1.5">
                <span className="w-12 shrink-0 text-xs text-gray-400">
                  {new Date(l.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" })}
                </span>
                {!sp && <span className="font-semibold text-gray-700">{l.assignee}</span>}
                <Link href={`/admin/logs/customer?id=${l.customer_id}`} className="font-semibold text-gray-900 hover:text-seum">
                  {l.sales_customers?.customer_name || "(이름없음)"}
                </Link>
                <span className="font-mono text-xs text-gray-400">{l.sales_customers?.db_no}</span>
                <LogText log={l} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Chip({ label, n, strong }: { label: string; n: number; strong?: boolean }) {
  return (
    <span className={`rounded-full px-2.5 py-1 font-semibold ${strong ? "bg-seum text-white" : "border border-gray-200 bg-white text-gray-600"}`}>
      {label} {n}
    </span>
  );
}
