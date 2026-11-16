// 관리자 설정 (crm_settings: key → jsonb). 서버 전용.
import { createServiceClient, hasSupabaseEnv } from "@/lib/supabase/server";

export const SETTINGS_TABLE = "crm_settings";

export interface JandiConfig {
  teamUrl: string; // 영업팀 토픽 (필수)
  adminUrl: string; // 관리자 토픽 (선택)
  branchUrls: Record<string, string>; // 전시장별 토픽 (선택) — 전시장 이름 → URL
  briefHour: number; // 아침 브리핑 시각 (KST)
  briefMinute: number;
  brief: boolean; // 1. 매일 아침 브리핑
  newVisit: boolean; // 2. 새 방문예약 알림
  newCall: boolean; // 2. 대표번호 문의 등록 알림
  admin: boolean; // 3. 관리자 알림 (일일 요약 · 로그인 실패 급증)
}

export const DEFAULT_JANDI: JandiConfig = {
  teamUrl: "",
  adminUrl: "",
  branchUrls: {},
  briefHour: 8,
  briefMinute: 40,
  brief: true,
  newVisit: true,
  newCall: true,
  admin: true,
};

export interface JandiState {
  lastBriefDate?: string; // 마지막 아침 브리핑 날짜 (KST)
  visitCursor?: string; // 마지막으로 알린 방문예약 created_at
  lastFailAlertAt?: string; // 마지막 로그인 실패 경고 시각
  lastTickAt?: string; // 마지막 자동 실행 시각
  lockUntil?: string; // 실행 중 잠금 (겹침 방지)
  recent?: { at: string; text: string }[]; // 최근 전송 기록
}

export async function getSetting<T>(key: string, fallback: T): Promise<{ value: T; missing: boolean }> {
  if (!hasSupabaseEnv()) return { value: fallback, missing: true };
  const { data, error } = await createServiceClient().from(SETTINGS_TABLE).select("value").eq("key", key).maybeSingle();
  if (error) return { value: fallback, missing: true };
  return { value: { ...fallback, ...((data?.value as T) ?? {}) }, missing: false };
}

export async function setSetting(key: string, value: unknown): Promise<string | null> {
  const { error } = await createServiceClient()
    .from(SETTINGS_TABLE)
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  return error?.message ?? null;
}

export const getJandiConfig = () => getSetting<JandiConfig>("jandi", DEFAULT_JANDI);
export const getJandiState = () => getSetting<JandiState>("jandi_state", {});
