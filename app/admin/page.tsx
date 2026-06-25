import Link from "next/link";
import { createServiceClient, hasSupabaseEnv, CONTRACTS_TABLE, DRAWINGS_TABLE } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Contract } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type Search = {
  q?: string;
  showroom?: string;
  urgent?: string;
  photos?: string;
  page?: string;
};

function SetupNotice() {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-8">
      <h2 className="text-lg font-bold text-amber-900">⚙️ Supabase 연결이 필요합니다</h2>
      <p className="mt-2 text-sm text-amber-800">
        계약 데이터를 불러오려면 환경변수를 설정하세요. 프로젝트 루트의{" "}
        <code className="rounded bg-amber-100 px-1">.env.local</code> 에 아래 값을 채운 뒤
        서버를 재시작하면 됩니다.
      </p>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-amber-900 p-4 text-xs text-amber-50">
{`NEXT_PUBLIC_SUPABASE_URL=https://uqsswlunnpdhledmoarj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...`}
      </pre>
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
  const q = (searchParams.q ?? "").trim();
  const showroom = (searchParams.showroom ?? "").trim();
  const urgent = searchParams.urgent === "1";
  const hasPhotos = searchParams.photos === "1";
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // "사진 있는 계약만" 필터: 도면이 붙은 local_id 목록을 먼저 구함
  let photoLocalIds: string[] | null = null;
  if (hasPhotos) {
    const { data: dRows } = await supabase
      .from(DRAWINGS_TABLE)
      .select("contract_local_id")
      .not("contract_local_id", "is", null);
    photoLocalIds = Array.from(
      new Set(
        (dRows ?? [])
          .map((r) => (r as { contract_local_id: string }).contract_local_id)
          .filter(Boolean)
      )
    );
    if (photoLocalIds.length === 0) photoLocalIds = ["__none__"];
  }

  let query = supabase
    .from(CONTRACTS_TABLE)
    .select(
      "id,local_id,customer_name,sales_person,showroom_id,model_name,contract_date,contract_amount,status,is_urgent,created_at",
      { count: "exact" }
    )
    .or("is_deleted.is.null,is_deleted.eq.false")
    .order("contract_date", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (q) query = query.or(`customer_name.ilike.%${q}%,sales_person.ilike.%${q}%,model_name.ilike.%${q}%`);
  if (showroom) query = query.eq("showroom_id", showroom);
  if (urgent) query = query.eq("is_urgent", true);
  if (photoLocalIds) query = query.in("local_id", photoLocalIds);

  const { data, error, count } = await query;
  const contracts = (data ?? []) as Partial<Contract>[];

  // 이 페이지 계약들의 사진 개수 (local_id 기준)
  const localIds = contracts.map((c) => c.local_id).filter(Boolean) as string[];
  const photoCount = new Map<string, number>();
  if (localIds.length > 0) {
    const { data: drawings } = await supabase
      .from(DRAWINGS_TABLE)
      .select("contract_local_id")
      .in("contract_local_id", localIds);
    for (const d of drawings ?? []) {
      const k = (d as { contract_local_id: string | null }).contract_local_id;
      if (k) photoCount.set(k, (photoCount.get(k) ?? 0) + 1);
    }
  }

  // 통계(필터 무관)
  const stats = await loadStats(supabase);

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Header />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="전체 계약" value={stats.total} />
        <StatCard label="긴급" value={stats.urgent} accent="text-red-600" />
        <StatCard label="계약서 사진" value={stats.photos} accent="text-seum" />
        <StatCard label="이번달 계약" value={stats.thisMonth} accent="text-purple-600" />
      </div>

      <Filters
        q={q}
        showroom={showroom}
        urgent={urgent}
        hasPhotos={hasPhotos}
        showrooms={stats.showrooms}
      />

      {error ? (
        <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-600">
          데이터를 불러오지 못했습니다: {error.message}
        </div>
      ) : (
        <>
          <p className="mt-4 text-xs text-gray-400">
            총 {count ?? contracts.length}건 중 {from + 1}–{from + contracts.length}건 표시
          </p>
          <ContractTable contracts={contracts} photoCount={photoCount} />
          <Pagination
            page={page}
            totalPages={totalPages}
            params={{ q, showroom, urgent: urgent ? "1" : "", photos: hasPhotos ? "1" : "" }}
          />
        </>
      )}
    </main>
  );
}

