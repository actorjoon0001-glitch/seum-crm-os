// 방문 결과 미입력 '추적 기준' (crm_settings.visit_pending)
// 기본: 적용 시점 이후 새로 접수되는 예약 + 윤소영 고객 방문일 이후 예약만 추적 (지나간 과거 예약 제외)
import type { SupabaseClient } from "@supabase/supabase-js";
import { VISITS_TABLE } from "@/lib/supabase/server";
import { getSetting, setSetting } from "@/lib/settings";
import { visitDateOf, type PendingScope } from "@/lib/visit-pending";
import type { VisitReservation } from "@/lib/types";

export interface VisitPendingSetting extends PendingScope {
  label?: string | null;
  v?: number; // 설정 버전 (2 = 새 기준)
}

const START_NAME = "윤소영";

export async function getVisitPendingSince(supabase: SupabaseClient): Promise<VisitPendingSetting> {
  const { value, missing } = await getSetting<VisitPendingSetting>("visit_pending", { since: null });
  if (missing) return { since: null };
  if (value.v === 2) return value;

  // 최초 1회(새 기준): 지금 시각 + 윤소영 방문일
  const { data } = await supabase
    .from(VISITS_TABLE)
    .select("*")
    .or(`name.ilike.*${START_NAME}*,payload->>name.ilike.*${START_NAME}*`)
    .limit(5);
  const dates = ((data ?? []) as VisitReservation[]).map(visitDateOf).filter(Boolean).sort();
  const fromVisitDate = dates.length ? dates[dates.length - 1] : null;
  const next: VisitPendingSetting = {
    since: new Date().toISOString(),
    fromVisitDate,
    label: fromVisitDate ? `새로 접수되는 예약 + ${START_NAME} 방문일(${fromVisitDate}) 이후 예약` : "새로 접수되는 예약부터",
    v: 2,
  };
  await setSetting("visit_pending", next);
  return next;
}
