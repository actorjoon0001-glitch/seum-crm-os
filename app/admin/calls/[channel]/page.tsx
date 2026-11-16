import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceClient, hasSupabaseEnv, CALLS_TABLE } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/require-auth";
import {
  CALL_CHANNELS,
  CALL_STATUSES,
  isCallChannel,
  type CallLead,
} from "@/lib/types";
import { kstNowInputValue, kstShort } from "@/lib/kst";
import AppNav from "@/app/AppNav";
import DupBadge from "@/app/DupBadge";
import { buildPhoneIndex, otherRefs } from "@/lib/dedupe";
import CallForm from "../CallForm";
import CallsSetupNotice, { isMissingTable } from "../SetupNotice";
import { CallStatusSelect, CallGradeSelect, CallBranchSelect, CallTextInput, CallDeleteButton } from "../CallRowControls";
import { getBranches } from "@/lib/staff";
import { GRADES } from "@/lib/sales-db";
import GradeLegend from "@/app/admin/logs/GradeLegend";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type Search = { q?: string; sp?: string; status?: string; grade?: string; branch?: string };

export default async function CallsPage({
  params,
  searchParams,
}: {
  params: { channel: string };
  searchParams: Search;
}) {
  const channel = params.channel;
  if (!isCallChannel(channel)) notFound();
  // 영업사원 영업폰 화면은 폐지 — 개인 영업폰 고객은 고객DB · 일지에 기록
  if (channel === "mobile") redirect("/admin/logs");
  await requireAuth(`/admin/calls/${channel}`);
  const meta = CALL_CHANNELS[channel];
  const isMobile = (channel as string) === "mobile";

  const shell = (body: React.ReactNode) => (
    <main className="mx-auto max-w-none px-4 py-6">
      <AppNav active={channel} />
      <div className="mt-5">
        <h1 className="text-2xl font-bold">
          {meta.icon} {meta.label}
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">{meta.desc}</p>
      </div>
      <div className="mt-5 space-y-4">{body}</div>
    </main>
  );

  if (!hasSupabaseEnv()) return shell(<p className="text-sm text-gray-400">Supabase 연결이 필요합니다.</p>);

  const supabase = createServiceClient();
  const q = (searchParams.q ?? "").trim();
  const sp = (searchParams.sp ?? "").trim();
  const status = (searchParams.status ?? "").trim();
  const gradeFilter = (searchParams.grade ?? "").trim();
  const branchFilter = !isMobile ? (searchParams.branch ?? "").trim() : "";

  let query = supabase
    .from(CALLS_TABLE)
    .select("*")
    .eq("channel", channel)
    .order("called_at", { ascending: false })
    .limit(500);
  if (q) {
    const safe = q.replace(/[,()]/g, " ");
    query = query.or(
      `name.ilike.%${safe}%,phone.ilike.%${safe}%,region.ilike.%${safe}%,inquiry.ilike.%${safe}%,memo.ilike.%${safe}%`
    );
  }
  if (sp) query = query.eq("salesperson", sp);
  if (status) query = query.eq("status", status);
  if (gradeFilter) query = query.eq("grade", gradeFilter);
  if (branchFilter === "__none__") query = query.is("branch", null);
  else if (branchFilter) query = query.eq("branch", branchFilter);

  const { data, error } = await query;
  if (error) {
    return shell(
      isMissingTable(error) ? (
        <CallsSetupNotice message={error.message} />
      ) : (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          불러오기 실패: {error.message}
        </div>
      )
    );
  }
  const rows = (data ?? []) as CallLead[];
  // 고객등급 칸이 아직 없으면 안내
  const { error: gradeColErr } = await supabase.from(CALLS_TABLE).select("grade").limit(1);
  const gradeColMissing = !!gradeColErr && /grade/.test(gradeColErr.message);
  const { error: branchColErr } = await supabase.from(CALLS_TABLE).select("branch,handed_at").limit(1);
  const branchColMissing = !isMobile && !!branchColErr && /branch|handed_at/.test(branchColErr.message);
  // 넘길 전시장 목록 (세움OS 직원 소속 전시장)
  const branches = isMobile ? [] : await getBranches(supabase);
  // 같은 연락처가 방문예약 · 다른 전화 · 고객DB 에도 있는지
  const phoneIdx = await buildPhoneIndex(supabase);

  // 영업사원 목록(필터 / 자동완성)
  const { data: spRows } = await supabase
    .from(CALLS_TABLE)
    .select("salesperson")
    .not("salesperson", "is", null)
    .limit(3000);
  const salespeople = Array.from(
    new Set((spRows ?? []).map((r) => String(r.salesperson ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "ko"));

  // 영업사원별 건수 (영업폰 DB 화면에서 한눈에)
  const perSp = new Map<string, number>();
  if (isMobile && !sp && !q && !status) {
    for (const r of rows) {
      const k = r.salesperson?.trim() || "(미지정)";
      perSp.set(k, (perSp.get(k) ?? 0) + 1);
    }
  }

  const base = `/admin/calls/${channel}`;

  return shell(
    <>
      <CallForm channel={channel} defaultCalledAt={kstNowInputValue()} salespeople={salespeople} branches={branches} />

      {perSp.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from(perSp.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([name, n]) => (
              <Link
                key={name}
                href={name === "(미지정)" ? base : `${base}?sp=${encodeURIComponent(name)}`}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm hover:border-seum hover:text-seum"
              >
                {name} <span className="text-seum">{n}</span>
              </Link>
            ))}
        </div>
      )}

      {(gradeColMissing || branchColMissing) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">
            {[gradeColMissing && "고객등급(A~E)", branchColMissing && "전시장 넘기기"].filter(Boolean).join(" · ")}을 쓰려면 Supabase SQL
            Editor에서 아래를 한 번 실행해 주세요.
          </p>
          <pre className="mt-2 select-all whitespace-pre rounded-lg bg-white p-2 text-xs ring-1 ring-amber-200">
            {[
              gradeColMissing && "alter table public.call_leads add column if not exists grade text;",
              branchColMissing && "alter table public.call_leads add column if not exists branch text;",
              branchColMissing && "alter table public.call_leads add column if not exists handed_at timestamptz;",
            ]
              .filter(Boolean)
              .join("\n")}
          </pre>
        </div>
      )}

      <form action={base} className="flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="이름 · 연락처 · 지역 · 내용 검색"
          className="w-64 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm outline-none focus:border-seum"
        />
        <select
          name="sp"
          defaultValue={sp}
          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-seum"
        >
          <option value="">전체 영업사원</option>
          {salespeople.map((s) => (
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
          {CALL_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          name="grade"
          defaultValue={gradeFilter}
          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-seum"
        >
          <option value="">전체 고객등급</option>
          {GRADES.map((g) => (
            <option key={g.value} value={g.value}>
              {g.value}등급
            </option>
          ))}
        </select>
        {!isMobile && (
          <select
            name="branch"
            defaultValue={branchFilter}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-seum"
          >
            <option value="">전체 (넘긴 전시장)</option>
            <option value="__none__">아직 안 넘김</option>
            {branches.map((b) => (
              <option key={b} value={b}>
                → {b}
              </option>
            ))}
          </select>
        )}
        <button className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white">검색</button>
        {(q || sp || status || gradeFilter || branchFilter) && (
          <Link href={base} className="text-sm text-gray-400 hover:text-gray-600">
            초기화
          </Link>
        )}
        <span className="ml-auto text-sm text-gray-500">총 {rows.length}건</span>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-400">
          {q || sp || status || gradeFilter || branchFilter ? "조건에 맞는 고객이 없습니다." : "아직 등록된 전화 고객이 없습니다. 위에서 1건씩 등록하세요."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full table-fixed text-left text-xs">
            <colgroup>
              <col className="w-[8%]" />{/* 통화일시 */}
              <col className="w-[11%]" />{/* 고객 */}
              <col className="w-[10%]" />{/* 지역 */}
              <col className={isMobile ? "w-[19%]" : "w-[16%]"} />{/* 문의 내용 */}
              <col className="w-[8%]" />{/* 상태 */}
              <col className="w-[5%]" />{/* 고객등급 */}
              {!isMobile && <col className="w-[9%]" />}{/* 넘길 전시장 */}
              <col className="w-[9%]" />{/* 영업사원 */}
              <col className={isMobile ? "w-[24%]" : "w-[18%]"} />{/* 직원 메모 */}
              <col className="w-[6%]" />{/* 삭제 */}
            </colgroup>
            <thead className="border-b border-gray-100 bg-gray-50 text-gray-500">
              <tr>
                <th className="px-2.5 py-2 font-medium">통화일시</th>
                <th className="px-2.5 py-2 font-medium">고객</th>
                <th className="px-2.5 py-2 font-medium">지역 / 토지위치</th>
                <th className="px-2.5 py-2 font-medium">문의 내용</th>
                <th className="px-2.5 py-2 font-medium">상태</th>
                <th className="px-2.5 py-2 font-medium">고객등급</th>
                {!isMobile && <th className="px-2.5 py-2 font-medium">넘길 전시장</th>}
                <th className="px-2.5 py-2 font-medium">{isMobile ? "영업사원" : "담당 영업사원"}</th>
                <th className="px-2.5 py-2 font-medium">직원 메모</th>
                <th className="px-2.5 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r) => {
                const name = r.name || "(이름없음)";
                return (
                  <tr key={r.id} className="align-top hover:bg-gray-50/50">
                    <td className="whitespace-nowrap px-2.5 py-2 text-gray-500">{kstShort(r.called_at)}</td>
                    <td className="px-2.5 py-2">
                      <div className="font-semibold text-gray-900">{name}</div>
                      {r.phone && (
                        <a href={`tel:${r.phone}`} className="text-gray-400 hover:text-seum">
                          {r.phone}
                        </a>
                      )}
                      <DupBadge refs={otherRefs(phoneIdx, r.phone, { kind: channel === "main" ? "main" : "mobile", id: r.id })} />
                    </td>
                    <td className="break-words px-2.5 py-2 text-gray-600">{r.region || "-"}</td>
                    <td className="whitespace-pre-wrap break-words px-2.5 py-2 text-gray-600">
                      {r.inquiry || "-"}
                    </td>
                    <td className="px-2.5 py-2">
                      <CallStatusSelect id={r.id} status={r.status} />
                    </td>
                    <td className="px-1.5 py-2">
                      <CallGradeSelect id={r.id} grade={r.grade} />
                    </td>
                    {!isMobile && (
                      <td className="px-1.5 py-2">
                        <CallBranchSelect id={r.id} branch={r.branch} handedAt={r.handed_at} branches={branches} />
                      </td>
                    )}
                    <td className="px-2.5 py-2">
                      <CallTextInput id={r.id} field="salesperson" value={r.salesperson} placeholder="영업사원" />
                    </td>
                    <td className="px-2.5 py-2">
                      <CallTextInput id={r.id} field="memo" value={r.memo} placeholder="직원 메모" multiline />
                    </td>
                    <td className="px-2.5 py-2 text-right">
                      <CallDeleteButton id={r.id} name={name} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <GradeLegend />
    </>
  );
}
