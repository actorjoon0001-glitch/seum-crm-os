"use server";

import { createAnonClient, CUSTOMERS_TABLE } from "@/lib/supabase/server";

export interface ReserveResult {
  ok: boolean;
  error?: string;
}

export async function submitReservation(
  _prev: ReserveResult | null,
  formData: FormData
): Promise<ReserveResult> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const preferredAt = String(formData.get("preferred_at") ?? "").trim();
  const purpose = String(formData.get("purpose") ?? "").trim();
  const channel = String(formData.get("channel") ?? "").trim();
  const memo = String(formData.get("memo") ?? "").trim();

  if (!name || !phone) {
    return { ok: false, error: "이름과 연락처는 필수 입력입니다." };
  }

  try {
    const supabase = createAnonClient();
    const { error } = await supabase.from(CUSTOMERS_TABLE).insert({
      source: "visit",
      status: "new",
      name,
      phone,
      email: email || null,
      preferred_at: preferredAt ? new Date(preferredAt).toISOString() : null,
      purpose: purpose || null,
      channel: channel || null,
      memo: memo || null,
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
