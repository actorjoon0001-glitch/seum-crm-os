export type CustomerSource = "visit" | "call";

export type CustomerStatus =
  | "new"
  | "contacted"
  | "consulting"
  | "visited"
  | "contracted"
  | "hold"
  | "closed";

export interface Customer {
  id: string;
  source: CustomerSource;
  status: CustomerStatus;
  name: string;
  phone: string;
  email: string | null;
  preferred_at: string | null;
  purpose: string | null;
  channel: string | null;
  memo: string | null;
  external_id: string | null;
  external_data: Record<string, unknown> | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export const SOURCE_LABEL: Record<CustomerSource, string> = {
  visit: "방문예약",
  call: "call-os",
};

export const STATUS_LABEL: Record<CustomerStatus, string> = {
  new: "신규",
  contacted: "연락완료",
  consulting: "상담중",
  visited: "방문완료",
  contracted: "계약완료",
  hold: "보류",
  closed: "종료",
};

export const STATUS_ORDER: CustomerStatus[] = [
  "new",
  "contacted",
  "consulting",
  "visited",
  "contracted",
  "hold",
  "closed",
];

export const STATUS_COLOR: Record<CustomerStatus, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-indigo-100 text-indigo-700",
  consulting: "bg-amber-100 text-amber-700",
  visited: "bg-purple-100 text-purple-700",
  contracted: "bg-green-100 text-green-700",
  hold: "bg-gray-200 text-gray-600",
  closed: "bg-gray-100 text-gray-400",
};
