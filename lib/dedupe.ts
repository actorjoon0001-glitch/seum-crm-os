// 같은 고객(연락처 기준) 자동 연결: 방문예약 · 대표번호 · 영업폰 · 고객DB 를 한 번에 색인
import type { SupabaseClient } from "@supabase/supabase-js";
import { CALLS_TABLE, SALES_CUSTOMERS_TABLE, VISITS_TABLE } from "@/lib/supabase/server";
import { kstDateOf } from "@/lib/kst";

export type SourceKind = "visit" | "main" | "mobile" | "db";

export interface CustomerRef {
  kind: SourceKind;
  id: string;
  label: string; // 예: "방문예약 11.02", "고객DB SE-2026-0001 · 김기욱"
  href: string;
}

export const SOURCE_NAME: Record<SourceKind, string> = {
  visit: "🏠 방문예약",
  main: "☎️ 대표번호",
  mobile: "📱 영업폰",
  db: "📒 고객DB",
};

// 연락처 정규화: 숫자만, +82 → 0, 9자리 미만은 무시
export function normPhone(v: unknown): string | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  let d = String(v).replace(/\D/g, "");
  if (d.startsWith("82") && d.length >= 11) d = "0" + d.slice(2);
  return d.length >= 9 ? d : null;
}

const md = (iso: string | null | undefined) => {
  const d = kstDateOf(iso ?? null);
  return `${d.slice(5, 7)}.${d.slice(8, 10)}`;
};

export type PhoneIndex = Map<string, CustomerRef[]>;

export async function buildPhoneIndex(supabase: SupabaseClient): Promise<PhoneIndex> {
  const idx: PhoneIndex = new Map();
  const add = (phone: unknown, ref: CustomerRef) => {
    const k = normPhone(phone);
    if (!k) return;
    const arr = idx.get(k) ?? [];
    arr.push(ref);
    idx.set(k, arr);
  };

  const [visits, calls, custs] = await Promise.all([
    supabase.from(VISITS_TABLE).select("id,phone,payload,submitted_at,visit_date").limit(10000),
    supabase.from(CALLS_TABLE).select("id,phone,channel,called_at,salesperson").limit(10000),
    supabase.from(SALES_CUSTOMERS_TABLE).select("id,phone,phone_digits,db_no,assignee,stage").limit(20000),
  ]);

  for (const v of (visits.data ?? []) as {
    id: string;
    phone: string | null;
    payload: unknown;
    submitted_at: string | null;
    visit_date: string | null;
  }[]) {
    const p = typeof v.payload === "object" && v.payload ? (v.payload as Record<string, unknown>) : {};
    add(v.phone || p.phone, {
      kind: "visit",
      id: v.id,
      label: `방문예약 접수 ${md(v.submitted_at)}${v.visit_date ? ` · 방문 ${v.visit_date}` : ""}`,
      href: `/admin/visits/${v.id}`,
    });
  }
  for (const c of (calls.data ?? []) as {
    id: string;
    phone: string | null;
    channel: string;
    called_at: string | null;
    salesperson: string | null;
  }[]) {
    const kind: SourceKind = c.channel === "main" ? "main" : "mobile";
    add(c.phone, {
      kind,
      id: c.id,
      label: `${kind === "main" ? "대표번호" : "영업폰"} ${md(c.called_at)}${c.salesperson ? ` · ${c.salesperson}` : ""}`,
      href: `/admin/calls/${c.channel}?q=${encodeURIComponent(c.phone ?? "")}`,
    });
  }
  for (const s of (custs.data ?? []) as {
    id: string;
    phone: string | null;
    phone_digits: string | null;
    db_no: string | null;
    assignee: string;
    stage: string;
  }[]) {
    add(s.phone_digits || s.phone, {
      kind: "db",
      id: s.id,
      label: `고객DB ${s.db_no ?? ""} · ${s.assignee} · ${s.stage}`,
      href: `/admin/logs/customer?id=${s.id}`,
    });
  }
  return idx;
}

// 자기 자신을 제외한 다른 곳의 기록
export function otherRefs(idx: PhoneIndex, phone: unknown, self: { kind: SourceKind; id: string }): CustomerRef[] {
  const k = normPhone(phone);
  if (!k) return [];
  return (idx.get(k) ?? []).filter((r) => !(r.kind === self.kind && r.id === self.id));
}

// 중복 제외 실제 고객 수 (연락처 기준, 연락처 없는 건은 각각 1명)
export function uniqueCustomerCount(idx: PhoneIndex): number {
  return idx.size;
}