async function loadStats(supabase: ReturnType<typeof createServiceClient>) {
  const notDeleted = "is_deleted.is.null,is_deleted.eq.false";

  const { count: total } = await supabase
    .from(CONTRACTS_TABLE)
    .select("id", { count: "exact", head: true })
    .or(notDeleted);

  const { count: urgent } = await supabase
    .from(CONTRACTS_TABLE)
    .select("id", { count: "exact", head: true })
    .or(notDeleted)
    .eq("is_urgent", true);

  const { count: photos } = await supabase
    .from(DRAWINGS_TABLE)
    .select("id", { count: "exact", head: true });

  // 이번달 계약
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const { count: thisMonth } = await supabase
    .from(CONTRACTS_TABLE)
    .select("id", { count: "exact", head: true })
    .or(notDeleted)
    .gte("contract_date", monthStart);

  // 매장 목록(필터용)
  const { data: showroomRows } = await supabase
    .from(CONTRACTS_TABLE)
    .select("showroom_id")
    .or(notDeleted)
    .not("showroom_id", "is", null)
    .limit(2000);
  const showrooms = Array.from(
    new Set((showroomRows ?? []).map((r) => (r as { showroom_id: string }).showroom_id))
  ).sort();

  return {
    total: total ?? 0,
    urgent: urgent ?? 0,
    photos: photos ?? 0,
    thisMonth: thisMonth ?? 0,
    showrooms,
  };
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
        <p className="mt-0.5 text-sm text-gray-500">수기 계약 고객 · 계약서 사진</p>
      </div>
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
  q,
  showroom,
  urgent,
  hasPhotos,
  showrooms,
}: {
  q: string;
  showroom: string;
  urgent: boolean;
  hasPhotos: boolean;
  showrooms: string[];
}) {
  return (
    <form action="/admin" className="mt-6 flex flex-wrap items-center gap-2">
      <input
        name="q"
        defaultValue={q}
        placeholder="고객명 · 영업사원 · 모델 검색"
        className="w-64 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm outline-none focus:border-seum"
      />
      <select
        name="showroom"
        defaultValue={showroom}
        className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-seum"
      >
        <option value="">전체 매장</option>
        {showrooms.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm">
        <input type="checkbox" name="urgent" value="1" defaultChecked={urgent} />
        긴급만
      </label>
      <label className="flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm">
        <input type="checkbox" name="photos" value="1" defaultChecked={hasPhotos} />
        📷 사진있는 계약만
      </label>
      <button className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
        검색
      </button>
      {(q || showroom || urgent || hasPhotos) && (
        <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">
          초기화
        </Link>
      )}
    </form>
  );
}

function ContractTable({
  contracts,
  photoCount,
}: {
  contracts: Partial<Contract>[];
  photoCount: Map<string, number>;
}) {
  if (contracts.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-400">
        조건에 맞는 계약이 없습니다.
      </div>
    );
  }

  return (
    <div className="mt-2 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3 font-medium">고객</th>
            <th className="px-4 py-3 font-medium">매장</th>
            <th className="px-4 py-3 font-medium">모델</th>
            <th className="px-4 py-3 font-medium">영업</th>
            <th className="px-4 py-3 font-medium">계약일</th>
            <th className="px-4 py-3 text-right font-medium">계약금액</th>
            <th className="px-4 py-3 text-center font-medium">사진</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {contracts.map((c) => {
            const photos = c.local_id ? photoCount.get(c.local_id) ?? 0 : 0;
            return (
              <tr key={c.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/${c.id}`}
                    className="font-semibold text-gray-900 hover:text-seum"
                  >
                    {c.customer_name || "(이름없음)"}
                  </Link>
                  {c.is_urgent && (
                    <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                      긴급
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{c.showroom_id || "-"}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{c.model_name || "-"}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{c.sales_person || "-"}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{formatDate(c.contract_date ?? null)}</td>
                <td className="px-4 py-3 text-right text-xs text-gray-700">
                  {formatCurrency(c.contract_amount ?? null)}
                </td>
                <td className="px-4 py-3 text-center">
                  {photos > 0 ? (
                    <Link
                      href={`/admin/${c.id}`}
                      className="inline-flex items-center gap-1 rounded-full bg-seum-light px-2 py-0.5 text-xs font-semibold text-seum-dark hover:bg-seum hover:text-white"
                    >
                      📷 {photos}
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-300">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
    return `/admin?${sp.toString()}`;
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
