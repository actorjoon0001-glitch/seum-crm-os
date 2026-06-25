import Link from "next/link";
import {
  createServiceClient,
  hasSupabaseEnv,
  CUSTOMERS_TABLE,
} from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import {
  SOURCE_LABEL,
  STATUS_LABEL,
  STATUS_ORDER,
  type Customer,
  type CustomerSource,
  type CustomerStatus,
} from "@/lib/types";
import StatusSelect from "./StatusSelect";

export const dynamic = "force-dynamic";

type Search = {
  source?: string;
  status?: string;
  q?: string;
};

function SetupNotice() {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-8">
      <h2 className="text-lg font-bold text-amber-900">⚙️ Supabase 연결이 필요합니다</h2>
      <p className="mt-2 text-sm text-amber-800">
        고객 데이터를 불러오려면 환경변수를 설정하세요. 프로젝트 루트에{" "}
        <code className="rounded bg-amber-100 px-1">.env.local</code> 파일을 만들고
        아래 값을 채운 뒤 서버를 재시작하면 됩니다.
      </p>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-amber-900 p-4 text-xs text-amber-50">
{`NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...`}
      </pre>
      <p className="mt-3 text-xs text-amber-700">
        기존 방문예약폼의 Supabase 값을 그대로 넣으면 해당 데이터에 바로 연동됩니다.
      </p>
    </div>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  if (!hasSupabaseEnv()) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Header />
        <div className="mt-8">
          <SetupNotice />
        </div>
      </main>
    );
  }

  const supabase = createServiceClient();
  const source = searchParams.source as CustomerSource | undefined;
  const status = searchParams.status as CustomerStatus | undefined;
  const q = (searchParams.q ?? "").trim();

  let query = supabase
    .from(CUSTOMERS_TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (source === "visit" || source === "call") query = query.eq("source", source);
  if (status && STATUS_ORDER.includes(status)) query = query.eq("status", status);
  if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);

  const { data, error } = await query;
  const customers = (data ?? []) as Customer[];

  // 전체 통계(필터 무관)
  const { data: allRows } = await supabase
    .from(CUSTOMERS_TABLE)
    .select("source,status");
  const stats = computeStats((allRows ?? []) as Pick<Customer, "source" | "status">[]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Header />

      {/* 통계 카드 */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="전체 고객" value={stats.total} />
        <StatCard label="방문예약" value={stats.visit} accent="text-seum" />
        <StatCard label="call-os" value={stats.call} accent="text-purple-600" />
        <StatCard label="신규(미처리)" value={stats.newCount} accent="text-amber-600" />
      </div>

      {/* 필터 */}
      <Filters source={source} status={status} q={q} />

      {error ? (
        <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-600">
          데이터를 불러오지 못했습니다: {error.message}
          <p className="mt-1 text-xs text-red-400">
            Supabase에 customers 테이블이 있는지, supabase/migrations/0001_init.sql 을
            실행했는지 확인하세요.
          </p>
        </div>
      ) : (
        <CustomerTable customers={customers} />
      )}
    </main>
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
      </div>
      <Link
        href="/reserve"
        target="_blank"
        className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:border-seum hover:text-seum"
      >
        방문예약폼 보기 ↗
      </Link>
    </header>
  );
}

function StatCard({
  label,
  value,
  accent = "text-gray-900",
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent}`}>{value}</div>
    </div>
  );
}

function Filters({
  source,
  status,
  q,
}: {
  source?: string;
  status?: string;
  q: string;
}) {
  const tab = (label: string, params: Record<string, string>) => {
    const sp = new URLSearchParams(params);
    const active =
      (params.source ?? "") === (source ?? "") &&
      (params.status ?? "") === (status ?? "");
    return (
      <Link
        href={`/admin?${sp.toString()}`}
        className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
          active
            ? "bg-seum text-white"
            : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="mt-6 space-y-3">
      <div className="flex flex-wrap gap-2">
        {tab("전체", {})}
        {tab("방문예약", { source: "visit" })}
        {tab("call-os", { source: "call" })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_ORDER.map((s) =>
          tab(STATUS_LABEL[s], { status: s, ...(source ? { source } : {}) })
        )}
      </div>
      <form action="/admin" className="flex gap-2">
        {source && <input type="hidden" name="source" value={source} />}
        {status && <input type="hidden" name="status" value={status} />}
        <input
          name="q"
          defaultValue={q}
          placeholder="이름 또는 연락처 검색"
          className="w-64 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm outline-none focus:border-seum"
        />
        <button className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
          검색
        </button>
      </form>
    </div>
  );
}

function CustomerTable({ customers }: { customers: Customer[] }) {
  if (customers.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-400">
        조건에 맞는 고객이 없습니다.
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3 font-medium">고객</th>
            <th className="px-4 py-3 font-medium">유입</th>
            <th className="px-4 py-3 font-medium">희망일시</th>
            <th className="px-4 py-3 font-medium">담당</th>
            <th className="px-4 py-3 font-medium">상태</th>
            <th className="px-4 py-3 font-medium">접수일</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {customers.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50/50">
              <td className="px-4 py-3">
                <Link href={`/admin/${c.id}`} className="font-semibold text-gray-900 hover:text-seum">
                  {c.name}
                </Link>
                <div className="text-xs text-gray-400">{c.phone}</div>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                    c.source === "visit"
                      ? "bg-seum-light text-seum-dark"
                      : "bg-purple-100 text-purple-700"
                  }`}
                >
                  {SOURCE_LABEL[c.source]}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {formatDateTime(c.preferred_at)}
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {c.assigned_to || "-"}
              </td>
              <td className="px-4 py-3">
                <StatusSelect id={c.id} status={c.status} />
              </td>
              <td className="px-4 py-3 text-xs text-gray-400">
                {formatDateTime(c.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function computeStats(rows: Pick<Customer, "source" | "status">[]) {
  return {
    total: rows.length,
    visit: rows.filter((r) => r.source === "visit").length,
    call: rows.filter((r) => r.source === "call").length,
    newCount: rows.filter((r) => r.status === "new").length,
  };
}
