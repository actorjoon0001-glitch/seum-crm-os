import Link from "next/link";
import { createServiceClient, hasSupabaseEnv, LOGS_TABLE } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/require-auth";
import type { SalesLog } from "@/lib/types";
import { stageMeta, sourceMeta } from "@/lib/types";
import { kstToday } from "@/lib/kst";
import AppNav from "@/app/AppNav";
import LogTable from "../LogTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// 한 고객의 영업일지 전체 이력 (연락처 기준, 없으면 이름 기준)
export default async function CustomerHistory({
  searchParams,
}: {
  searchParams: { phone?: string; name?: string };
}) {
  await requireAuth("/admin/logs");
  const phone = (searchParams.phone ?? "").replace(/\D/g, "");
  const name = (searchParams.name ?? "").trim();

  let rows: SalesLog[] = [];
  let error: string | null = null;
  if (hasSupabaseEnv() && (phone || name)) {
    const supabase = createServiceClient();
    let q = supabase
      .from(LOGS_TABLE)
      .select("*")
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    q = phone ? q.eq("phone_digits", phone) : q.eq("customer_name", name);
    const res = await q;
    error = res.error?.message ?? null;
    rows = (res.data ?? []) as SalesLog[];
  }

  const latest = rows[0];
  const title = latest?.customer_name || name || "(이름없음)";
  const sps = Array.from(new Set(rows.map((r) => r.salesperson)));

  return (
    <main className="mx-auto max-w-none px-4 py-6">
      <AppNav active="logs" />
      <Link href="/admin/logs" className="mt-4 inline-block text-sm text-gray-400 hover:text-gray-600">
        ← 영업일지
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-gray-500">
            {latest?.phone && (
              <a href={`tel:${latest.phone}`} className="text-seum">
                {latest.phone}
              </a>
            )}
            {latest?.source && ` · ${sourceMeta(latest.source).label}`}
            {sps.length > 0 && ` · 담당 ${sps.join(", ")}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {latest && (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${stageMeta(latest.stage).color}`}>
              현재 단계: {stageMeta(latest.stage).label}
            </span>
          )}
          {latest && (
            <Link
              href={`/admin/logs?${new URLSearchParams({
                sp: latest.salesperson,
                date: kstToday(),
                name: latest.customer_name ?? "",
                phone: latest.phone ?? "",
              })}`}
              className="rounded-lg bg-seum px-3 py-1.5 text-xs font-semibold text-white hover:bg-seum-dark"
            >
              + 오늘 일지 기록
            </Link>
          )}
        </div>
      </div>

      <div className="mt-4">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">불러오기 실패: {error}</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
            기록이 없습니다.
          </div>
        ) : (
          <>
            <p className="mb-2 text-sm font-bold text-gray-700">상담 이력 {rows.length}건</p>
            <LogTable rows={rows} showDate showSalesperson={sps.length > 1} />
          </>
        )}
      </div>
    </main>
  );
}
