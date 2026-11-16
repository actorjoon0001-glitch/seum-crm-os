"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient, CALLS_TABLE } from "@/lib/supabase/server";
import { currentRole, currentUserName, isAuthed } from "@/lib/require-auth";
import { logActivity } from "@/lib/activity";
import { notifyCallHandoff, notifyNewCall } from "@/lib/alerts";
import { canSeeCall, getAccess } from "@/lib/access";
import { isCallChannel, CALL_STATUSES } from "@/lib/types";
import { kstInputToISO } from "@/lib/kst";
import { isGrade } from "@/lib/sales-db";

export interface CallFormResult {
  ok: boolean;
  error?: string;
  // 성공 시 폼을 비우기 위한 증가 키
  seq?: number;
}

async function guard(id?: string) {
  if (!(await isAuthed())) throw new Error("로그인이 필요합니다.");
  if (id) {
    // 보기 범위 안의 문의만 수정 · 삭제 가능
    const { data } = await createServiceClient().from(CALLS_TABLE).select("*").eq("id", id).maybeSingle();
    if (!data) throw new Error("문의를 찾을 수 없습니다.");
    if (!canSeeCall(await getAccess(), data)) throw new Error("다른 전시장 문의는 수정할 수 없습니다.");
  }
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

  const grade = isGrade(get("grade")) ? get("grade") : null;
  const branch = channel === "main" ? get("branch").slice(0, 40) || null : null;
  const supabase = createServiceClient();
  const row: Record<string, unknown> = {
    channel,
    called_at: calledAt,
    name: name || null,
    phone: phone || null,
    salesperson: salesperson || null,
    region: get("region") || null,
    inquiry: get("inquiry") || null,
    memo: get("memo") || null,
    status: "new",
  };
  const extra: Record<string, unknown> = {};
  if (grade) extra.grade = grade;
  if (branch) {
    extra.branch = branch;
    extra.handed_at = new Date().toISOString();
  }
  let { error } = await supabase.from(CALLS_TABLE).insert({ ...row, ...extra });
  // 고객등급 · 전시장 컬럼을 아직 추가하지 않았으면 그 값 없이 저장
  if (error && Object.keys(extra).length && /grade|branch|handed_at/.test(error.message))
    ({ error } = await supabase.from(CALLS_TABLE).insert(row));
  if (error) return { ok: false, error: `저장 실패: ${error.message}` };

  // 대표번호 문의는 잔디 영업팀 토픽으로 바로 알림
  if (channel === "main") {
    await notifyNewCall(
      {
        name: name || null,
        phone: phone || null,
        inquiry: get("inquiry") || null,
        region: get("region") || null,
        salesperson: salesperson || null,
        called_at: calledAt,
        grade,
        branch,
      },
      await currentUserName()
    );
  }

  refresh(channel);
  return { ok: true, seq: (prev?.seq ?? 0) + 1 };
}

const EDITABLE = ["status", "salesperson", "memo", "name", "phone", "region", "inquiry", "grade", "branch"] as const;
type EditableField = (typeof EDITABLE)[number];

// 목록에서 한 칸 수정 (상태 / 영업사원 / 메모 등)
export async function updateCallField(id: string, field: EditableField, value: string) {
  await guard(id);
  if (!EDITABLE.includes(field)) throw new Error("수정할 수 없는 항목입니다.");
  const v = value.trim();
  if (field === "status" && !CALL_STATUSES.some((s) => s.value === v))
    throw new Error("잘못된 상태입니다.");
  if (field === "grade" && v && !isGrade(v)) throw new Error("잘못된 고객등급입니다.");

  const supabase = createServiceClient();
  const patch: Record<string, unknown> = { [field]: v || null, updated_at: new Date().toISOString() };
  if (field === "branch") patch.handed_at = v ? new Date().toISOString() : null;
  const { error } = await supabase.from(CALLS_TABLE).update(patch).eq("id", id);
  if (error) {
    if (field === "grade" && /grade/.test(error.message))
      throw new Error("고객등급 칸이 없습니다. Supabase에서 고객등급 SQL을 먼저 실행해 주세요.");
    if (field === "branch" && /branch|handed_at/.test(error.message))
      throw new Error("전시장 칸이 없습니다. Supabase에서 SQL을 먼저 실행해 주세요.");
    throw new Error(error.message);
  }
  // 전시장으로 넘기면 그 전시장 잔디 토픽에 알림
  if (field === "branch" && v) {
    const { data } = await supabase.from(CALLS_TABLE).select("*").eq("id", id).single();
    if (data) await notifyCallHandoff(data, v, await currentUserName());
  }
  refresh();
}

export async function deleteCallLead(id: string) {
  await guard(id);
  const supabase = createServiceClient();
  const { data: cur } = await supabase.from(CALLS_TABLE).select("channel,name,phone").eq("id", id).single();
  const { error } = await supabase.from(CALLS_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity("delete", {
    actor: await currentUserName(),
    role: await currentRole(),
    detail: `${cur?.channel === "main" ? "대표번호" : "영업폰"} 전화고객 ${cur?.name ?? ""} ${cur?.phone ?? ""}`,
  });
  refresh();
}
