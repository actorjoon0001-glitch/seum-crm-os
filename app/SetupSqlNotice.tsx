// 테이블이 아직 없을 때: Supabase SQL Editor 에서 1회 실행할 SQL 안내
export default function SetupSqlNotice({
  title,
  table,
  sql,
  message,
  after,
}: {
  title: string;
  table: string;
  sql: string;
  message: string;
  after: string;
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
      <p className="font-semibold">
        {title}({table})을 처음 한 번 만들어야 합니다.
      </p>
      <p className="mt-1 text-xs text-amber-700">({message})</p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs">
        <li>Supabase 대시보드 → SQL Editor → New query</li>
        <li>아래 SQL 전체를 붙여넣고 Run</li>
        <li>이 화면을 새로고침하면 {after}</li>
      </ol>
      <pre className="mt-3 max-h-72 select-all overflow-auto whitespace-pre rounded-lg bg-white p-3 text-[11px] leading-relaxed text-gray-700 ring-1 ring-amber-200">
        {sql}
      </pre>
    </div>
  );
}
