-- 방문예약폼(구글시트 → n8n → Supabase) 저장 테이블
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요.

create table if not exists public.visit_reservations (
  id              uuid primary key default gen_random_uuid(),
  submitted_at    timestamptz,                 -- 접수일시
  name            text,                        -- 이름 (name)
  phone           text,                        -- 휴대폰번호 (phone)
  visit_date      text,                        -- 방문일 (visitDate)
  visit_time      text,                        -- 방문시간 (visitTime)
  visitor_count   text,                        -- 방문인원 (visitorCount)
  source          text,                        -- 유입경로 (source)
  interest_type   text,                        -- 관심상품유형 (interestType)
  size            text,                        -- 희망평수 (size)
  budget          text,                        -- 예산범위 (budget)
  land_owned      text,                        -- 토지보유여부 (landOwned)
  addr_jibun      text,                        -- 지번주소 (addrJibun)
  lg_event_apply  text,                        -- LG이벤트적용여부 (lgEventApply)
  lg_event_target text,                        -- LG이벤트대상 (lgEventTarget)
  lg_gift         text,                        -- LGGift (lgGift)
  want_3d         text,                        -- 3D도면희망여부 (want3D)
  three_d_size    text,                        -- 3D희망평수 (threeDSizePy)
  room_count      text,                        -- 방개수 (roomCount)
  bath_count      text,                        -- 화장실개수 (bathCount)
  memo            text,                        -- 메모 (memo)
  status          text default 'new',
  created_at      timestamptz default now()
);

-- RLS 켜고 정책 없음 = service_role(서버/n8n)만 접근, 외부 차단
alter table public.visit_reservations enable row level security;
