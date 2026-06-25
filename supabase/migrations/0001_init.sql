-- ════════════════════════════════════════════════════════════════
--  세움 고객관리OS — 초기 스키마
--  방문예약폼(visit)과 call-os(call) 고객을 하나의 customers 테이블로
--  통합 관리합니다. source 컬럼으로 유입 채널을 구분합니다.
-- ════════════════════════════════════════════════════════════════

-- 고객 유입 채널
do $$ begin
  create type customer_source as enum ('visit', 'call');
exception when duplicate_object then null; end $$;

-- 상담/영업 단계
do $$ begin
  create type customer_status as enum (
    'new',          -- 신규 (접수)
    'contacted',    -- 1차 연락 완료
    'consulting',   -- 상담 진행중
    'visited',      -- 방문 완료
    'contracted',   -- 계약 완료
    'hold',         -- 보류
    'closed'        -- 종료/이탈
  );
exception when duplicate_object then null; end $$;

create table if not exists public.customers (
  id            uuid primary key default gen_random_uuid(),
  source        customer_source not null default 'visit',
  status        customer_status not null default 'new',

  name          text not null,
  phone         text not null,
  email         text,

  -- 방문예약 관련
  preferred_at  timestamptz,          -- 희망 방문일시
  purpose       text,                 -- 방문 목적 / 관심 상품
  channel       text,                 -- 유입경로(검색/지인/광고 등)
  memo          text,                 -- 상담 메모

  -- call-os 연동용 (나중에 채워짐)
  external_id   text,                 -- call-os 측 고객 식별자
  external_data jsonb,                -- call-os 원본 페이로드 보관

  assigned_to   text,                 -- 담당자
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists customers_source_idx  on public.customers (source);
create index if not exists customers_status_idx  on public.customers (status);
create index if not exists customers_created_idx on public.customers (created_at desc);
create index if not exists customers_phone_idx   on public.customers (phone);
-- 동일 채널 내 외부 식별자 중복 방지(연동 시 upsert 키로 사용)
create unique index if not exists customers_source_external_uidx
  on public.customers (source, external_id) where external_id is not null;

-- updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ── 상태 변경 이력 (선택) ─────────────────────────────────────────
create table if not exists public.customer_events (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  type        text not null,        -- 'status_change' | 'memo' | 'note'
  detail      text,
  created_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists customer_events_customer_idx
  on public.customer_events (customer_id, created_at desc);

-- ════════════════════════════════════════════════════════════════
--  RLS (Row Level Security)
--  - 방문예약폼: anon 키로 신규 INSERT만 허용 (공개 폼 제출)
--  - 관리 작업(조회/수정): service_role 키(서버 전용)로만 수행
-- ════════════════════════════════════════════════════════════════
alter table public.customers       enable row level security;
alter table public.customer_events enable row level security;

-- 공개 폼에서 신규 예약 접수(INSERT)만 허용
drop policy if exists "public can insert reservations" on public.customers;
create policy "public can insert reservations"
  on public.customers for insert
  to anon
  with check (source = 'visit');

-- service_role 은 RLS를 우회하므로 별도 정책 불필요(서버 대시보드 전용).
