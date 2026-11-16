// '신규 · 미처리' 집계 기준 시각 (crm_settings.new_pending)
// 처음 적용한 시점 이후에 들어온 방문예약 · 대표번호 문의만 미처리로 셉니다 (지난 건은 제외).
import { getSetting, setSetting } from "@/lib/settings";

interface NewPendingSetting {
  since: string | null;
}

export async function getNewPendingSince(): Promise<string | null> {
  const { value, missing } = await getSetting<NewPendingSetting>("new_pending", { since: null });
  if (missing) return null;
  if (value.since) return value.since;
  // 최초 1회: 지금 시각을 기준으로 저장
  const since = new Date().toISOString();
  await setSetting("new_pending", { since });
  return since;
}

// 기준 시각 이후에 들어온 건인지 (기준이 없으면 전부)
export function isAfter(at: string | null | undefined, since: string | null): boolean {
  if (!since) return true;
  return !!at && Date.parse(at) >= Date.parse(since);
}
