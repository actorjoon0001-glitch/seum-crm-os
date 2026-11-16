// 방문 결과 미입력: 방문일이 지났는데 상태가 신규/방문예정(또는 비어 있음)인 방문예약
// 추적 기준(관리자 설정)에 해당하는 예약만 대상 — 이미 지나간 과거 예약은 그대로 둠
import type { VisitReservation } from "@/lib/types";
import { vf } from "@/app/admin/visits/fields";

export const PENDING_STATUSES = ["new", "scheduled"];

export function visitDateOf(r: VisitReservation): string {
  const d = vf(r, ["visitDate"], "visit_date");
  return /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : "";
}

const receivedAt = (r: VisitReservation) => r.submitted_at || r.created_at || "";

export interface PendingScope {
  since?: string | null; // 이 시각 이후 '새로 접수된' 예약
  fromVisitDate?: string | null; // 또는 방문일이 이 날짜 이후인 예약 (예: 윤소영 방문일)
}

function inScope(r: VisitReservation, scope?: PendingScope | string | null): boolean {
  if (!scope) return true;
  const s: PendingScope = typeof scope === "string" ? { since: scope } : scope;
  if (!s.since && !s.fromVisitDate) return true;
  const at = receivedAt(r);
  if (s.since && at && Date.parse(at) >= Date.parse(s.since)) return true;
  const d = visitDateOf(r);
  if (s.fromVisitDate && d && d >= s.fromVisitDate) return true;
  return false;
}

export function isResultPending(r: VisitReservation, today: string, scope?: PendingScope | string | null): boolean {
  const d = visitDateOf(r);
  if (!d || d >= today) return false;
  if (!inScope(r, scope)) return false;
  return !r.status || PENDING_STATUSES.includes(r.status);
}
