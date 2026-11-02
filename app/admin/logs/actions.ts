"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createServiceClient, LOGS_TABLE } from "@/lib/supabase/server";
import { isAuthed } from "@/lib/require-auth";
import { COOKIE_OPTS, SP_COOKIE } from "@/lib/auth";
import { LOG_ACTIVITIES, LOG_SOURCES, LOG_STAGES } from "@/lib/types";
import { isDateStr, kstToday } from "@/lib/kst";

export interface LogFormResult {
  ok: boolean;
  error?: string;
  seq?: number;
  isNew?: boolean;
}

const has = (list: { value: string }[], v: string) => list.some((o) => o.value === v);

function refresh() {
  revalidatePath("/");
  revalidatePath("/admin/logs");
  revalidatePath("/admin/kpi");
}

// 영업일지 1건 기록
export async function createSalesLog(
  prev: LogFormResult | null,
  formData: FormData
): Promise<LogFormResult> {
  if (!(await isAuthed())) return { ok: false, error: "로그인이 필요합니다." };
  const get = (k: string) => String(formData.get(k) ?? "").trim();

  const salesperson = get("salesperson");
  const customer_name = get("customer_name");
  const phone = get("phone");
  const activity = get("activity");
  const stage = get("stage") || "consulting";
  const source = get("source");
  const logDate = get("log_date");
  const nextDate = get("next_action_date");
  const amountRaw = get("contract_amount").replace(/[,\s]/g, "");

  if (!salesperson) return { ok: false, error: "영업사원 이름을 입력해 주세요." };
  if (!customer_name && !phone) return { ok: false, error: "고객명 또는 연락처를 입력해 주세요." };
  if (!has(LOG_ACTIVITIES, activity)) return { ok: false, error: "활동 유형을 선택해 주세요." };
  if (!has(LOG_STAGES, stage)) return { ok: false, error: "고객 단계를 선택해 주세요." };
  if (source && !has(LOG_SOURCES, source)) return { ok: false, error: "잘못된 유입경로입니다." };
  if (nextDate && !isDateStr(nextDate)) return { ok: false, error: "다음 연락일 형식이 잘못되었습니다." };
  const amount = amountRaw ? Number(amountRaw) : null;
  if (amount !== null && !Number.isFinite(amount))
    return { ok: false, error: "계약 금액은 숫자(만원)로 입력해 주세요." };

  const phone_digits = phone.replace(/\D/g, "") || null;
  const supabase = createServiceClient();

  // 신규 고객 판별: 처음 기록되는 연락처(없으면 같은 영업사원의 같은 이름)면 신규
  let isNew = source !== "existing";
  if (isNew) {
    let q = supabase.from(LOGS_TABLE).select("id", { count: "exact", head: true });
    q = phone_digits
      ? q.eq("phone_digits", phone_digits)
      : q.eq("customer_name", customer_name).eq("salesperson", salesperson);
    const { count, error } = await q;
    if (error) return { ok: false, error: `저장 실패: ${error.message}` };
    isNew = (count ?? 0) === 0;
  }

  const { error } = await supabase.from(LOGS_TABLE).insert({
    log_date: isDateStr(logDate) ? logDate : kstToday(),
    salesperson,
    customer_name: customer_name || null,
    phone: phone || null,
    phone_digits,
    source: source || null,
    activity,
    stage,
    is_new: isNew,
    region: get("region") || null,
    interest: get("interest") || null,
    contract_amount: activity === "contract" ? amount : null,
    next_action_date: nextDate || null,
    next_action: get("next_action") || null,
    memo: get("memo") || null,
  });
  if (error) return { ok: false, error: `저장 실패: ${error.message}` };

  // 다음에 열 때 내 이름이 자동 선택되도록 기억
  cookies().set(SP_COOKIE, encodeURIComponent(salesperson), {
    ...COOKIE_OPTS,
    maxAge: 60 * 60 * 24 * 365,
  });

  refresh();
  return { ok: true, seq: (prev?.seq ?? 0) + 1, isNew };
}

const EDITABLE = ["stage", "next_action_date", "next_action", "memo"] as const;
type Field = (typeof EDITABLE)[number];

export async function updateLogField(id: string, field: Field, value: string) {
  if (!(await isAuthed())) throw new Error("로그인이 필요합니다.");
  if (!EDITABLE.includes(field)) throw new Error("수정할 수 없는 항목입니다.");
  const v = value.trim();
  if (field === "stage" && !has(LOG_STAGES, v)) throw new Error("잘못된 단계입니다.");
  if (field === "next_action_date" && v && !isDateStr(v)) throw new Error("날짜 형식 오류");

  const supabase = createServiceClient();
  const { error } = await supabase
    .from(LOGS_TABLE)
    .update({ [field]: v || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function deleteSalesLog(id: string) {
  if (!(await isAuthed())) throw new Error("로그인이 필요합니다.");
  const supabase = createServiceClient();
  const { error } = await supabase.from(LOGS_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}
