import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createServiceClient,
  hasSupabaseEnv,
  VISITS_TABLE,
} from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import type { VisitReservation } from "@/lib/types";
import { getPayload, payloadEntries, vf } from "../fields";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function VisitDetail({
  params,
}: {
  params: { id: string };
}) {
  if (!hasSupabaseEnv()) notFound();

  const supabase = createServiceClient();
  const { data } = await supabase
    .from(VISITS_TABLE)
    .select("*")
    .eq("id", params.id)
    .single();

  if (!data) notFound();
  const r = data as VisitReservation;

  const name = vf(r, ["name"], "name") || "(이름없음)";
  const phone = vf(r, ["phone"], "phone");
  const entries = payloadEntries(r); // 신규 폼: 제출한 모든 항목
  const memo = vf(r, ["memo"], "memo");
  const hasPayload = getPayload(r) !== null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin/visits" className="text-sm text-gray-400 hover:text-gray-600">
        ← 방문예약 목록
      </Link>

      <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{name}</h1>
          {phone && (
            <a href={`tel:${phone}`} className="mt-1 block text-sm text-seum">
              {phone}
            </a>
          )}
        </div>
        <div className="text-right text-xs text-gray-400">
          접수 {formatDateTime(r.submitted_at)}
        </div>
      </div>

      {hasPayload ? (
        // 신규 폼: 고객이 남긴 모든 항목을 그대로 표시
        <Section title="신청 내용">
          {entries
            .filter((e) => e.key !== "memo")
            .map((e) => (
              <Field
                key={e.key}
                label={e.label}
                value={e.value}
                full={e.key === "landAddress" || e.key === "addrJibun"}
              />
            ))}
        </Section>
      ) : (
        // 기존 데이터(컬럼 기반)
        <>
          <Section title="방문 정보">
            <Field label="방문일" value={r.visit_date} />
            <Field label="방문시간" value={r.visit_time} />
            <Field label="방문인원" value={r.visitor_count} />
            <Field label="유입경로" value={r.source} />
          </Section>
          <Section title="관심/예산">
            <Field label="관심상품유형" value={r.interest_type} />
            <Field label="희망평수" value={r.size} />
            <Field label="예산범위" value={r.budget} />
            <Field label="토지보유여부" value={r.land_owned} />
            <Field label="지번주소" value={r.addr_jibun} full />
          </Section>
        </>
      )}

      {memo && (
        <Section title="메모">
          <div className="whitespace-pre-wrap rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-700 sm:col-span-2">
            {memo}
          </div>
        </Section>
      )}
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-bold text-gray-500">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  full,
}: {
  label: string;
  value: string | null;
  full?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-gray-100 bg-white p-3 ${full ? "sm:col-span-2" : ""}`}>
      <div className="text-xs font-medium text-gray-400">{label}</div>
      <div className="mt-0.5 text-sm text-gray-800">{value || "-"}</div>
    </div>
  );
}
