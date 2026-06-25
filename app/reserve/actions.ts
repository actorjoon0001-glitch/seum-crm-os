"use server";

import { createAnonClient, CUSTOMERS_TABLE } from "@/lib/supabase/server";

export interface ReserveResult {
  ok: boolean;
  error?: string;
}

// 방문예약 신청 → customers 테이블에 저장 (source='visit').
// 세움 customers 스키마: name, phone, address, source, status, sales_person
export async function submitReservation(
  _prev: ReserveResult | null,
  formData: FormData
): Promise<ReserveResult> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();

  if (!name || !phone) {
    return { ok: false, error: "이름과 연락처는 필수 입력입니다." };
  }

  try {
    const supabase = createAnonClient();
    const { error } = await supabase.from(CUSTOMERS_TABLE).insert({
      name,
      phone,
      address: address || null,
      source: "visit",
      status: "new",
    });

    if (error) {
      return { ok: false, error: `저장 중 오류가 발생했습니다: ${error.message}` };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return { ok: false, error: msg };
  }
}
