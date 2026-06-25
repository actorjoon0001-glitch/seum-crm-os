import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createServiceClient,
  hasSupabaseEnv,
  CONTRACTS_TABLE,
  DRAWINGS_TABLE,
} from "@/lib/supabase/server";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { PROGRESS_FLAGS, type Contract, type ContractDrawing } from "@/lib/types";

export const dynamic = "force-dynamic";

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i;

function isImage(d: ContractDrawing): boolean {
  const target = d.file_name || d.url || d.path || "";
  if (IMAGE_EXT.test(target)) return true;
  // 확장자가 없어도 kind 가 이미지/도면 류면 이미지로 시도
  return !/\.(pdf|hwp|docx?|xlsx?|zip)$/i.test(target);
}

export default async function ContractDetail({
  params,
}: {
  params: { id: string };
}) {
  if (!hasSupabaseEnv()) notFound();

  const supabase = createServiceClient();
  const { data } = await supabase
    .from(CONTRACTS_TABLE)
    .select("*")
    .eq("id", params.id)
    .single();

  if (!data) notFound();
  const c = data as Contract;

  // 계약서 사진: contract_drawings.contract_local_id = contracts.local_id
  let drawings: ContractDrawing[] = [];
  if (c.local_id) {
    const { data: rows } = await supabase
      .from(DRAWINGS_TABLE)
      .select("*")
      .eq("contract_local_id", c.local_id)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("uploaded_at", { ascending: true });
    drawings = (rows ?? []) as ContractDrawing[];
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">
        ← 고객관리 목록
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{c.customer_name || "(이름없음)"}</h1>
            {c.is_urgent && (
              <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
                긴급
              </span>
            )}
            {c.status && (
              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {c.status}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {c.showroom_id || "매장 미지정"} · 계약일 {formatDate(c.contract_date)}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">계약금액</div>
          <div className="text-xl font-bold text-seum">{formatCurrency(c.contract_amount)}</div>
        </div>
      </div>

      {/* 진행 단계 */}
      <div className="mt-5 flex flex-wrap gap-2">
        {PROGRESS_FLAGS.map((f) => {
          const on = Boolean(c[f.key]);
          return (
            <span
              key={f.key as string}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                on
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {on ? "✓ " : "· "}
              {f.label}
            </span>
          );
        })}
      </div>

      {/* 기본 정보 */}
      <Section title="계약 정보">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="모델" value={c.model_name} />
          <Field label="영업사원" value={c.sales_person} />
          <Field label="설계 담당" value={c.design_contact_name} />
          <Field label="허가 설계사" value={c.design_permit_designer} />
          <Field label="설계 상태" value={c.design_status} />
          <Field label="등록일" value={formatDateTime(c.created_at)} />
        </div>
      </Section>

      {/* 금액 */}
      <Section title="결제 정보">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="계약금액" value={formatCurrency(c.contract_amount)} />
          <Field label="계약금" value={formatCurrency(c.deposit)} />
          <Field label="중도금" value={formatCurrency(c.middle_payment)} />
          <Field label="잔금" value={formatCurrency(c.balance)} />
        </div>
      </Section>

      {/* 계약서 사진 */}
      <Section title={`계약서 사진 (${drawings.length})`}>
        {drawings.length === 0 ? (
          <p className="text-sm text-gray-400">첨부된 계약서 사진이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {drawings.map((d) => (
              <DrawingCard key={d.id} drawing={d} />
            ))}
          </div>
        )}
      </Section>
    </main>
  );
}

function DrawingCard({ drawing: d }: { drawing: ContractDrawing }) {
  const href = d.url || d.path || "#";
  const label = d.file_name || d.kind || "첨부파일";
  const image = isImage(d) && d.url;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:border-seum hover:shadow-md"
    >
      <div className="flex aspect-[4/3] items-center justify-center bg-gray-50">
        {image ? (
          // 외부 이미지 — next/image 도메인 설정 불필요하도록 일반 img 사용
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={d.url as string}
            alt={label}
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center text-gray-400">
            <span className="text-3xl">📄</span>
            <span className="mt-1 text-xs">파일 열기</span>
          </div>
        )}
      </div>
      <div className="truncate px-3 py-2 text-xs text-gray-600" title={label}>
        {d.kind && (
          <span className="mr-1 rounded bg-gray-100 px-1 py-0.5 text-[10px] text-gray-500">
            {d.kind}
          </span>
        )}
        {label}
      </div>
    </a>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3">
      <div className="text-xs font-medium text-gray-400">{label}</div>
      <div className="mt-0.5 text-sm text-gray-800">{value || "-"}</div>
    </div>
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
      {children}
    </section>
  );
}
