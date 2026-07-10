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

// 관리자 메모 저장 (memo 컬럼). 고객 폼 원본은 payload 에 별도 보존됨.
export async function updateVisitMemo(id: string, memo: string) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from(VISITS_TABLE)
    .update({ memo: memo || null })
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
