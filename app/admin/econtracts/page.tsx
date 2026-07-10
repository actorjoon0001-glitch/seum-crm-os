import Link from "next/link";
import { Fragment } from "react";
import {
  createServiceClient,
  hasSupabaseEnv,
  CONTRACTS_TABLE,
  ECONTRACTS_TABLE,
} from "@/lib/supabase/server";
import { formatManWon, formatDate, monthLabel } from "@/lib/format";
import type { EContract } from "@/lib/types";
import { econtractStatusMeta } from "@/lib/types";
import { logout } from "@/app/login/actions";
import { requireAuth } from "@/lib/require-auth";
import { ContractTabs } from "../ContractTabs";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const PAGE_SIZE = 50;
const ym = (d?: string | null) => (d ? String(d).slice(0, 7) : "");

type Search = { q?: string; showroom?: string; status?: string; page?: string };

export default async function EContractsPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  await requireAuth("/admin/econtracts");
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
  const status = (searchParams.status ?? "").trim();
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from(ECONTRACTS_TABLE)
    .select(
      "id,contract_no,status,client_name,site_address,showroom,salesperson,contract_date,total_amount,created_at",
      { count: "exact" }
    )
    .order("contract_date", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (q)
    query = query.or(
      `client_name.ilike.%${q}%,salesperson.ilike.%${q}%,contract_no.ilike.%${q}%,site_address.ilike.%${q}%`
    );
  if (showroom) query = query.eq("showroom", showroom);
  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;
  const rows = (data ?? []) as Partial<EContract>[];

  // 통계·필터 옵션(전체 기준, econtracts는 소규모라 일괄 조회)
  const { data: allRows } = await supabase
    .from(ECONTRACTS_TABLE)
    .select("status,showroom,contract_date,total_amount")
    .limit(5000);
  const all = (allRows ?? []) as Partial<EContract>[];

  const now = new Date();
  const thisYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const total = all.length;
  const thisMonth = all.filter((r) => ym(r.contract_date) === thisYm).length;
  const confirmedCnt = all.filter((r) =>
    ["confirmed", "signed", "completed", "sealed"].includes(String(r.status))
  ).length;
  const sumAmount = all.reduce((s, r) => s + (Number(r.total_amount) || 0), 0);

  const showrooms = Array.from(
    new Set(all.map((r) => (r.showroom || "").trim()).filter(Boolean))
  ).sort();
  const statuses = Array.from(
    new Set(all.map((r) => (r.status || "").trim()).filter(Boolean))
  );

  // 탭 수기 계약 건수
  const { count: manualCount } = await supabase
    .from(CONTRACTS_TABLE)
    .select("id", { count: "exact", head: true })
    .or("is_deleted.is.null,is_deleted.eq.false");

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Header />
      <ContractTabs
        active="electronic"
        manualCount={manualCount ?? 0}
        electronicCount={total}
      />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="전체 전자계약" value={String(total)} />
        <StatCard label="이번달" value={String(thisMonth)} accent="text-purple-600" />
        <StatCard label="확정" value={String(confirmedCnt)} accent="text-green-600" />
        <StatCard label="합계 금액" value={formatManWon(sumAmount)} accent="text-seum" small />
      </div>

      <form action="/admin/econtracts" className="mt-6 flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="고객명 · 영업 · 계약번호 · 주소 검색"
          className="w-64 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm outline-none focus:border-seum"
        />
        <select
          name="showroom"
          defaultValue={showroom}
          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-seum"
        >
          <option value="">전체 전시장</option>
          {showrooms.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status}
          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-seum"
        >
          <option value="">전체 상태</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {econtractStatusMeta(s).label}
            </option>
          ))}
        </select>
        <button className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
          검색
        </button>
        {(q || showroom || status) && (
          <Link href="/admin/econtracts" className="text-sm text-gray-400 hover:text-gray-600">
            초기화
          </Link>
        )}
      </form>

      {error ? (
        <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-600">
          데이터를 불러오지 못했습니다: {error.message}
        </div>
      ) : (
        <>
          <p className="mt-4 text-xs text-gray-400">
            총 {count ?? rows.length}건 중 {rows.length === 0 ? 0 : from + 1}–
            {from + rows.length}건 표시
          </p>
          <EContractTable rows={rows} />
          <Pagination
            page={page}
            totalPages={totalPages}
            params={{ q, showroom, status }}
          />
        </>
      )}
    </main>
  );
}

function EContractTable({ rows }: { rows: Partial<EContract>[] }) {
  if (rows.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-400">
        조건에 맞는 전자계약이 없습니다.
      </div>
    );
  }
  return (
    <div className="mt-2 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3 font-medium">계약번호</th>
            <th className="px-4 py-3 font-medium">고객</th>
            <th className="px-4 py-3 font-medium">전시장</th>
            <th className="px-4 py-3 font-medium">영업</th>
            <th className="px-4 py-3 font-medium">계약일</th>
            <th className="px-4 py-3 font-medium">상태</th>
            <th className="px-4 py-3 text-right font-medium">금액</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((r, idx) => {
            const meta = econtractStatusMeta(r.status);
            const curYm = ym(r.contract_date);
            const prevYm = idx > 0 ? ym(rows[idx - 1].contract_date) : null;
            const showMonthHeader = curYm !== prevYm;
            return (
              <Fragment key={r.id}>
                {showMonthHeader && (
                  <tr className="border-t border-gray-100 bg-gray-50/80">
                    <td colSpan={7} className="px-4 py-1.5 text-xs font-bold text-gray-500">
                      {curYm ? monthLabel(curYm) : "계약일 미정"}
                    </td>
                  </tr>
                )}
                <tr className="hover:bg-gray-50/50">
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link
                      href={`/admin/econtracts/${r.id}`}
                      className="font-semibold text-gray-900 hover:text-seum"
                    >
                      {r.contract_no || `#${r.id}`}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {r.client_name || "(이름없음)"}
                    {r.site_address && (
                      <div className="text-[11px] text-gray-400">{r.site_address}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.showroom || "-"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.salesperson || "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                    {formatDate(r.contract_date ?? null)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${meta.color}`}
                    >
                      {meta.label}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-gray-700">
                    {formatManWon(r.total_amount ?? null)}
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = "text-gray-900",
  small = false,
}: {
  label: string;
  value: string;
  accent?: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className={`mt-1 font-bold ${accent} ${small ? "text-lg" : "text-2xl"}`}>
        {value}
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="flex items-center justify-between">
      <div>
        <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">
          세움 홈
        </Link>
        <h1 className="text-2xl font-bold">
          고객관리<span className="text-seum">OS</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">전자계약 목록</p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/admin/visits"
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:border-seum hover:text-seum"
        >
          방문예약 고객 →
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

function Pagination({
  page,
  totalPages,
  params,
}: {
  page: number;
  totalPages: number;
  params: Record<string, string>;
}) {
  if (totalPages <= 1) return null;
  const build = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `/admin/econtracts?${sp.toString()}`;
  };
  return (
    <div className="mt-6 flex items-center justify-center gap-3 text-sm">
      {page > 1 ? (
        <Link href={build(page - 1)} className="rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50">
          ← 이전
        </Link>
      ) : (
        <span className="rounded-lg border border-gray-100 px-3 py-1.5 text-gray-300">← 이전</span>
      )}
      <span className="text-gray-500">
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={build(page + 1)} className="rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50">
          다음 →
        </Link>
      ) : (
        <span className="rounded-lg border border-gray-100 px-3 py-1.5 text-gray-300">다음 →</span>
      )}
    </div>
  );
}
