// 방문 결과 미입력: 방문일이 지났는데 상태가 신규/방문예정(또는 비어 있음)인 방문예약
// 추적 시작 기준(since) 이전에 접수된 예약은 제외 (과거 건은 그대로 둠)
import type { VisitReservation } from "@/lib/types";
import { vf } from "@/app/admin/visits/fields";

export const PENDING_STATUSES = ["new", "scheduled"];

export function visitDateOf(r: VisitReservation): string {
  const d = vf(r, ["visitDate"], "visit_date");
  return /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : "";
}

const receivedAt = (r: VisitReservation) => r.submitted_at || r.created_at || "";

export function isResultPending(r: VisitReservation, today: string, since?: string | null): boolean {
  const d = visitDateOf(r);
  if (!d || d >= today) return false;
  if (since && receivedAt(r) && Date.parse(receivedAt(r)) < Date.parse(since)) return false;
  return !r.status || PENDING_STATUSES.includes(r.status);
}
