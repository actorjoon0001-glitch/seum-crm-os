# 고객관리OS — 데이터 매핑

이 앱은 **세움 기존 Supabase DB를 읽기 전용으로 조회**합니다.
별도의 마이그레이션/테이블 생성은 필요 없습니다. (라이브 운영 데이터를 그대로 사용)

## 사용하는 테이블

### `contracts` (수기 계약 고객) — 약 387건
고객관리OS의 목록·상세에 표시되는 핵심 데이터.

| 컬럼 | 용도 |
|------|------|
| `id` | 상세 페이지 키 (`/admin/[id]`) |
| `local_id` | 계약서 사진 연결 키 → `contract_drawings.contract_local_id` |
| `customer_name` | 고객명 |
| `sales_person` | 영업사원 |
| `showroom_id` | 매장 (필터) |
| `model_name` | 모델 |
| `contract_date` | 계약일 (정렬·이번달 통계) |
| `contract_amount` / `deposit` / `middle_payment` / `balance` | 결제 정보 |
| `status` / `design_status` | 상태 |
| `is_urgent` | 긴급 뱃지·필터 |
| `sales_confirmed` … `construction_start_ok` | 진행 단계 표시 |
| `is_deleted` | true 인 행은 목록에서 제외 |

### `contract_drawings` (계약서 사진/첨부) — 약 252건
계약 상세 페이지의 **사진 갤러리**.

| 컬럼 | 용도 |
|------|------|
| `contract_local_id` | `contracts.local_id` 와 매칭 |
| `url` | 이미지/파일 주소 (갤러리에서 표시) |
| `file_name` / `kind` | 라벨 |
| `sort_order` | 정렬 |

### `customers` (방문예약 — 향후)
현재 비어 있음. `/reserve` 방문예약폼이 `source='visit'` 로 INSERT 하면 여기 쌓입니다.
(call-os 연동도 추후 이 테이블 또는 별도 매핑으로 확장 예정)

## 테이블명 오버라이드
운영 테이블명이 다르면 `.env.local` 에서 지정:

```env
SUPABASE_CONTRACTS_TABLE=contracts
SUPABASE_DRAWINGS_TABLE=contract_drawings
SUPABASE_CUSTOMERS_TABLE=customers
```

## 주의 — 읽기 전용
고객관리OS는 `contracts` / `contract_drawings` 를 **수정/삭제하지 않습니다.**
라이브 계약 데이터 보호를 위해 조회만 수행합니다.
