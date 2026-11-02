// Supabase 테이블이 아직 생성되지 않았을 때의 에러인지 판별
export function isMissingTable(
  err: { code?: string; message?: string } | null | undefined,
  table?: string
) {
  if (!err) return false;
  if (err.code === "PGRST205" || err.code === "42P01") return true;
  const msg = err.message ?? "";
  return (
    (!table || msg.includes(table)) &&
    /(could not find the table|does not exist|schema cache)/i.test(msg)
  );
}
