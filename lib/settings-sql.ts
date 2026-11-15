// 설정 테이블 생성 SQL (supabase/settings.sql 과 동일)
export const SETTINGS_SQL = `create table if not exists public.crm_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- RLS 켜고 정책 없음 = service_role(서버)만 접근, 외부 차단 (웹훅 URL 보호)
alter table public.crm_settings enable row level security;
`;
