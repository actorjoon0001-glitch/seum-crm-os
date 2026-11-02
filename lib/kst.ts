// 한국시간(KST, UTC+9) 기준 날짜 계산 헬퍼. 서버(Netlify)는 UTC로 돌기 때문에 직접 보정한다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");

// 현재 시각을 KST 벽시계 기준 Date(UTC 필드로 읽음)로
function kstNow(): Date {
  return new Date(Date.now() + KST_OFFSET_MS);
}

// 오늘 00:00 KST 를 ISO(UTC) 로
export function kstTodayStartISO(): string {
  const k = kstNow();
  return new Date(
    Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()) - KST_OFFSET_MS
  ).toISOString();
}

// 이번 달 1일 00:00 KST 를 ISO(UTC) 로
export function kstMonthStartISO(): string {
  const k = kstNow();
  return new Date(
    Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), 1) - KST_OFFSET_MS
  ).toISOString();
}

// <input type="datetime-local"> 기본값(현재 KST) "YYYY-MM-DDTHH:mm"
export function kstNowInputValue(): string {
  const k = kstNow();
  return `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())}T${pad(
    k.getUTCHours()
  )}:${pad(k.getUTCMinutes())}`;
}

// datetime-local 값(KST로 입력됨) → ISO. 형식이 틀리면 null
export function kstInputToISO(v: string): string | null {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - KST_OFFSET_MS).toISOString();
}

// ISO → "MM.DD HH:mm" (KST)
export function kstShort(iso: string | null | undefined): string {
  if (!iso) return "-";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "-";
  const k = new Date(t + KST_OFFSET_MS);
  return `${pad(k.getUTCMonth() + 1)}.${pad(k.getUTCDate())} ${pad(k.getUTCHours())}:${pad(
    k.getUTCMinutes()
  )}`;
}
