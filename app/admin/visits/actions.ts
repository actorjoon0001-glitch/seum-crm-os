"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient, VISITS_TABLE } from "@/lib/supabase/server";

export async function updateVisitStatus(id: string, status: string) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from(VISITS_TABLE)
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/visits");
}

export async function updateVisitAssignee(id: string, assigned_to: string) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from(VISITS_TABLE)
    .update({ assigned_to: assigned_to || null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/visits");
}

// 직원(관리자) 메모 저장. 고객이 폼에 쓴 memo 와 절대 섞이지 않도록
// payload 의 별도 키(staffMemo)에 병합 저장한다.
export async function updateVisitStaffMemo(id: string, staffMemo: string) {
  const supabase = createServiceClient();

  const { data, error: selErr } = await supabase
    .from(VISITS_TABLE)
    .select("payload")
    .eq("id", id)
    .single();
  if (selErr) throw new Error(selErr.message);

  let payload: Record<string, unknown> = {};
  const raw = (data as { payload?: unknown } | null)?.payload;
  if (raw && typeof raw === "object") {
    payload = { ...(raw as Record<string, unknown>) };
  } else if (typeof raw === "string") {
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      payload = {};
    }
  }

  const trimmed = staffMemo.trim();
  if (trimmed) payload.staffMemo = trimmed;
  else delete payload.staffMemo;

  const { error } = await supabase
    .from(VISITS_TABLE)
    .update({ payload })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/visits");
}

// 방문예약 행 삭제
export async function deleteVisit(id: string) {
  const supabase = createServiceClient();
  const { error } = await supabase.from(VISITS_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/visits");
}
