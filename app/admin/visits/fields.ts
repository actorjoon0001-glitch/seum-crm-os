import type { VisitReservation } from "@/lib/types";

// 방문예약 진행 상태
export const VISIT_STATUSES: { value: string; label: string; color: string }[] = [
  { value: "new", label: "신규", color: "bg-gray-100 text-gray-600" },
  { value: "scheduled", label: "방문예정", color: "bg-blue-100 text-blue-700" },
  { value: "consulted", label: "상담완료", color: "bg-green-100 text-green-700" },
  { value: "prospect", label: "가망", color: "bg-amber-100 text-amber-700" },
  { value: "noshow", label: "노쇼", color: "bg-red-100 text-red-600" },
];

export function statusMeta(value: string | null | undefined) {
  return VISIT_STATUSES.find((s) => s.value === value) ?? VISIT_STATUSES[0];
}

// payload(jsonb)를 객체로 파싱. n8n이 문자열로 넣어도 대응.
export function getPayload(r: VisitReservation): Record<string, unknown> | null {
  const p = r.payload;
  if (!p) return null;
  if (typeof p === "object") return p as Record<string, unknown>;
  if (typeof p === "string") {
    try {
      return JSON.parse(p) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return "";
  return String(v).trim();
}

// 표시값 추출: 신규 폼 payload 우선(여러 후보 key), 없으면 기존 컬럼 fallback
export function vf(
  r: VisitReservation,
  keys: string[],
  col?: keyof VisitReservation
): string {
  const p = getPayload(r);
  if (p) {
    for (const k of keys) {
      const s = str(p[k]);
      if (s) return s;
    }
  }
  if (col) {
    const s = str(r[col] as unknown);
    if (s) return s;
  }
  return "";
}

// 폼 필드 key → 한글 라벨
export const VISIT_LABELS: Record<string, string> = {
  name: "이름",
  phone: "연락처",
  visitDate: "방문일",
  visitTime: "방문시간",
  visitorCount: "방문 인원",
  showroom: "방문 전시장",
  houseType: "관심 주택/시공 유형",
  interestType: "관심 상품",
  size: "희망 평수",
  pyeong: "희망 평수",
  budget: "예산 범위",
  buildTimeline: "건축 희망 시기",
  landOwned: "토지 보유 여부",
  landAddress: "토지 지번주소",
  addrJibun: "토지 지번주소",
  source: "유입경로",
  roomCount: "방 개수",
  bathCount: "화장실 개수",
  want3D: "3D 도면 희망",
  wantDeck: "데크 희망",
  memo: "메모",
};

// 상세 페이지 표시 순서(있는 것만 노출), 제외 key
const ORDER = [
  "visitDate",
  "visitTime",
  "visitorCount",
  "showroom",
  "houseType",
  "interestType",
  "size",
  "pyeong",
  "budget",
  "buildTimeline",
  "landOwned",
  "landAddress",
  "addrJibun",
  "source",
  "roomCount",
  "bathCount",
  "want3D",
  "wantDeck",
  "memo",
];
const HIDE = new Set(["name", "phone", "agree"]);

// payload에서 (라벨, 값) 목록을 순서대로 뽑음
export function payloadEntries(
  r: VisitReservation
): { key: string; label: string; value: string }[] {
  const p = getPayload(r);
  if (!p) return [];
  const seen = new Set<string>();
  const out: { key: string; label: string; value: string }[] = [];
  const push = (k: string) => {
    if (seen.has(k) || HIDE.has(k)) return;
    seen.add(k);
    const v = str(p[k]);
    if (!v) return;
    out.push({ key: k, label: VISIT_LABELS[k] || k, value: v });
  };
  ORDER.forEach(push);
  Object.keys(p).forEach(push); // 순서에 없는 새 필드도 뒤에 노출
  return out;
}
