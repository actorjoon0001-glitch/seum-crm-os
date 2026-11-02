"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient, CALLS_TABLE } from "@/lib/supabase/server";
import { isAuthed } from "@/lib/require-auth";
import { isCallChannel, CALL_STATUSES } from "@/lib/types";
import { kstInputToISO } from "@/lib/kst";

export interface CallFormResult {
  ok: boolean;
  error?: string;
  // 성공 시 폼을 비우기 위한 증가 키
  seq?: number;
}

async function guard() {
  if (!(await isAuthed())) throw new Error("로그인이 필요합니다.");
}

function refresh(channel?: string) {
  revalidatePath("/");
  if (channel) revalidatePath(`/admin/calls/${channel}`);
  else revalidatePath("/admin/calls/[channel]", "page");
}

// 전화 고객 1건 수기 등록
export async function createCallLead(
  prev: CallFormResult | null,
  formData: FormData
): Promise<CallFormResult> {
  if (!(await isAuthed())) return { ok: false, error: "로그인이 필요합니다." };

  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const channel = get("channel");
  if (!isCallChannel(channel)) return { ok: false, error: "잘못된 구분입니다." };

  const name = get("name");
  const phone = get("phone");
  const salesperson = get("salesperson");
  if (!name && !phone) return { ok: false, error: "고객명 또는 연락처 중 하나는 입력해 주세요." };
  if (channel === "mobile" && !salesperson)
    return { ok: false, error: "영업사원 이름을 입력해 주세요." };

  const calledAt = kstInputToISO(get("called_at")) ?? new Date().toISOString();

  const supabase = createServiceClient();
  const { error } = await supabase.from(CALLS_TABLE).insert({
    channel,
    called_at: calledAt,
    name: name || null,
    phone: phone || null,
    salesperson: salesperson || null,
    region: get("region") || null,
    inquiry: get("inquiry") || null,
    memo: get("memo") || null,
    status: "new",
  });
  if (error) return { ok: false, error: `저장 실패: ${error.message}` };

  refresh(channel);
  return { ok: true, seq: (prev?.seq ?? 0) + 1 };
}

const EDITABLE = ["status", "salesperson", "memo", "name", "phone", "region", "inquiry"] as const;
type EditableField = (typeof EDITABLE)[number];

// 목록에서 한 칸 수정 (상태 / 영업사원 / 메모 등)
export async function updateCallField(id: string, field: EditableField, value: string) {
  await guard();
  if (!EDITABLE.includes(field)) throw new Error("수정할 수 없는 항목입니다.");
  const v = value.trim();
  if (field === "status" && !CALL_STATUSES.some((s) => s.value === v))
    throw new Error("잘못된 상태입니다.");

  const supabase = createServiceClient();
  const { error } = await supabase
    .from(CALLS_TABLE)
    .update({ [field]: v || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function deleteCallLead(id: string) {
  await guard();
  const supabase = createServiceClient();
  const { error } = await supabase.from(CALLS_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}
