-- 영업일지: 영업사원이 매일 상담/연락한 고객을 1건씩 기록. KPI 집계의 원천 데이터.
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요.

create table if not exists public.sales_logs (
  id                uuid primary key default gen_random_uuid(),
  log_date          date not null default (now() at time zone 'Asia/Seoul')::date, -- 일지 날짜
  salesperson       text not null,          -- 영업사원
  customer_name     text,                   -- 고객명
  phone             text,                   -- 고객 연락처 (입력값)
  phone_digits      text,                   -- 숫자만 (동일 고객 판별용)
  source            text,                   -- 유입경로: visit/main/mobile/referral/online/existing/etc
  activity          text not null,          -- 활동: call/message/visit/site/quote/contract/etc
  stage             text not null default 'consulting', -- 활동 후 고객 단계
  is_new            boolean not null default false,     -- 신규 고객 여부 (처음 기록된 연락처면 자동)
  region            text,                   -- 지역 / 토지 위치
  interest          text,                   -- 관심 상품 / 평수
  contract_amount   numeric,                -- 계약 금액 (만원)
  next_action_date  date,                   -- 다음 연락 예정일
  next_action       text,                   -- 다음 할 일
  memo              text,                   -- 상담 내용
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists sales_logs_date_idx on public.sales_logs (log_date desc);
create index if not exists sales_logs_sp_date_idx on public.sales_logs (salesperson, log_date desc);
create index if not exists sales_logs_phone_idx on public.sales_logs (phone_digits);

-- RLS 켜고 정책 없음 = service_role(서버)만 접근, 외부 차단
alter table public.sales_logs enable row level security;
