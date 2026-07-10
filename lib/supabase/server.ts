import { createClient } from "@supabase/supabase-js";

// 세움 기존 DB 테이블명. 필요 시 .env.local 에서 덮어쓸 수 있습니다.
export const CONTRACTS_TABLE =
  process.env.SUPABASE_CONTRACTS_TABLE || "contracts";
export const DRAWINGS_TABLE =
  process.env.SUPABASE_DRAWINGS_TABLE || "contract_drawings";
// 방문예약(향후) 저장용 고객 테이블
export const CUSTOMERS_TABLE =
  process.env.SUPABASE_CUSTOMERS_TABLE || "customers";
// 방문예약 / 리드 (세움 기존 테이블)
export const APPOINTMENTS_TABLE =
  process.env.SUPABASE_APPOINTMENTS_TABLE || "appointments";
export const LEADS_TABLE =
  process.env.SUPABASE_LEADS_TABLE || "leads";
// 방문예약폼(구글시트 → n8n → Supabase) 저장 테이블
export const VISITS_TABLE =
  process.env.SUPABASE_VISITS_TABLE || "visit_reservations";
// 전자계약 테이블
export const ECONTRACTS_TABLE =
  process.env.SUPABASE_ECONTRACTS_TABLE || "econtracts";

/**
 * 서버 전용 Supabase 클라이언트.
 * service_role 키를 사용하므로 RLS를 우회하여 고객 조회/수정이 가능합니다.
 * 절대 클라이언트 컴포넌트에서 import 하지 마세요.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase 환경변수가 없습니다. .env.local 에 NEXT_PUBLIC_SUPABASE_URL 와 SUPABASE_SERVICE_ROLE_KEY 를 설정하세요."
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * 공개(anon) 키 기반 서버 클라이언트.
 * 방문예약폼 제출(INSERT) 등 RLS 정책이 허용하는 작업에 사용합니다.
 */
export function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase 환경변수가 없습니다. .env.local 에 NEXT_PUBLIC_SUPABASE_URL 와 NEXT_PUBLIC_SUPABASE_ANON_KEY 를 설정하세요."
    );
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
