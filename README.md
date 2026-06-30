# 세움 고객관리OS (seum-crm-os)

세움 기존 Supabase DB의 **수기 계약 고객과 계약서 사진을 한 화면에서 조회**하는 대시보드입니다.
방문예약·call-os 고객 통합 관리는 다음 단계로 확장합니다.

- **기술 스택**: Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase
- **핵심 화면**
  - `/` — 진입 페이지
  - `/admin` — 고객관리 대시보드 (계약 고객 목록 · 통계 · 검색 · 매장/긴급 필터)
  - `/admin/[id]` — 계약 상세 + **계약서 사진 갤러리**
  - `/reserve` — 방문예약 신청폼 (공개, 향후 `customers` 테이블로 수집)

> **읽기 전용**: 라이브 계약 데이터(`contracts`/`contract_drawings`)는 조회만 하며 수정/삭제하지 않습니다.

---

## 1. 설치

```bash
npm install
```

## 2. Supabase 연결

`.env.local.example` 을 복사해 `.env.local` 을 만들고 세움 프로젝트 값을 채웁니다.

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://uqsswlunnpdhledmoarj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...   # Project Settings > API
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...            # 서버 전용, 절대 노출 금지
```

새 형식(`sb_publishable_` / `sb_secret_`)과 기존 JWT(anon / service_role) 모두 지원합니다.

## 3. 실행

```bash
npm run dev      # http://localhost:3000 → /admin
```

별도 마이그레이션은 필요 없습니다. 기존 `contracts` / `contract_drawings` 를 그대로 읽습니다.

## 4. (선택) DB 구조 확인

```bash
npm run inspect-db    # 연결된 Supabase의 테이블/컬럼 목록 출력
```

---

## 데이터 매핑

상세 매핑은 [`supabase/SCHEMA.md`](supabase/SCHEMA.md) 참고.

| 테이블 | 역할 | 건수 |
|--------|------|------|
| `contracts` | 수기 계약 고객 (목록·상세) | ~387 |
| `contract_drawings` | 계약서 사진/첨부 (`local_id` 로 연결) | ~252 |
| `customers` | 방문예약 수집 (향후) | 0 |

테이블명이 다르면 `.env.local` 에서 `SUPABASE_CONTRACTS_TABLE` / `SUPABASE_DRAWINGS_TABLE` 로 덮어쓸 수 있습니다.

---

## 다음 단계 (로드맵)

1. **방문예약 연동** — `/reserve` 폼 제출 → `customers(source='visit')` 수집 → 대시보드 탭 추가
2. **call-os 연동** — CSV 업로드 또는 API/웹훅으로 `source='call'` 수집
3. **계약서 사진** — `contract_drawings.url` 이 비공개 버킷이면 서명 URL 발급 로직 추가

세 채널(계약·방문예약·call-os)을 하나의 고객관리OS에서 통합하는 것이 최종 목표입니다.
