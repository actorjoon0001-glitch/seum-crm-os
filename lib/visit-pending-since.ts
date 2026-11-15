// 방문 결과 미입력 '추적 시작 기준' (crm_settings.visit_pending)
// 처음에는 윤소영 고객 예약의 접수 시각을 기준으로 자동 설정 → 관리자 화면에서 변경 가능
import type { SupabaseClient } from "@supabase/supabase-js";
import { VISITS_TABLE } from "@/lib/supabase/server";
import { getSetting, setSetting } from "@/lib/settings";

export interface VisitPendingSetting {
  since: string | null; // 이 시각 이후 접수된 예약만 추적
  label?: string | null; // 기준 예약 표시 (예: "윤소영 · 11.14 접수")
  bootstrapped?: boolean;
}

const START_NAME = "윤소영"; // 요청: 윤소영 예약부터 추적 시작

export async function getVisitPendingSince(supabase: SupabaseClient): Promise<VisitPendingSetting> {
  const { value, missing } = await getSetting<VisitPendingSetting>("visit_pending", { since: null });
  if (missing || value.bootstrapped) return value;

  // 최초 1회: 윤소영 예약의 접수 시각을 찾아 기준으로 저장
  const { data } = await supabase
    .from(VISITS_TABLE)
    .select("id,name,payload,submitted_at,created_at")
    .or(`name.eq.${START_NAME},payload->>name.eq.${START_NAME}`)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .limit(1);
  const r = (data ?? [])[0] as { submitted_at: string | null; created_at: string | null } | undefined;
  const since = r ? r.submitted_at || r.created_at : null;
  const next: VisitPendingSetting = {
    since,
    label: since ? `${START_NAME} 예약 접수 시각부터` : null,
    bootstrapped: !!since,
  };
  if (since) await setSetting("visit_pending", next);
  return next;
}
