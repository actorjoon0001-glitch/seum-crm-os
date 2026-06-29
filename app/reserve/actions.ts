"use server";

// 방문예약폼 → n8n 웹훅으로 전송 (기존 구글시트·캘린더·텔레그램·Supabase 자동화로 흘러감)
const WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  "https://actorjoon0001.app.n8n.cloud/webhook/seumhome-visit";

export interface ReserveResult {
  ok: boolean;
  error?: string;
}

export async function submitReservation(
  _prev: ReserveResult | null,
  formData: FormData
): Promise<ReserveResult> {
  const get = (k: string) => String(formData.get(k) ?? "").trim();

  const name = get("name");
  const phone = get("phone");
  const agree = formData.get("agree");

  if (!name || !phone) {
    return { ok: false, error: "이름과 연락처는 필수 입력입니다." };
  }
  if (!agree) {
    return { ok: false, error: "개인정보 수집·이용에 동의해 주세요." };
  }

  // Edit Fields 노드가 기대하는 키와 동일하게 전송 ($json.body.*)
  const payload = {
    name,
    phone,
    visitDate: get("visitDate"),
    visitTime: get("visitTime"),
    visitorCount: get("visitorCount"),
    source: get("source"),
    interestType: get("interestType"),
    size: get("size"),
    budget: get("budget"),
    landOwned: get("landOwned"),
    addrJibun: get("addrJibun"),
    roomCount: get("roomCount"),
    bathCount: get("bathCount"),
    wantDeck: get("wantDeck"),
    want3D: get("want3D"),
    memo: get("memo"),
    agree: "동의",
  };

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `접수 중 오류가 발생했습니다 (${res.status}). 잠시 후 다시 시도해 주세요.`,
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "네트워크 오류로 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
}
