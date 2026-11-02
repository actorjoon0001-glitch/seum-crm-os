import Link from "next/link";
import { cookies } from "next/headers";
import {
  createServiceClient,
  hasSupabaseEnv,
  LOGS_TABLE,
  CALLS_TABLE,
} from "@/lib/supabase/server";
import { requireAuth } from "@/lib/require-auth";
import { SP_COOKIE } from "@/lib/auth";
import { isMissingTable } from "@/lib/db-errors";
import { SALES_LOGS_SQL } from "@/lib/sales-logs-sql";
import type { SalesLog } from "@/lib/types";
import { stageMeta } from "@/lib/types";
import { addDays, dateLabel, isDateStr, kstToday } from "@/lib/kst";
import { dueFollowUps, type FollowUpRow } from "@/lib/kpi";
import AppNav from "@/app/AppNav";
import SetupSqlNotice from "@/app/SetupSqlNotice";
import LogForm from "./LogForm";
import LogTable, { customerHref } from "./LogTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type Search = {
  sp?: string;
  date?: string;
  // 연락할 고객 → "기록하기" 로 넘어올 때 미리 채움
  name?: string;
  phone?: string;
};

export default async function LogsPage({ searchParams }: { searchParams: Search }) {
  await requireAuth("/admin/logs");

  const today = kstToday();
  const date = isDateStr(searchParams.date) ? searchParams.date : today;
  // 영업사원: 주소에 있으면 그것, 없으면 마지막으로 기록한 이름(쿠키)
  let sp = "";
  if (searchParams.sp !== undefined) sp = searchParams.sp.trim();
  else {
    const c = cookies().get(SP_COOKIE)?.value;
    if (c) {
      try {
        sp = decodeURIComponent(c);
      } catch {
        sp = "";
      }
    }
  }

  const shell = (body: React.ReactNode) => (
    <main className="mx-auto max-w-none px-4 py-6">
      <AppNav active="logs" />
      <div className="mt-5">
        <h1 className="text-2xl font-bold">📝 영업일지</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          오늘 상담·연락한 고객을 1건씩 기록하세요. 기록된 일지로 KPI가 자동 집계됩니다.
        </p>
      </div>
      <div className="mt-5 space-y-5">{body}</div>
    </main>
  );

  if (!hasSupabaseEnv()) return shell(<p className="text-sm text-gray-400">Supabase 연결이 필요합니다.</p>);
  const supabase = createServiceClient();

  // 해당 날짜 일지 (영업사원 선택 시 본인 것만)
  let dayQ = supabase
    .from(LOGS_TABLE)
    .select("*")
    .eq("log_date", date)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (sp) dayQ = dayQ.eq("salesperson", sp);

  const [dayRes, spRes, callSpRes, fuRes] = await Promise.all([
    dayQ,
    supabase.from(LOGS_TABLE).select("salesperson").limit(5000),
    supabase.from(CALLS_TABLE).select("salesperson").not("salesperson", "is", null).limit(3000),
    sp
      ? supabase
          .from(LOGS_TABLE)
          .select(
            "id,salesperson,customer_name,phone,phone_digits,stage,next_action_date,next_action,log_date,created_at"
          )
          .eq("salesperson", sp)
          .limit(5000)
      : Promise.resolve({ data: [] as FollowUpRow[], error: null }),
  ]);

  if (dayRes.error) {
    return shell(
      isMissingTable(dayRes.error, "sales_logs") ? (
        <SetupSqlNotice
          title="영업일지 테이블"
          table="sales_logs"
          sql={SALES_LOGS_SQL}
          message={dayRes.error.message}
          after="영업사원들이 바로 일지를 쓸 수 있습니다."
        />
      ) : (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          불러오기 실패: {dayRes.error.message}
        </div>
      )
    );
  }

  const rows = (dayRes.data ?? []) as SalesLog[];
  const salespeople = Array.from(
    new Set(
      [...(spRes.data ?? []), ...(callSpRes.data ?? [])]
        .map((r) => String((r as { salesperson?: string }).salesperson ?? "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "ko"));
  const followUps = dueFollowUps((fuRes.data ?? []) as FollowUpRow[], today);

  const link = (p: Record<string, string>) => {
    const q = new URLSearchParams({ sp, date, ...p });
    return `/admin/logs?${q}`;
  };

  // 날짜 요약
  const cnt = (a: string) => rows.filter((r) => r.activity === a).length;
  const perSp = new Map<string, number>();
  for (const r of rows) perSp.set(r.salesperson, (perSp.get(r.salesperson) ?? 0) + 1);

  return shell(
    <>
      {/* 영업사원 / 날짜 선택 */}
      <div className="flex flex-wrap items-center gap-3">
        <form action="/admin/logs" className="flex items-center gap-2">
          <input type="hidden" name="date" value={date} />
          <select
            name="sp"
            defaultValue={sp}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-seum"
          >
            <option value="">👥 전체 영업사원</option>
            {sp && !salespeople.includes(sp) && <option value={sp}>{sp}</option>}
            {salespeople.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-semibold text-white">보기</button>
        </form>
        <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 text-sm shadow-sm">
          <Link href={link({ date: addDays(date, -1) })} className="rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100">
            ◀
          </Link>
          <span className="px-2 font-semibold">{dateLabel(date)}</span>
          <Link href={link({ date: addDays(date, 1) })} className="rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100">
            ▶
          </Link>
          {date !== today && (
            <Link href={link({ date: today })} className="rounded-lg px-2 py-1 text-xs font-semibold text-seum hover:bg-seum-light">
              오늘
            </Link>
          )}
        </div>
        <div className="ml-auto flex flex-wrap gap-2 text-xs">
          <Chip label="활동" n={rows.length} strong />
          <Chip label="신규" n={rows.filter((r) => r.is_new).length} />
          <Chip label="전화" n={cnt("call")} />
          <Chip label="방문" n={cnt("visit")} />
          <Chip label="현장" n={cnt("site")} />
          <Chip label="견적" n={cnt("quote")} />
          <Chip label="계약" n={cnt("contract")} />
        </div>
      </div>

      <LogForm
        key={`${sp}|${date}|${searchParams.phone ?? ""}|${searchParams.name ?? ""}`}
        salesperson={sp}
        logDate={date}
        salespeople={salespeople}
        prefill={{ customer_name: searchParams.name, phone: searchParams.phone }}
      />

      {/* 연락할 고객 (다음 연락일이 오늘이거나 지난 고객) */}
      {sp && followUps.length > 0 && (
        <section className="rounded-2xl border border-orange-200 bg-orange-50/60 p-4">
          <h2 className="text-sm font-bold text-orange-800">
            📌 {sp} 님이 연락할 고객 {followUps.length}명
            <span className="ml-1 font-normal text-orange-600">(다음 연락일이 오늘이거나 지남)</span>
          </h2>
          <ul className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {followUps.map((f) => {
              const late = f.next_action_date! < today;
              const st = stageMeta(f.stage);
              return (
                <li key={f.id} className="flex items-start gap-2 rounded-xl bg-white p-3 text-xs shadow-sm">
                  <div className="min-w-0 flex-1">
                    <Link href={customerHref(f)} className="text-sm font-semibold text-gray-900 hover:text-seum">
                      {f.customer_name || "(이름없음)"}
                    </Link>
                    {f.phone && <span className="ml-1 text-gray-400">{f.phone}</span>}
                    <div className="mt-0.5 truncate text-gray-500">{f.next_action || "다음 할 일 미입력"}</div>
                    <div className="mt-1 flex items-center gap-1">
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${st.color}`}>{st.label}</span>
                      <span className={late ? "font-semibold text-red-600" : "text-orange-700"}>
                        {late ? "⚠ 지연 " : ""}
                        {dateLabel(f.next_action_date)}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={link({ date: today, name: f.customer_name ?? "", phone: f.phone ?? "" })}
                    className="shrink-0 rounded-lg bg-orange-500 px-2 py-1 font-semibold text-white hover:bg-orange-600"
                  >
                    기록하기
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 전체 보기일 때: 영업사원별 작성 현황 */}
      {!sp && perSp.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from(perSp.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([name, n]) => (
              <Link
                key={name}
                href={link({ sp: name })}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm hover:border-seum hover:text-seum"
              >
                {name} <span className="text-seum">{n}건</span>
              </Link>
            ))}
        </div>
      )}

      <section>
        <h2 className="mb-2 text-sm font-bold text-gray-700">
          {dateLabel(date)} {sp ? `${sp} 님` : "전체"} 일지 · {rows.length}건
        </h2>
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
            이 날짜에 기록된 일지가 없습니다.
          </div>
        ) : (
          <LogTable rows={rows} showSalesperson={!sp} />
        )}
      </section>
    </>
  );
}

function Chip({ label, n, strong }: { label: string; n: number; strong?: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 font-semibold ${
        strong ? "bg-seum text-white" : "border border-gray-200 bg-white text-gray-600"
      }`}
    >
      {label} {n}
    </span>
  );
}
