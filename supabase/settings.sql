-- 관리자 설정 저장소 (잔디 알림 웹훅 URL · 브리핑 시간 등)
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요. (여러 번 실행해도 안전)

create table if not exists public.crm_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- RLS 켜고 정책 없음 = service_role(서버)만 접근, 외부 차단 (웹훅 URL 보호)
alter table public.crm_settings enable row level security;
