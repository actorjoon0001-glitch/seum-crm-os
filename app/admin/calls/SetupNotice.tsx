import { CALL_LEADS_SQL } from "@/lib/call-leads-sql";

export function isMissingTable(err: { code?: string; message?: string } | null) {
  if (!err) return false;
  return (
    err.code === "PGRST205" ||
    err.code === "42P01" ||
    (/call_leads/.test(err.message ?? "") &&
      /(not find|does not exist|schema cache)/i.test(err.message ?? ""))
  );
}

// call_leads 테이블이 아직 없을 때: 1회 실행할 SQL 안내
export default function CallsSetupNotice({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
      <p className="font-semibold">전화 고객 테이블(call_leads)을 처음 한 번 만들어야 합니다.</p>
      <p className="mt-1 text-xs text-amber-700">({message})</p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs">
        <li>Supabase 대시보드 → SQL Editor → New query</li>
        <li>아래 SQL 전체를 붙여넣고 Run</li>
        <li>이 화면을 새로고침하면 대표번호 / 영업사원 핸드폰 고객 등록이 바로 가능합니다.</li>
      </ol>
      <pre className="mt-3 max-h-72 select-all overflow-auto whitespace-pre rounded-lg bg-white p-3 text-[11px] leading-relaxed text-gray-700 ring-1 ring-amber-200">
        {CALL_LEADS_SQL}
      </pre>
    </div>
  );
}
