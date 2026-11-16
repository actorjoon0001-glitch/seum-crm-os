"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient, VISITS_TABLE } from "@/lib/supabase/server";
import { currentRole, currentUserName, isAuthed } from "@/lib/require-auth";
import { logActivity } from "@/lib/activity";
import { notifyVisitHandoff } from "@/lib/alerts";
import { canSeeVisit, getAccess } from "@/lib/access";
import type { VisitReservation } from "@/lib/types";

// 보기 범위 안의 예약만 수정 · 삭제 가능
async function guardVisit(id: string) {
  const { data } = await createServiceClient().from(VISITS_TABLE).select("*").eq("id", id).maybeSingle();
  if (!data) throw new Error("예약을 찾을 수 없습니다.");
  if (!canSeeVisit(await getAccess(), data as VisitReservation)) throw new Error("다른 전시장 예약은 수정할 수 없습니다.");
}

export async function updateVisitStatus(id: string, status: string) {
  if (!(await isAuthed())) throw new Error("로그인이 필요합니다.");
  await guardVisit(id);
  const supabase = createServiceClient();
  const { error } = await supabase
    .from(VISITS_TABLE)
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/visits");
}

export async function updateVisitAssignee(id: string, assigned_to: string) {
  if (!(await isAuthed())) throw new Error("로그인이 필요합니다.");
  await guardVisit(id);
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
  if (!(await isAuthed())) throw new Error("로그인이 필요합니다.");
  await guardVisit(id);
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
  if (!(await isAuthed())) throw new Error("로그인이 필요합니다.");
  await guardVisit(id);
  const supabase = createServiceClient();
  const { data: cur } = await supabase.from(VISITS_TABLE).select("name,phone,visit_date").eq("id", id).single();
  const { error } = await supabase.from(VISITS_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity("delete", {
    actor: await currentUserName(),
    role: await currentRole(),
    detail: `방문예약 ${cur?.name ?? ""} ${cur?.phone ?? ""} (방문일 ${cur?.visit_date ?? "-"})`,
  });
  revalidatePath("/admin/visits");
}

// 방문예약을 전시장으로 넘기기 (payload.handoffBranch) → 그 전시장 잔디 영업팀 토픽 알림
export async function updateVisitBranch(id: string, branch: string) {
  if (!(await isAuthed())) throw new Error("로그인이 필요합니다.");
  await guardVisit(id);
  const b = branch.trim().slice(0, 40);
  const supabase = createServiceClient();
  const { data, error: selErr } = await supabase.from(VISITS_TABLE).select("*").eq("id", id).single();
  if (selErr) throw new Error(selErr.message);

  let payload: Record<string, unknown> = {};
  const raw = (data as { payload?: unknown }).payload;
  if (raw && typeof raw === "object") payload = { ...(raw as Record<string, unknown>) };
  else if (typeof raw === "string") {
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      payload = {};
    }
  }
  if (b) {
    payload.handoffBranch = b;
    payload.handoffAt = new Date().toISOString();
  } else {
    delete payload.handoffBranch;
    delete payload.handoffAt;
  }
  const { error } = await supabase.from(VISITS_TABLE).update({ payload }).eq("id", id);
  if (error) throw new Error(error.message);
  if (b) await notifyVisitHandoff({ ...data, payload }, b, await currentUserName());
  revalidatePath("/admin/visits");
  revalidatePath("/");
}
