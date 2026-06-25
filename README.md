# 세움 고객관리OS (seum-crm-os)

방문예약폼 고객과 call-os 고객을 **하나의 대시보드에서 통합 관리**하는 CRM입니다.

- **기술 스택**: Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase
- **핵심 화면**
  - `/` — 진입 페이지
  - `/reserve` — 방문예약 신청폼 (공개, 고객용)
  - `/admin` — 고객관리 대시보드 (통계 · 필터 · 검색 · 상태관리)
  - `/admin/[id]` — 고객 상세 (메모 · 담당자 · 상태 · 이력)

---

## 1. 설치

```bash
npm install
```

## 2. Supabase 연결

`.env.local.example` 을 복사해 `.env.local` 을 만들고 값을 채웁니다.

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...        # Project Settings > API
SUPABASE_SERVICE_ROLE_KEY=...            # 서버 전용, 절대 노출 금지
```

> **이미 운영 중인 방문예약폼의 Supabase가 있다면** 그 프로젝트의 URL/키를
> 그대로 넣으면 됩니다. 그러면 고객관리OS가 기존 예약 데이터에 바로 연동됩니다.
> (테이블 컬럼명이 다르면 `supabase/migrations/0001_init.sql` 의 스키마에 맞춰
> 매핑하거나 뷰를 만들어 연결하세요. 아래 4번 참고)

## 3. DB 스키마 적용

새 Supabase라면 SQL Editor에서 아래 파일을 실행하세요.

```
supabase/migrations/0001_init.sql
```

`customers` 테이블(통합 고객) + `customer_events`(이력) + RLS 정책이 생성됩니다.

## 4. 실행

```bash
npm run dev      # http://localhost:3000
```

---

## 데이터 모델

`customers` 테이블 한 곳에서 두 채널을 `source` 로 구분합니다.

| 컬럼 | 설명 |
|------|------|
| `source` | `visit`(방문예약) / `call`(call-os) |
| `status` | `new → contacted → consulting → visited → contracted` / `hold` / `closed` |
| `name`, `phone`, `email` | 고객 기본정보 |
| `preferred_at`, `purpose`, `channel`, `memo` | 방문예약 상세 |
| `external_id`, `external_data` | **call-os 연동용** (현재는 비어있음, 추후 채움) |
| `assigned_to` | 담당자 |

### 기존 방문예약폼 Supabase에 연결하는 경우
방문예약폼이 이미 다른 테이블명/컬럼명을 쓴다면 두 가지 방법이 있습니다.
1. 폼 쪽 INSERT를 이 스키마(`customers`, `source='visit'`)에 맞추기 — 가장 간단
2. 기존 테이블 위에 `customers` 라는 이름의 **뷰(view)** 를 만들어 컬럼을 매핑

---

## call-os 연동 (다음 단계)

현재는 구조만 잡혀 있습니다. 연동 시점에 아래 중 하나를 추가하면 됩니다.

- **CSV 업로드**: call-os 내보내기 파일을 파싱해 `source='call'` 로 upsert
- **API/웹훅**: call-os가 보내는 고객을 `(source, external_id)` 유니크 키로 upsert
  (스키마에 해당 유니크 인덱스가 이미 준비됨)

어느 방식이든 통합된 `customers` 테이블에 들어가므로 대시보드는 그대로 동작합니다.
