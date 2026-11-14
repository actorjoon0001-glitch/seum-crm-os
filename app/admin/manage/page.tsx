import Link from "next/link";
import {
  createServiceClient,
  hasSupabaseEnv,
  VISITS_TABLE,
  CALLS_TABLE,
  SALES_CUSTOMERS_TABLE,
  SALES_CUSTOMER_LOGS_TABLE,
} from "@/lib/supabase/server";
import { requireOwner } from "@/lib/require-auth";
import { isOwnerEmployee } from "@/lib/auth";
import { ACTIVITY_LABEL, ACTIVITY_TABLE } from "@/lib/activity";
import { ACTIVITY_SQL } from "@/lib/activity-sql";
import { getSalespeople, groupByBranch } from "@/lib/staff";
import { addDays, dateLabel, kstDayStartISO, kstToday } from "@/lib/kst";
import AppNav from "@/app/AppNav";
import SetupSqlNotice from "@/app/SetupSqlNotice";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const SUPABASE_PROJECT = "uqsswlunnpdhledmoarj";

type Activity = {
  id: number;
  created_at: string;
  kind: string;
  actor: string | null;
  role: string | null;
  detail: string | null;
  ip: string | null;
  user_agent: string | null;
};

type Search = { kind?: string; who?: string };

export default async function ManagePage({ searchParams }: { searchParams: Search }) {
  await requireOwner("/admin/manage");
  const today = kstToday();
  const kind = (searchParams.kind ?? "").trim();
  const who = (searchParams.who ?? "").trim();

  const shell = (body: React.ReactNode) => (
    <main className="mx-auto max-w-none px-4 py-6">
      <AppNav active="manage" />
      <div className="mt-5">
        <h1 className="text-2xl font-bold">🛡️ 관리자</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          세움OS 권한이 admin 인 관리자 계정만 볼 수 있는 화면입니다. (master 제외) 로그인 기록, 일지 작성 현황, 데이터 백업을 관리합니다.
        </p>
      </div>
      <div className="mt-5 space-y-5">{body}</div>
    </main>
  );

  if (!hasSupabaseEnv()) return shell(<p className="text-sm text-gray-400">Supabase 연결이 필요합니다.</p>);
  const supabase = createServiceClient();

  const count = (table: string, f?: (q: any) => any) => {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    if (f) q = f(q);
    return q;
  };

  let actQ = supabase.from(ACTIVITY_TABLE).select("*").order("created_at", { ascending: false }).limit(300);
  if (kind) actQ = actQ.eq("kind", kind);
  if (who) actQ = actQ.ilike("actor", `%${who.replace(/[%,()]/g, "")}%`);

  const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const todayStart = kstDayStartISO(today);
  const weekFrom = addDays(today, -6);

  const [
    actRes,
    todayLoginRes,
    failRes,
    visits,
    callsMain,
    callsMobile,
    customers,
    logsTotal,
    weekLogsRes,
    gradeColRes,
    empRes,
  ] = await Promise.all([
    actQ,
    supabase
      .from(ACTIVITY_TABLE)
      .select("actor,kind")
      .in("kind", ["login", "auto_login"])
      .gte("created_at", todayStart)
      .limit(5000),
    count(ACTIVITY_TABLE, (q) => q.eq("kind", "login_failed").gte("created_at", since24h)),
    count(VISITS_TABLE),
    count(CALLS_TABLE, (q) => q.eq("channel", "main")),
    count(CALLS_TABLE, (q) => q.eq("channel", "mobile")),
    count(SALES_CUSTOMERS_TABLE),
    count(SALES_CUSTOMER_LOGS_TABLE),
    supabase.from(SALES_CUSTOMER_LOGS_TABLE).select("assignee,log_date").gte("log_date", weekFrom).limit(50000),
    supabase.from(SALES_CUSTOMERS_TABLE).select("grade").limit(1),
    supabase.from("employees").select("*").limit(2000),
  ]);
  type Emp = { name: string | null; team: string | null; role: string | null; permission: string | null; status: string | null; email: string | null };
  const employees = (empRes.data ?? []) as Emp[];
  const approved = employees.filter((e) => !e.status || e.status === "approved");
  const pendingEmp = employees.filter((e) => e.status === "pending");
  const blockedEmp = employees.filter((e) => e.status === "blocked");
  const owners = approved.filter((e) => isOwnerEmployee(e));

  const activityMissing = !!actRes.error;
  const activities = (actRes.data ?? []) as Activity[];
  const todayLogins = (todayLoginRes.data ?? []) as { actor: string | null }[];
  const uniqueToday = new Set(todayLogins.map((r) => r.actor || "(이름 없음)")).size;

  // 최근 7일 영업일지 작성표
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekFrom, i));
  const cell = new Map<string, number>();
  for (const r of (weekLogsRes.data ?? []) as { assignee: string; log_date: string }[]) {
    const k = `${r.assignee}|${r.log_date}`;
    cell.set(k, (cell.get(k) ?? 0) + 1);
  }
  const staff = (await getSalespeople(supabase)).filter((s) => s.fromStaff);
  const groups = groupByBranch(staff);
  const wroteToday = staff.filter((s) => cell.has(`${s.name}|${today}`)).length;

  // 시스템 상태
  const checks: { label: string; ok: boolean; note?: string }[] = [
    { label: "세움OS 계정 로그인 (직원 명단 연동)", ok: !empRes.error },
    {
      label: "포털 자동로그인 키 (PORTAL_KEY)",
      ok: !!process.env.PORTAL_KEY,
      note: process.env.PORTAL_KEY ? undefined : "미설정 — 포털 자동로그인에 ADMIN_PASSWORD 를 키로 사용 중 (별도 키 권장)",
    },
    { label: "방문예약 테이블", ok: !visits.error },
    { label: "전화 고객 테이블 (call_leads)", ok: !callsMain.error },
    { label: "고객 DB 테이블 (sales_customers)", ok: !customers.error },
    { label: "고객등급 컬럼 (grade)", ok: !gradeColRes.error },
    { label: "활동 기록 테이블 (crm_activity_logs)", ok: !activityMissing },
  ];

  const qs = (p: Record<string, string>) => {
    const u = new URLSearchParams({ ...(kind ? { kind } : {}), ...(who ? { who } : {}), ...p });
    for (const [k, v] of Array.from(u.entries())) if (!v) u.delete(k);
    return `/admin/manage?${u}`;
  };

  return shell(
    <>
      {activityMissing && (
        <SetupSqlNotice
          title="활동 기록 테이블"
          table="crm_activity_logs"
          sql={ACTIVITY_SQL}
          message={actRes.error?.message ?? ""}
          after="로그인 · 로그아웃 · 삭제 기록이 쌓이기 시작합니다."
        />
      )}

      {/* 요약 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="오늘 로그인" value={`${todayLogins.length}건`} sub={`${uniqueToday}명 접속`} />
        <Tile
          label="최근 24시간 로그인 실패"
          value={`${failRes.count ?? 0}건`}
          sub="비밀번호 틀림 · 키 불일치"
          warn={(failRes.count ?? 0) >= 5}
        />
        <Tile label="오늘 영업일지 작성" value={`${wroteToday} / ${staff.length}명`} sub={`미작성 ${staff.length - wroteToday}명`} />
        <Tile label="고객 DB" value={`${customers.count ?? 0}명`} sub={`일지 기록 ${logsTotal.count ?? 0}건`} />
      </div>

      {/* 최근 7일 일지 작성표 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold">📅 최근 7일 영업일지 작성표</h2>
        <p className="text-xs text-gray-500">숫자 = 그날 남긴 기록 수 (등록 · 단계변경 · 상담기록 · 등급변경). 빈 칸은 미작성.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-center text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="border border-gray-200 px-2 py-1.5 text-left">전시장</th>
                <th className="border border-gray-200 px-2 py-1.5 text-left">영업사원</th>
                {days.map((d) => (
                  <th key={d} className={`border border-gray-200 px-2 py-1.5 ${d === today ? "bg-seum-light text-seum-dark" : ""}`}>
                    {dateLabel(d)}
                  </th>
                ))}
                <th className="border border-gray-200 px-2 py-1.5">작성일</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) =>
                g.people.map((p, i) => {
                  const daysWritten = days.filter((d) => cell.has(`${p.name}|${d}`)).length;
                  return (
                    <tr key={p.name}>
                      {i === 0 && (
                        <td rowSpan={g.people.length} className="border border-gray-200 bg-gray-50 px-2 py-1 text-left font-semibold text-gray-700">
                          {g.branch}
                        </td>
                      )}
                      <td className="border border-gray-200 px-2 py-1 text-left">
                        <Link href={`/admin/logs?sp=${encodeURIComponent(p.name)}`} className="font-medium hover:text-seum">
                          {p.name}
                        </Link>
                      </td>
                      {days.map((d) => {
                        const n = cell.get(`${p.name}|${d}`) ?? 0;
                        return (
                          <td
                            key={d}
                            className={`border border-gray-200 px-2 py-1 ${n ? "bg-emerald-50 font-semibold text-emerald-700" : "text-gray-300"}`}
                          >
                            {n || "·"}
                          </td>
                        );
                      })}
                      <td className={`border border-gray-200 px-2 py-1 font-semibold ${daysWritten === 0 ? "text-red-600" : "text-gray-700"}`}>
                        {daysWritten}/7
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 세움OS 계정 현황 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold">👤 세움OS 계정 현황</h2>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">로그인 가능 {approved.length}명</span>
          <span className={`rounded-full px-2.5 py-1 font-semibold ${pendingEmp.length ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-500"}`}>
            승인 대기 {pendingEmp.length}명
          </span>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 font-semibold text-gray-500">차단 {blockedEmp.length}명</span>
          <span className="rounded-full bg-gray-900 px-2.5 py-1 font-semibold text-white">관리자 {owners.length}명</span>
        </div>
        <p className="mt-2 text-xs text-gray-600">
          <b>관리자:</b> {owners.map((e) => e.name).filter(Boolean).join(", ") || "-"}
        </p>
        {pendingEmp.length > 0 && (
          <p className="mt-1 text-xs text-amber-800">
            <b>승인 대기:</b> {pendingEmp.map((e) => `${e.name ?? "-"}${e.team ? `(${e.team})` : ""}`).join(", ")} — 세움OS 관리자 화면에서
            승인하면 고객관리OS에도 로그인할 수 있습니다.
          </p>
        )}
      </section>

      {/* 로그인 · 활동 기록 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-bold">🔐 로그인 · 활동 기록</h2>
          <div className="flex flex-wrap gap-1 text-xs">
            <Link href={qs({ kind: "" })} className={chip(!kind)}>
              전체
            </Link>
            {Object.entries(ACTIVITY_LABEL).map(([k, v]) => (
              <Link key={k} href={qs({ kind: k })} className={chip(kind === k)}>
                {v.label}
              </Link>
            ))}
          </div>
          <form action="/admin/manage" className="ml-auto flex items-center gap-1">
            {kind && <input type="hidden" name="kind" value={kind} />}
            <input
              name="who"
              defaultValue={who}
              placeholder="이름 검색"
              className="w-32 rounded-lg border border-gray-300 px-2 py-1 text-xs outline-none focus:border-seum"
            />
            <button className="rounded-lg bg-gray-900 px-2 py-1 text-xs font-semibold text-white">검색</button>
          </form>
        </div>
        {activities.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">{activityMissing ? "활동 기록 테이블을 먼저 만들어 주세요." : "기록이 없습니다."}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="border-b border-gray-100 bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-2 py-1.5 font-medium">일시</th>
                  <th className="px-2 py-1.5 font-medium">구분</th>
                  <th className="px-2 py-1.5 font-medium">이름</th>
                  <th className="px-2 py-1.5 font-medium">권한</th>
                  <th className="px-2 py-1.5 font-medium">내용</th>
                  <th className="px-2 py-1.5 font-medium">IP</th>
                  <th className="px-2 py-1.5 font-medium">기기</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activities.map((a) => {
                  const meta = ACTIVITY_LABEL[a.kind] ?? { label: a.kind, color: "bg-gray-100 text-gray-600" };
                  return (
                    <tr key={a.id} className={a.kind === "login_failed" ? "bg-red-50/40" : ""}>
                      <td className="whitespace-nowrap px-2 py-1.5 text-gray-500">
                        {new Date(a.created_at).toLocaleString("ko-KR", {
                          timeZone: "Asia/Seoul",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                      </td>
                      <td className="px-2 py-1.5">
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${meta.color}`}>{meta.label}</span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 font-semibold text-gray-800">{a.actor || "-"}</td>
                      <td className="px-2 py-1.5 text-gray-500">{a.role === "owner" ? "관리자" : a.role === "staff" ? "직원" : "-"}</td>
                      <td className="px-2 py-1.5 text-gray-600">{a.detail || "-"}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 font-mono text-gray-500">{a.ip || "-"}</td>
                      <td className="px-2 py-1.5 text-gray-500">{device(a.user_agent)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 데이터 현황 · 백업 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold">💾 데이터 현황 · 엑셀(CSV) 백업</h2>
          <ul className="mt-3 divide-y divide-gray-100 text-sm">
            {[
              { label: "고객 DB (영업)", n: customers.count, type: "customers" },
              { label: "영업일지 기록", n: logsTotal.count, type: "logs" },
              { label: "방문예약 고객", n: visits.count, type: "visits" },
              { label: "대표번호 전화 고객", n: callsMain.count, type: "calls_main" },
              { label: "영업사원 영업폰 전화 고객", n: callsMobile.count, type: "calls_mobile" },
              { label: "로그인 · 활동 기록", n: activityMissing ? null : activities.length >= 300 ? "300+" : activities.length, type: "activity" },
            ].map((r) => (
              <li key={r.type} className="flex items-center justify-between py-2">
                <span className="text-gray-700">{r.label}</span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums text-gray-500">{r.n ?? "-"}건</span>
                  <a
                    href={`/api/admin/export?type=${r.type}`}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:border-seum hover:text-seum"
                  >
                    ⬇ CSV
                  </a>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-gray-400">CSV 파일은 엑셀에서 바로 열립니다. 정기적으로 내려받아 두면 백업이 됩니다.</p>
        </section>

        {/* 시스템 상태 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold">⚙️ 시스템 상태</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {checks.map((c) => (
              <li key={c.label} className="flex items-start gap-2">
                <span className={c.ok ? "text-emerald-600" : "text-red-500"}>{c.ok ? "✅" : "⚠️"}</span>
                <span className="text-gray-700">
                  {c.label}
                  {c.note && <span className="block text-xs text-amber-700">{c.note}</span>}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <a
              href={`https://supabase.com/dashboard/project/${SUPABASE_PROJECT}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-gray-900 px-3 py-1.5 font-semibold text-white hover:bg-seum"
            >
              Supabase 대시보드 ↗
            </a>
            <a
              href={`https://supabase.com/dashboard/project/${SUPABASE_PROJECT}/sql/new`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 hover:border-seum hover:text-seum"
            >
              SQL Editor ↗
            </a>
            <a
              href={`https://supabase.com/dashboard/project/${SUPABASE_PROJECT}/editor`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 hover:border-seum hover:text-seum"
            >
              Table Editor ↗
            </a>
            <a
              href={`https://supabase.com/dashboard/project/${SUPABASE_PROJECT}/settings/billing/usage`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 hover:border-seum hover:text-seum"
            >
              사용량(Usage) ↗
            </a>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-gray-400">
            직원은 세움OS 계정(이메일 · 비밀번호)으로 로그인합니다. 퇴사자는 세움OS에서 승인 해제(차단)하면 고객관리OS도 즉시
            접근할 수 없습니다. 관리자 메뉴는 세움OS 권한이 admin 인 계정에만 보입니다. (master 제외)
          </p>
        </section>
      </div>
    </>
  );
}

const chip = (on: boolean) =>
  `rounded-full px-2.5 py-1 font-semibold ${on ? "bg-gray-900 text-white" : "border border-gray-200 text-gray-600 hover:text-seum"}`;

// user-agent → 간단한 기기 표시
function device(ua: string | null): string {
  if (!ua) return "-";
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "Mac"
          : "기타";
  const br = /Edg\//.test(ua)
    ? "Edge"
    : /Whale/.test(ua)
      ? "Whale"
      : /SamsungBrowser/.test(ua)
        ? "삼성인터넷"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "";
  return [os, br].filter(Boolean).join(" · ");
}

function Tile({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${warn ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${warn ? "text-red-600" : "text-gray-900"}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}
