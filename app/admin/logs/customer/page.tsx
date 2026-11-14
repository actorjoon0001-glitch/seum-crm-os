import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createServiceClient,
  hasSupabaseEnv,
  SALES_CUSTOMERS_TABLE as CUST,
  SALES_CUSTOMER_LOGS_TABLE as LOGS,
} from "@/lib/supabase/server";
import { requireAuth } from "@/lib/require-auth";
import { stageColor, type SalesCustomer, type SalesCustomerLog } from "@/lib/sales-db";
import { getSalespeople } from "@/lib/staff";
import { dateLabel, kstToday } from "@/lib/kst";
import AppNav from "@/app/AppNav";
import CustomerForm from "../CustomerForm";
import LogText from "../LogText";
import { NoteInput } from "../RowControls";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// 고객 1명: 정보 수정 + 일지(상담 이력) 전체
export default async function CustomerDetail({ searchParams }: { searchParams: { id?: string } }) {
  await requireAuth("/admin/logs");
  const id = searchParams.id ?? "";
  if (!hasSupabaseEnv() || !/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = createServiceClient();
  const [cRes, lRes] = await Promise.all([
    supabase.from(CUST).select("*").eq("id", id).single(),
    supabase.from(LOGS).select("*").eq("customer_id", id).order("created_at", { ascending: false }).limit(500),
  ]);
  if (!cRes.data) notFound();
  const c = cRes.data as SalesCustomer;
  const logs = (lRes.data ?? []) as SalesCustomerLog[];
  const salespeople = await getSalespeople(supabase, [c.assignee]);

  return (
    <main className="mx-auto max-w-none px-4 py-6">
      <AppNav active="logs" />
      <Link
        href={`/admin/logs?sp=${encodeURIComponent(c.assignee)}`}
        className="mt-4 inline-block text-sm text-gray-400 hover:text-gray-600"
      >
        ← {c.assignee} 님 고객 DB
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-sm text-seum">{c.db_no}</div>
          <h1 className="text-2xl font-bold">{c.customer_name || "(이름없음)"}</h1>
          <p className="text-sm text-gray-500">
            {c.phone && (
              <a href={`tel:${c.phone}`} className="text-seum">
                {c.phone}
              </a>
            )}
            {` · 접수 ${dateLabel(c.received_date)} · ${c.inflow_type ?? "-"} / ${c.inflow_route ?? "-"} · 담당 ${c.assignee}`}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${stageColor(c.stage)}`}>{c.stage}</span>
      </div>

      <div className="mt-4">
        <CustomerForm mode="edit" salespeople={salespeople} assignee={c.assignee} branch={c.branch ?? ""} today={kstToday()} customer={c} />
      </div>

      <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold">📝 상담 일지 {logs.length}건</h2>
        <div className="mt-2 max-w-xl">
          <NoteInput id={c.id} />
        </div>
        <ul className="mt-3 space-y-0 border-l-2 border-gray-200 pl-4 text-sm">
          {logs.map((l) => (
            <li key={l.id} className="relative py-1.5">
              <span className="absolute -left-[21px] top-3 h-2 w-2 rounded-full bg-seum" />
              <span className="mr-2 text-xs font-semibold text-gray-500">{dateLabel(l.log_date)}</span>
              <span className="mr-2 text-xs text-gray-400">{l.assignee}</span>
              <LogText log={l} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
