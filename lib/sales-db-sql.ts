// 영업 고객 DB 테이블 생성 SQL (supabase/sales_db.sql 과 동일)
export const SALES_DB_SQL = `create table if not exists public.sales_customers (
  id                uuid primary key default gen_random_uuid(),
  db_no             text unique,                 -- DB번호 (SE-2026-0007)
  received_date     date not null default (now() at time zone 'Asia/Seoul')::date, -- 접수일
  customer_name     text,                        -- 고객명
  phone             text,                        -- 연락처
  phone_digits      text,                        -- 연락처 숫자만 (중복 확인용)
  region            text,                        -- 지역
  inflow_type       text,                        -- 유입구분: 배정 / 개별
  inflow_route      text,                        -- 유입경로: 네이버, 유튜브, 블로그 ...
  interest_product  text,                        -- 관심제품 (예: 20평)
  budget            text,                        -- 예상예산 (예: 1억5천만원)
  branch            text,                        -- 담당지점 (예: 마곡)
  assignee          text not null,               -- 배정담당자 (영업사원)
  stage             text not null default '1차상담', -- 진행단계
  memo              text,                        -- 최근 상담 내용
  last_contact_date date,                        -- 최근 기록일
  next_action_date  date,                        -- 다음 연락 예정일
  source_ref        text,                        -- 배정 원본 (visit:<id> / call:<id>)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists sales_customers_assignee_idx on public.sales_customers (assignee, received_date desc);
create index if not exists sales_customers_phone_idx on public.sales_customers (phone_digits);

-- 일지 기록: 신규 등록 / 진행단계 변경 / 상담 메모가 날짜별로 쌓임
create table if not exists public.sales_customer_logs (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.sales_customers (id) on delete cascade,
  assignee     text not null,
  log_date     date not null default (now() at time zone 'Asia/Seoul')::date,
  kind         text not null,                    -- created / stage / note
  from_stage   text,
  to_stage     text,
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists sales_customer_logs_date_idx on public.sales_customer_logs (log_date desc, assignee);
create index if not exists sales_customer_logs_customer_idx on public.sales_customer_logs (customer_id, created_at desc);

-- RLS 켜고 정책 없음 = service_role(서버)만 접근, 외부 차단
alter table public.sales_customers enable row level security;
alter table public.sales_customer_logs enable row level security;

-- 이전 버전 영업일지(sales_logs)에 기록이 있으면 1회 자동으로 옮겨옴
do $$
begin
  if to_regclass('public.sales_logs') is not null
     and not exists (select 1 from public.sales_customers) then

    insert into public.sales_customers
      (db_no, received_date, customer_name, phone, phone_digits, region, inflow_type, inflow_route,
       interest_product, assignee, stage, memo, last_contact_date, next_action_date)
    select
      'SE-' || extract(year from g.first_date)::int || '-' ||
        lpad((row_number() over (partition by extract(year from g.first_date)
                                 order by g.first_date, l.created_at))::text, 4, '0'),
      g.first_date, l.customer_name, l.phone, l.phone_digits, l.region,
      case when l.source in ('visit', 'main') then '배정' else '개별' end,
      case l.source when 'visit' then '온라인예약' when 'referral' then '지인소개'
                    when 'existing' then '기존고객' else '기타' end,
      l.interest, l.salesperson,
      case when l.stage = 'contracted' or l.activity = 'contract' then '계약완료'
           when l.stage = 'quoted' or l.activity = 'quote' then '견적발송'
           when l.stage in ('hold', 'lost') then '계약보류'
           when l.activity in ('visit', 'site') then '방문완료'
           else '1차상담' end,
      l.memo, g.last_date, l.next_action_date
    from (
      select salesperson, coalesce(phone_digits, 'n:' || coalesce(customer_name, '')) as k,
             min(log_date) as first_date, max(log_date) as last_date
      from public.sales_logs group by 1, 2
    ) g
    join (
      select distinct on (salesperson, coalesce(phone_digits, 'n:' || coalesce(customer_name, ''))) *
      from public.sales_logs
      order by salesperson, coalesce(phone_digits, 'n:' || coalesce(customer_name, '')),
               log_date desc, created_at desc
    ) l on l.salesperson = g.salesperson
       and coalesce(l.phone_digits, 'n:' || coalesce(l.customer_name, '')) = g.k;

    insert into public.sales_customer_logs (customer_id, assignee, log_date, kind, note, created_at)
    select c.id, s.salesperson, s.log_date, 'note',
           concat_ws(' · ',
             case s.activity when 'call' then '전화상담' when 'message' then '문자·카톡'
                             when 'visit' then '방문상담' when 'site' then '현장답사'
                             when 'quote' then '견적제출' when 'contract' then '계약' else '기타' end,
             s.memo),
           s.created_at
    from public.sales_logs s
    join public.sales_customers c
      on c.assignee = s.salesperson
     and coalesce(c.phone_digits, 'n:' || coalesce(c.customer_name, ''))
       = coalesce(s.phone_digits, 'n:' || coalesce(s.customer_name, ''));
  end if;
end $$;
`;
