export function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCurrency(value: number | null): string {
  if (value === null || value === undefined || Number.isNaN(Number(value)))
    return "-";
  const n = Math.round(Number(value));
  if (n === 0) return "0원";
  const neg = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs < 10000) return neg + abs.toLocaleString("ko-KR") + "원";

  const eok = Math.floor(abs / 100000000);
  const man = Math.floor((abs % 100000000) / 10000);
  const parts: string[] = [];
  if (eok > 0) parts.push(`${eok.toLocaleString("ko-KR")}억`);
  if (man > 0) parts.push(`${man.toLocaleString("ko-KR")}만`);
  return neg + parts.join(" ") + "원";
}

// "2026-05" → "2026년 5월"
export function monthLabel(ym: string): string {
  if (!ym) return "계약일 미정";
  const [y, m] = ym.split("-");
  return `${y}년 ${Number(m)}월`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
