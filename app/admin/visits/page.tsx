import Link from "next/link";
import {
  createServiceClient,
  hasSupabaseEnv,
  VISITS_TABLE,
} from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import type { VisitReservation } from "@/lib/types";
import { logout } from "@/app/login/actions";
import VisitCalendar, { defaultVisitMonth } from "./VisitCalendar";

export const dynamic = "force-dynamic";

const pad = (n: number) => String(n).padStart(2, "0");

type Search = { q?: string; source?: string; view?: string; month?: string };

export default async function VisitsPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  if (!hasSupabaseEnv()) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Header />
        <p className="mt-8 text-sm text-gray-400">Supabase 연결이 필요합니다.</p>
      </main>
    );
  }

  const supabase = createServiceClient();
  const q = (searchParams.q ?? "").trim();
  const source = (searchParams.source ?? "").trim();
  const view = searchParams.view === "calendar" ? "calendar" : "list";

  let query = supabase
    .from(VISITS_TABLE)
    .select("*")
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .limit(300);
  if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
  if (source) query = query.eq("source", source);

  const { data, error } = await query;
  const rows = (data ?? []) as VisitReservation[];

  // 유입경로 목록(필터)
  const { data: srcRows } = await supabase
    .from(VISITS_TABLE)
    .select("source")
    .not("source", "is", null)
    .limit(2000);
  const sources = Array.from(
    new Set((srcRows ?? []).map((r) => (r as { source: string }).source))
  ).sort();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const month = /^\d{4}-\d{2}$/.test(searchParams.month || "")
    ? (searchParams.month as string)
    : defaultVisitMonth(rows, today);

  const toggleBase = new URLSearchParams();
  if (q) toggleBase.set("q", q);
  if (source) toggleBase.set("source", source);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Header count={rows.length} />

      {error ? (
        <SetupNotice message={error.message} />
      ) : (
        <>
          {/* 보기 전환: 목록 / 캘린더 */}
          <div className="mt-6 inline-flex rounded-xl border border-gray-200 bg-white p-1 text-sm font-semibold shadow-sm">
            <Link
              href={`/admin/visits${toggleBase.toString() ? `?${toggleBase}` : ""}`}
              className={`rounded-lg px-4 py-1.5 ${view === "list" ? "bg-seum text-white" : "text-gray-500 hover:text-gray-800"}`}
            >
              목록
            </Link>
            <Link
              href={`/admin/visits?${new URLSearchParams({ ...Object.fromEntries(toggleBase), view: "calendar" })}`}
              className={`rounded-lg px-4 py-1.5 ${view === "calendar" ? "bg-seum text-white" : "text-gray-500 hover:text-gray-800"}`}
            >
              📅 캘린더
            </Link>
          </div>

          <form action="/admin/visits" className="mt-4 flex flex-wrap items-center gap-2">
            <input type="hidden" name="view" value={view} />
            <input
              name="q"
              defaultValue={q}
              placeholder="이름 · 연락처 검색"
              className="w-56 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm outline-none focus:border-seum"
            />
            <select
              name="source"
              defaultValue={source}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-seum"
            >
              <option value="">전체 유입경로</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
              검색
            </button>
            {(q || source) && (
              <Link href="/admin/visits" className="text-sm text-gray-400 hover:text-gray-600">
                초기화
              </Link>
            )}
          </form>

          {view === "calendar" ? (
            <VisitCalendar
              rows={rows}
              month={month}
              todayStr={todayStr}
              params={{ q, source }}
            />
          ) : rows.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-400">
              아직 등록된 방문예약이 없습니다.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">고객</th>
                    <th className="px-4 py-3 font-medium">방문일시</th>
                    <th className="px-4 py-3 text-center font-medium">인원</th>
                    <th className="px-4 py-3 font-medium">관심상품 / 평수</th>
                    <th className="px-4 py-3 font-medium">예산</th>
                    <th className="px-4 py-3 font-medium">유입</th>
                    <th className="px-4 py-3 font-medium">접수일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/visits/${r.id}`}
                          className="font-semibold text-gray-900 hover:text-seum"
                        >
                          {r.name || "(이름없음)"}
                        </Link>
                        {r.phone && <div className="text-xs text-gray-400">{r.phone}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {r.visit_date || "-"}
                        {r.visit_time ? ` ${r.visit_time}` : ""}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500">
                        {r.visitor_count || "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {r.interest_type || "-"}
                        {r.size ? (
                          <span className="text-gray-400"> · {r.size}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{r.budget || "-"}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{r.source || "-"}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {formatDateTime(r.submitted_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function SetupNotice({ message }: { message: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
      <p className="font-semibold">방문예약 테이블이 아직 없습니다.</p>
      <p className="mt-1 text-xs text-amber-600">({message})</p>
      <p className="mt-3">
        Supabase에 <code className="rounded bg-amber-100 px-1">visit_reservations</code>{" "}
        테이블을 만들고, n8n에서 방문예약 데이터를 이 테이블로 보내면 여기에 표시됩니다.
      </p>
    </div>
  );
}

function Header({ count }: { count?: number }) {
  return (
    <header className="flex items-center justify-between">
      <div>
        <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">
          세움 홈
        </Link>
        <h1 className="text-2xl font-bold">
          방문예약 <span className="text-seum">고객</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          방문예약폼 접수 고객 {count !== undefined ? `· ${count}건` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/admin"
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:border-seum hover:text-seum"
        >
          계약 고객 →
        </Link>
        <form action={logout}>
          <button className="rounded-xl px-3 py-2 text-sm text-gray-400 hover:text-gray-600">
            로그아웃
          </button>
        </form>
      </div>
    </header>
  );
}
