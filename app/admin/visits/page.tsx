import Link from "next/link";
import {
  createServiceClient,
  hasSupabaseEnv,
  APPOINTMENTS_TABLE,
  LEADS_TABLE,
} from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { showroomLabel } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Appointment {
  id: string;
  lead_id: string | null;
  showroom: string | null;
  visit_at: string | null;
  people: number | null;
  status: string | null;
  memo: string | null;
  created_at: string;
}

// leads 테이블 컬럼이 확정되기 전이라, 흔한 키들을 방어적으로 읽습니다.
type LeadRow = Record<string, unknown>;
function pick(row: LeadRow | undefined, keys: string[]): string {
  if (!row) return "";
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "number") return String(v);
  }
  return "";
}

export default async function VisitsPage() {
  if (!hasSupabaseEnv()) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Header />
        <p className="mt-8 text-sm text-gray-400">
          Supabase 연결이 필요합니다. (.env / 배포 환경변수 확인)
        </p>
      </main>
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from(APPOINTMENTS_TABLE)
    .select("*")
    .order("visit_at", { ascending: false, nullsFirst: false })
    .limit(300);

  const appointments = (data ?? []) as Appointment[];

  // 리드(고객정보) 매핑
  const leadIds = Array.from(
    new Set(appointments.map((a) => a.lead_id).filter(Boolean))
  ) as string[];
  const leadMap = new Map<string, LeadRow>();
  if (leadIds.length > 0) {
    const { data: leads } = await supabase
      .from(LEADS_TABLE)
      .select("*")
      .in("id", leadIds);
    for (const l of (leads ?? []) as LeadRow[]) {
      const id = l.id;
      if (typeof id === "string") leadMap.set(id, l);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Header />

      {error ? (
        <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-700">
          방문예약 데이터를 불러오지 못했습니다: {error.message}
          <p className="mt-1 text-xs text-amber-500">
            appointments 테이블 이름이 다르면 환경변수 SUPABASE_APPOINTMENTS_TABLE 로 지정하세요.
          </p>
        </div>
      ) : appointments.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-400">
          아직 등록된 방문예약이 없습니다.
        </div>
      ) : (
        <>
          <p className="mt-6 text-xs text-gray-400">총 {appointments.length}건</p>
          <div className="mt-2 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">고객</th>
                  <th className="px-4 py-3 font-medium">방문일시</th>
                  <th className="px-4 py-3 font-medium">전시장</th>
                  <th className="px-4 py-3 text-center font-medium">인원</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  <th className="px-4 py-3 font-medium">메모</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {appointments.map((a) => {
                  const lead = a.lead_id ? leadMap.get(a.lead_id) : undefined;
                  const name = pick(lead, ["name", "customer_name", "client_name"]) || "(이름없음)";
                  const phone = pick(lead, ["phone", "phone_number", "contact", "tel", "mobile"]);
                  return (
                    <tr key={a.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{name}</div>
                        {phone && <div className="text-xs text-gray-400">{phone}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {formatDateTime(a.visit_at)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {showroomLabel(a.showroom)}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500">
                        {a.people ? `${a.people}명` : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {a.status ? (
                          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            {a.status}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        <span className="line-clamp-2">{a.memo || "-"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
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
          방문예약 <span className="text-seum">고객</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">방문예약한 고객 목록</p>
      </div>
      <Link
        href="/admin"
        className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:border-seum hover:text-seum"
      >
        계약 고객 →
      </Link>
    </header>
  );
}
