import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createServiceClient,
  hasSupabaseEnv,
  VISITS_TABLE,
} from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import type { VisitReservation } from "@/lib/types";

export const dynamic = "force-dynamic";

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

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin/visits" className="text-sm text-gray-400 hover:text-gray-600">
        ← 방문예약 목록
      </Link>

      <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{r.name || "(이름없음)"}</h1>
          {r.phone && (
            <a href={`tel:${r.phone}`} className="mt-1 block text-sm text-seum">
              {r.phone}
            </a>
          )}
        </div>
        <div className="text-right text-xs text-gray-400">
          접수 {formatDateTime(r.submitted_at)}
        </div>
      </div>

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

      <Section title="LG이벤트 / 3D도면">
        <Field label="LG이벤트 적용" value={r.lg_event_apply} />
        <Field label="LG이벤트 대상" value={r.lg_event_target} />
        <Field label="LG Gift" value={r.lg_gift} />
        <Field label="3D도면 희망" value={r.want_3d} />
        <Field label="3D 희망평수" value={r.three_d_size} />
        <Field label="방 개수" value={r.room_count} />
        <Field label="화장실 개수" value={r.bath_count} />
      </Section>

      {r.memo && (
        <Section title="메모">
          <div className="col-span-2 whitespace-pre-wrap rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-700">
            {r.memo}
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
