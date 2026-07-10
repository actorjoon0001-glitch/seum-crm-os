import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient, hasSupabaseEnv, ECONTRACTS_TABLE } from "@/lib/supabase/server";
import { formatManWon, formatDate } from "@/lib/format";
import type { EContract } from "@/lib/types";
import { econtractStatusMeta } from "@/lib/types";
import { requireAuth } from "@/lib/require-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}
function arr(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}
function str(v: unknown): string {
  if (v === null || v === undefined || typeof v === "object") return "";
  return String(v).trim();
}
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export default async function EContractDetail({
  params,
}: {
  params: { id: string };
}) {
  await requireAuth(`/admin/econtracts/${params.id}`);
  if (!hasSupabaseEnv()) {
    return <main className="mx-auto max-w-4xl px-6 py-10">Supabase 연결이 필요합니다.</main>;
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from(ECONTRACTS_TABLE)
    .select("*")
    .eq("id", params.id)
    .single();

  // PGRST116 = 해당 id 행 없음 → 404. 그 외(네트워크 등)는 에러 메시지 표시.
  if (error && error.code !== "PGRST116") {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link href="/admin/econtracts" className="text-xs text-gray-400 hover:text-gray-600">
          ← 전자계약 목록
        </Link>
        <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-600">
          데이터를 불러오지 못했습니다: {error.message}
        </div>
      </main>
    );
  }
  if (!data) notFound();
  const c = data as EContract;
  const d = obj(c.data);
  const client = obj(d.client);
  const amounts = obj(d.amounts);
  const items = arr(d.items).filter((it) => str(it.name));
  const extraCosts = arr(d.extraCosts).filter((e) => str(e.name) || num(e.amount));
  const terms = (Array.isArray(d.terms) ? d.terms : []).map(str).filter(Boolean);
  const extraNotes = str(d.extraNotes);
  const meta = econtractStatusMeta(c.status);

  const amountRows: { label: string; key: string }[] = [
    { label: "계약금", key: "downPayment" },
    { label: "중도금 1차", key: "interim1" },
    { label: "중도금 2차", key: "interim2" },
    { label: "중도금 3차", key: "interim3" },
    { label: "잔금", key: "balance" },
    { label: "공급가액", key: "itemsSupply" },
    { label: "부가세", key: "vat" },
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/admin/econtracts" className="text-xs text-gray-400 hover:text-gray-600">
        ← 전자계약 목록
      </Link>

      <header className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{c.client_name || "(이름없음)"}</h1>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meta.color}`}>
              {meta.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            계약번호 {c.contract_no || `#${c.id}`}
            {str(client.phone) ? ` · ${str(client.phone)}` : ""}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">총 계약금액</div>
          <div className="text-xl font-bold text-seum">
            {formatManWon(c.total_amount ?? num(amounts.productTotal))}
          </div>
        </div>
      </header>

      {/* 기본 정보 */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="계약일" value={formatDate(c.contract_date ?? null)} />
        <Field label="전시장" value={c.showroom || "-"} />
        <Field label="영업사원" value={c.salesperson || str(d.ownerName) || "-"} />
        <Field label="현장주소" value={c.site_address || str(d.siteAddress) || "-"} wide />
        <Field label="담당자 이메일" value={str(d.ownerEmail) || "-"} />
      </section>

      {/* 금액 상세 */}
      <h2 className="mt-8 text-sm font-bold text-gray-500">금액 상세</h2>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {amountRows.map((row) => {
          const v = num(amounts[row.key]);
          if (v === null || v === 0) return null;
          return <Field key={row.key} label={row.label} value={formatManWon(v)} />;
        })}
      </div>

      {/* 품목 */}
      {items.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-bold text-gray-500">계약 품목</h2>
          <div className="mt-2 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">품목</th>
                  <th className="px-4 py-2.5 font-medium">면적/수량</th>
                  <th className="px-4 py-2.5 text-right font-medium">단가</th>
                  <th className="px-4 py-2.5 text-right font-medium">금액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((it, i) => {
                  const amt = num(it.amount);
                  const unitPrice = num(it.unitPrice);
                  const area = str(it.area);
                  const unit = str(it.unit);
                  const note = str(it.note);
                  return (
                    <tr key={i} className="align-top">
                      <td className="px-4 py-2.5 text-xs text-gray-700">
                        {str(it.name)}
                        {note && <div className="mt-0.5 text-[11px] text-gray-400">{note}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">
                        {area ? `${area}${unit === "평당" ? "평" : ""}` : "-"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-500">
                        {unitPrice ? formatManWon(unitPrice) : "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right text-xs text-gray-700">
                        {amt ? formatManWon(amt) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 추가 비용 */}
      {extraCosts.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-bold text-gray-500">추가 비용</h2>
          <div className="mt-2 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
            {extraCosts.map((e, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-gray-700">{str(e.name)}</span>
                <span className="text-gray-600">{formatManWon(num(e.amount))}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 특이사항 */}
      {extraNotes && (
        <>
          <h2 className="mt-8 text-sm font-bold text-gray-500">특이사항</h2>
          <div className="mt-2 whitespace-pre-wrap rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
            {extraNotes}
          </div>
        </>
      )}

      {/* 계약 조건 */}
      {terms.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-bold text-gray-500">계약 조건</h2>
          <ol className="mt-2 list-decimal space-y-1 rounded-2xl border border-gray-200 bg-white p-4 pl-8 text-xs leading-relaxed text-gray-600">
            {terms.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
        </>
      )}
    </main>
  );
}

function Field({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-gray-100 bg-white px-3 py-2 ${wide ? "col-span-2" : ""}`}>
      <div className="text-[11px] text-gray-400">{label}</div>
      <div className="mt-0.5 text-sm text-gray-800">{value}</div>
    </div>
  );
}
