// 방문 결과 미입력: 방문일이 지났는데 상태가 신규/방문예정(또는 비어 있음)인 방문예약
import type { VisitReservation } from "@/lib/types";
import { vf } from "@/app/admin/visits/fields";

export const PENDING_STATUSES = ["new", "scheduled"];

export function visitDateOf(r: VisitReservation): string {
  const d = vf(r, ["visitDate"], "visit_date");
  return /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : "";
}

export function isResultPending(r: VisitReservation, today: string): boolean {
  const d = visitDateOf(r);
  if (!d || d >= today) return false;
  return !r.status || PENDING_STATUSES.includes(r.status);
}
