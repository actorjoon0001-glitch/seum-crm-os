// 전화 고객(대표번호 / 영업사원 영업폰) 테이블 생성 SQL.
// Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하면 됩니다. (supabase/call_leads.sql 과 동일)
export const CALL_LEADS_SQL = `create table if not exists public.call_leads (
  id           uuid primary key default gen_random_uuid(),
  channel      text not null check (channel in ('main', 'mobile')), -- main=대표번호, mobile=영업사원 영업폰
  called_at    timestamptz not null default now(),  -- 통화(문의) 일시
  name         text,                                -- 고객명
  phone        text,                                -- 고객 연락처
  salesperson  text,                                -- 담당/수신 영업사원
  region       text,                                -- 지역 / 토지 위치
  inquiry      text,                                -- 문의 내용
  status       text not null default 'new',         -- 진행 상태
  grade        text,                                -- 고객등급 A~E
  branch       text,                                -- 넘긴 전시장 (대표번호 → 전시장)
  handed_at    timestamptz,                         -- 넘긴 시각
  memo         text,                                -- 직원 메모
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists call_leads_channel_called_at_idx
  on public.call_leads (channel, called_at desc);

-- RLS 켜고 정책 없음 = service_role(서버)만 접근, 외부 차단
alter table public.call_leads enable row level security;

-- 고객등급 컬럼 (기존 테이블에도 추가)
alter table public.call_leads add column if not exists grade text;
alter table public.call_leads add column if not exists branch text;
alter table public.call_leads add column if not exists handed_at timestamptz;
`;
