// 세움 기존 DB(contracts / contract_drawings)에 맞춘 타입.
// 고객관리os는 이 데이터를 읽기 전용으로 보여줍니다.

export interface Contract {
  id: number;
  local_id: string | null;
  customer_id: number | null;
  customer_name: string | null;
  sales_person: string | null;
  showroom_id: string | null;
  model_name: string | null;
  contract_date: string | null;
  contract_amount: number | null;
  deposit: number | null;
  middle_payment: number | null;
  balance: number | null;
  status: string | null;
  design_status: string | null;
  design_contact_name: string | null;
  design_permit_designer: string | null;
  is_urgent: boolean | null;
  priority_done: boolean | null;
  sales_confirmed: boolean | null;
  design_confirmed: boolean | null;
  construction_confirmed: boolean | null;
  final_approved: boolean | null;
  construction_start_ok: boolean | null;
  is_deleted: boolean | null;
  created_at: string;
}

export interface ContractDrawing {
  id: number;
  contract_local_id: string | null;
  kind: string | null;
  url: string | null;
  path: string | null;
  file_name: string | null;
  uploaded_by: string | null;
  uploaded_at: string | null;
  sort_order: number | null;
}

// 계약 진행 단계 플래그 → 화면 표시용
export const PROGRESS_FLAGS: {
  key: keyof Contract;
  label: string;
}[] = [
  { key: "sales_confirmed", label: "영업확인" },
  { key: "design_confirmed", label: "설계확인" },
  { key: "construction_confirmed", label: "시공확인" },
  { key: "final_approved", label: "최종승인" },
  { key: "construction_start_ok", label: "착공가능" },
];

// 전시장(showroom_id) 영문 코드 → 한글 표시명
export const SHOWROOM_LABEL: Record<string, string> = {
  ganghwa: "강화전시장",
  headquarters: "본사전시장",
  showroom1: "1전시장",
  showroom2: "2전시장",
  showroom3: "3전시장",
  showroom4: "4전시장",
};

export function showroomLabel(id: string | null | undefined): string {
  if (!id) return "-";
  if (SHOWROOM_LABEL[id]) return SHOWROOM_LABEL[id];
  const m = id.match(/^showroom(\d+)$/i);
  if (m) return `${m[1]}전시장`;
  return id;
}

// 전자계약 (econtracts) — 전자계약 작성 시스템이 저장하는 테이블
export interface EContract {
  id: number;
  contract_no: string | null;
  status: string | null;
  client_name: string | null;
  site_address: string | null;
  showroom: string | null;
  salesperson: string | null;
  contract_date: string | null;
  total_amount: number | null; // 만원 단위
  data?: Record<string, unknown> | null; // 계약 상세 원본(jsonb)
  created_at: string;
  updated_at: string | null;
}

// 전자계약 상태 라벨/색상
export const ECONTRACT_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: "작성중", color: "bg-gray-100 text-gray-600" },
  confirmed: { label: "확정", color: "bg-emerald-600 text-white" },
  sent: { label: "발송", color: "bg-blue-100 text-blue-700" },
  viewed: { label: "열람", color: "bg-indigo-100 text-indigo-700" },
  signing: { label: "서명중", color: "bg-amber-100 text-amber-700" },
  signed: { label: "서명완료", color: "bg-green-100 text-green-700" },
  completed: { label: "완료", color: "bg-emerald-600 text-white" },
  sealed: { label: "완료", color: "bg-emerald-600 text-white" },
  cancelled: { label: "취소", color: "bg-red-100 text-red-600" },
  canceled: { label: "취소", color: "bg-red-100 text-red-600" },
  expired: { label: "만료", color: "bg-red-50 text-red-400" },
};

export function econtractStatusMeta(s: string | null | undefined) {
  if (s && ECONTRACT_STATUS[s]) return ECONTRACT_STATUS[s];
  return { label: s || "-", color: "bg-gray-100 text-gray-500" };
}

// 방문예약폼 (구글시트 → n8n → Supabase visit_reservations)
export interface VisitReservation {
  id: string;
  submitted_at: string | null;
  name: string | null;
  phone: string | null;
  visit_date: string | null;
  visit_time: string | null;
  visitor_count: string | null;
  source: string | null;
  interest_type: string | null;
  size: string | null;
  budget: string | null;
  land_owned: string | null;
  addr_jibun: string | null;
  lg_event_apply: string | null;
  lg_event_target: string | null;
  lg_gift: string | null;
  want_3d: string | null;
  three_d_size: string | null;
  room_count: string | null;
  bath_count: string | null;
  memo: string | null;
  status: string | null;
  assigned_to: string | null;
  created_at: string;
  // 폼 원본 전체(신규 폼 대응). 폼이 바뀌어도 여기에 모두 저장됨.
  payload?: Record<string, unknown> | string | null;
}
