import Link from "next/link";
import { requireAuth } from "@/lib/require-auth";
import {
  createServiceClient,
  hasSupabaseEnv,
  VISITS_TABLE,
  CALLS_TABLE,
} from "@/lib/supabase/server";
import {
  CALL_CHANNELS,
  callStatusMeta,
  type CallChannel,
  type CallLead,
  type VisitReservation,
} from "@/lib/types";
import { kstMonthStartISO, kstShort, kstTodayStartISO } from "@/lib/kst";
import { vf, statusMeta } from "@/app/admin/visits/fields";
import AppNav from "@/app/AppNav";
import { isMissingTable } from "@/app/admin/calls/SetupNotice";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const RECENT = 8;

type Stats = { today: number; month: number; total: number; pending: number };
type Item = {
  id: string;
  href: string;
  name: string;
  phone: string;
  when: string;
  sub: string;
  status: { label: string; color: string };
};
type Column = {
  key: string;
  icon: string;
  title: string;
  desc: string;
  href: string;
  stats: Stats | null;
  items: Item[];
  error?: string;
  needsSetup?: boolean;
};

export default async function Home() {
  await requireAuth("/");

  let columns: Column[] = [];
  if (hasSupabaseEnv()) {
    const supabase = createServiceClient();
    const todayStart = kstTodayStartISO();
    const monthStart = kstMonthStartISO();

    // ---------- 1) 방문예약 ----------
    const visitColumn = async (): Promise<Column> => {
      const col: Column = {
        key: "visits",
        icon: "🏠",
        title: "방문예약 고객",
        desc: "방문예약폼으로 접수된 고객",
        href: "/admin/visits",
        stats: null,
        items: [],
      };
      const cnt = (f?: (q: any) => any) => {
        let q = supabase.from(VISITS_TABLE).select("id", { count: "exact", head: true });
        if (f) q = f(q);
        return q;
      };
      const [total, today, month, pending, recent] = await Promise.all([
        cnt(),
        cnt((q) => q.gte("submitted_at", todayStart)),
        cnt((q) => q.gte("submitted_at", monthStart)),
        cnt((q) => q.or("status.is.null,status.eq.new")),
        supabase
          .from(VISITS_TABLE)
          .select("*")
          .order("submitted_at", { ascending: false, nullsFirst: false })
          .limit(RECENT),
      ]);
      if (recent.error) {
        col.error = recent.error.message;
        return col;
      }
      col.stats = {
        total: total.count ?? 0,
        today: today.count ?? 0,
        month: month.count ?? 0,
        pending: pending.count ?? 0,
      };
      col.items = ((recent.data ?? []) as VisitReservation[]).map((r) => {
        const vdate = vf(r, ["visitDate"], "visit_date");
        const vtime = vf(r, ["visitTime"], "visit_time");
        const interest = vf(r, ["houseType", "interestType"], "interest_type");
        return {
          id: r.id,
          href: `/admin/visits/${r.id}`,
          name: vf(r, ["name"], "name") || "(이름없음)",
          phone: vf(r, ["phone"], "phone"),
          when: kstShort(r.submitted_at ?? r.created_at),
          sub: [vdate && `방문 ${vdate}${vtime ? ` ${vtime}` : ""}`, interest, r.assigned_to]
            .filter(Boolean)
            .join(" · "),
          status: statusMeta(r.status),
        };
      });
      return col;
    };

    // ---------- 2) 3) 전화 고객 ----------
    const callColumn = async (channel: CallChannel): Promise<Column> => {
      const meta = CALL_CHANNELS[channel];
      const col: Column = {
        key: channel,
        icon: meta.icon,
        title: meta.label,
        desc: meta.desc,
        href: `/admin/calls/${channel}`,
        stats: null,
        items: [],
      };
      const cnt = (f?: (q: any) => any) => {
        let q = supabase
          .from(CALLS_TABLE)
          .select("id", { count: "exact", head: true })
          .eq("channel", channel);
        if (f) q = f(q);
        return q;
      };
      const [total, today, month, pending, recent] = await Promise.all([
        cnt(),
        cnt((q) => q.gte("called_at", todayStart)),
        cnt((q) => q.gte("called_at", monthStart)),
        cnt((q) => q.eq("status", "new")),
        supabase
          .from(CALLS_TABLE)
          .select("*")
          .eq("channel", channel)
          .order("called_at", { ascending: false })
          .limit(RECENT),
      ]);
      if (recent.error) {
        col.error = recent.error.message;
        col.needsSetup = isMissingTable(recent.error);
        return col;
      }
      col.stats = {
        total: total.count ?? 0,
        today: today.count ?? 0,
        month: month.count ?? 0,
        pending: pending.count ?? 0,
      };
      col.items = ((recent.data ?? []) as CallLead[]).map((r) => ({
        id: r.id,
        href: col.href,
        name: r.name || "(이름없음)",
        phone: r.phone ?? "",
        when: kstShort(r.called_at),
        sub: [r.salesperson, r.region, r.inquiry].filter(Boolean).join(" · "),
        status: callStatusMeta(r.status),
      }));
      return col;
    };

    columns = await Promise.all([visitColumn(), callColumn("main"), callColumn("mobile")]);
  }

  const sum = (k: keyof Stats) => columns.reduce((a, c) => a + (c.stats?.[k] ?? 0), 0);

  return (
    <main className="mx-auto max-w-none px-4 py-6">
      <AppNav active="home" />

      {!hasSupabaseEnv() ? (
        <p className="mt-8 text-sm text-gray-400">Supabase 연결이 필요합니다.</p>
      ) : (
        <>
          {/* 전체 합계 */}
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Total label="오늘 들어온 고객" value={sum("today")} accent />
            <Total label="이번 달 고객" value={sum("month")} />
            <Total label="신규 · 미처리" value={sum("pending")} />
            <Total label="전체 고객 DB" value={sum("total")} />
          </div>

          {/* 3개 카테고리 한눈에 */}
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {columns.map((c) => (
              <CategoryCard key={c.key} col={c} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function Total({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        accent ? "border-seum bg-seum-light" : "border-gray-200 bg-white"
      }`}
    >
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ? "text-seum-dark" : "text-gray-900"}`}>
        {value.toLocaleString("ko-KR")}
        <span className="ml-0.5 text-sm font-semibold text-gray-400">명</span>
      </div>
    </div>
  );
}

function CategoryCard({ col }: { col: Column }) {
  return (
    <section className="flex flex-col rounded-2xl border border-gray-200 bg-white shadow-sm">
      <header className="flex items-start justify-between border-b border-gray-100 p-4">
        <div>
          <h2 className="text-lg font-bold">
            {col.icon} {col.title}
          </h2>
          <p className="text-xs text-gray-400">{col.desc}</p>
        </div>
        <Link
          href={col.href}
          className="whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-seum"
        >
          {col.key === "visits" ? "전체 보기 →" : "등록 · 전체 보기 →"}
        </Link>
      </header>

      {col.stats && (
        <div className="grid grid-cols-4 divide-x divide-gray-100 border-b border-gray-100 text-center">
          <Stat label="오늘" value={col.stats.today} strong />
          <Stat label="이번 달" value={col.stats.month} />
          <Stat label="신규" value={col.stats.pending} />
          <Stat label="전체" value={col.stats.total} />
        </div>
      )}

      <div className="flex-1 p-2">
        {col.needsSetup ? (
          <div className="m-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            전화 고객 테이블을 처음 한 번 만들어야 합니다.
            <Link href={col.href} className="mt-1 block font-semibold underline">
              설정 안내 보기 →
            </Link>
          </div>
        ) : col.error ? (
          <div className="m-2 rounded-xl bg-red-50 p-4 text-xs text-red-700">불러오기 실패: {col.error}</div>
        ) : col.items.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">아직 고객이 없습니다.</div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {col.items.map((it) => (
              <li key={it.id}>
                <Link href={it.href} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-semibold text-gray-900">{it.name}</span>
                      {it.phone && <span className="shrink-0 text-xs text-gray-400">{it.phone}</span>}
                    </div>
                    {it.sub && <div className="truncate text-xs text-gray-500">{it.sub}</div>}
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${it.status.color}`}
                    >
                      {it.status.label}
                    </span>
                    <div className="mt-0.5 text-[11px] text-gray-400">{it.when}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="py-2.5">
      <div className="text-[11px] text-gray-400">{label}</div>
      <div className={`text-lg font-bold ${strong ? "text-seum" : "text-gray-800"}`}>
        {value.toLocaleString("ko-KR")}
      </div>
    </div>
  );
}
