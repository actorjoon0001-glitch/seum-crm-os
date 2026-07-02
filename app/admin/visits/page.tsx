import Link from "next/link";
import {
  createServiceClient,
  hasSupabaseEnv,
  VISITS_TABLE,
} from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import type { VisitReservation } from "@/lib/types";
import { showroomLabel } from "@/lib/types";
import { logout } from "@/app/login/actions";
import VisitCalendar, { defaultVisitMonth } from "./VisitCalendar";
import { vf, getPayload } from "./fields";
import { StatusSelect, AssigneeInput } from "./RowControls";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const pad = (n: number) => String(n).padStart(2, "0");

type Search = { q?: string; showroom?: string; view?: string; month?: string };

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
  const showroom = (searchParams.showroom ?? "").trim();
  const view = searchParams.view === "calendar" ? "calendar" : "list";

  let query = supabase
    .from(VISITS_TABLE)
    .select("*")
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .limit(300);
  if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
  if (showroom) query = query.filter("payload->>showroom", "eq", showroom);

  const { data, error } = await query;
  const rows = (data ?? []) as VisitReservation[];

  // 전시장 목록(필터) — payload에서 추출
  const { data: allRows } = await supabase
    .from(VISITS_TABLE)
    .select("payload")
    .limit(2000);
  const showroomSet = new Set<string>();
  for (const row of allRows ?? []) {
    const p = getPayload(row as VisitReservation);
    const s = p?.showroom;
    if (typeof s === "string" && s.trim()) showroomSet.add(s.trim());
  }
  const showrooms = Array.from(showroomSet).sort();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const month = /^\d{4}-\d{2}$/.test(searchParams.month || "")
    ? (searchParams.month as string)
    : defaultVisitMonth(rows, today);

  const toggleBase = new URLSearchParams();
  if (q) toggleBase.set("q", q);
  if (showroom) toggleBase.set("showroom", showroom);

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
              name="showroom"
              defaultValue={showroom}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-seum"
            >
              <option value="">전체 전시장</option>
              {showrooms.map((s) => (
                <option key={s} value={s}>
                  {showroomLabel(s)}
                </option>
              ))}
            </select>
            <button className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
              검색
            </button>
            {(q || showroom) && (
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
              params={{ q, showroom }}
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
                    <th className="px-4 py-3 font-medium">전시장</th>
                    <th className="px-4 py-3 font-medium">관심유형 / 평수</th>
                    <th className="px-4 py-3 font-medium">예산</th>
                    <th className="px-4 py-3 font-medium">건축시기</th>
                    <th className="px-4 py-3 font-medium">담당 영업사원</th>
                    <th className="px-4 py-3 font-medium">상태</th>
                    <th className="px-4 py-3 font-medium">접수일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((r) => {
                    const vdate = vf(r, ["visitDate"], "visit_date");
                    const vtime = vf(r, ["visitTime"], "visit_time");
                    const showroom = showroomLabel(vf(r, ["showroom"]) || null);
                    const interest = vf(r, ["houseType", "interestType"], "interest_type");
                    const size = vf(r, ["pyeong", "size"], "size");
                    const budget = vf(r, ["budget"], "budget");
                    const build = vf(r, ["buildTimeline"]);
                    const name = vf(r, ["name"], "name") || "(이름없음)";
                    const phone = vf(r, ["phone"], "phone");
                    return (
                      <tr key={r.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/visits/${r.id}`}
                            className="font-semibold text-gray-900 hover:text-seum"
                          >
                            {name}
                          </Link>
                          {phone && <div className="text-xs text-gray-400">{phone}</div>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {vdate || "-"}
                          {vtime ? ` ${vtime}` : ""}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {showroom === "-" ? "-" : showroom}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {interest || "-"}
                          {size ? <span className="text-gray-400"> · {size}</span> : null}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{budget || "-"}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{build || "-"}</td>
                        <td className="px-4 py-3">
                          <AssigneeInput id={r.id} value={r.assigned_to} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusSelect id={r.id} status={r.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {formatDateTime(r.submitted_at)}
                        </td>
                      </tr>
                    );
                  })}
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
