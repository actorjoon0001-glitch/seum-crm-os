"use server";

import { revalidatePath } from "next/cache";
import { isOwner } from "@/lib/require-auth";
import { DEFAULT_JANDI, getJandiConfig, setSetting, type JandiConfig } from "@/lib/settings";
import { appUrl, sendJandi, validJandiUrl } from "@/lib/jandi";
import { sendDailyBrief } from "@/lib/alerts";
import { createServiceClient, VISITS_TABLE } from "@/lib/supabase/server";
import { visitDateOf } from "@/lib/visit-pending";

export interface ActionResult {
  ok: boolean;
  message?: string;
  error?: string;
}

// 잔디 알림 설정 저장 (빈 칸은 기존 URL 유지, '삭제' 체크 시 지움)
export async function saveJandi(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!(await isOwner())) return { ok: false, error: "관리자만 설정할 수 있습니다." };
  const { value: cur, missing } = await getJandiConfig();
  if (missing) return { ok: false, error: "설정 테이블(crm_settings)을 먼저 만들어 주세요." };

  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const url = (k: string, old: string) => {
    if (formData.get(`${k}__clear`) != null) return "";
    const v = get(k);
    return v || old;
  };

  const next: JandiConfig = {
    ...DEFAULT_JANDI,
    ...cur,
    teamUrl: url("teamUrl", cur.teamUrl),
    adminUrl: url("adminUrl", cur.adminUrl),
    branchUrls: {},
    briefHour: Math.min(23, Math.max(0, Number(get("briefHour")) || 0)),
    briefMinute: Math.min(59, Math.max(0, Number(get("briefMinute")) || 0)),
    brief: formData.get("brief") != null,
    newVisit: formData.get("newVisit") != null,
    newCall: formData.get("newCall") != null,
    admin: formData.get("admin") != null,
  };
  // 전시장 칸: 이름은 값(branchName_i)으로, URL 은 branchUrl_i 로 받음
  // (폼 필드 '이름'에 한글을 쓰면 전송 중 깨지므로 번호로 구분)
  const shown = new Set<string>();
  for (let i = 0; formData.has(`branchName_${i}`); i++) {
    const branch = get(`branchName_${i}`);
    if (!branch) continue;
    shown.add(branch);
    const v = url(`branchUrl_${i}`, cur.branchUrls?.[branch] ?? "");
    if (v) next.branchUrls[branch] = v;
  }
  // 이번 화면에 없는 전시장(직원 소속 변경 등)의 기존 URL 은 유지
  for (const [b, u] of Object.entries(cur.branchUrls ?? {})) if (!shown.has(b)) next.branchUrls[b] = u;

  const bad = [next.teamUrl, next.adminUrl, ...Object.values(next.branchUrls)].filter((u) => u && !validJandiUrl(u));
  if (bad.length) return { ok: false, error: "잔디 웹훅 URL은 https://wh.jandi.com/connect-api/webhook/ 으로 시작해야 합니다." };

  const err = await setSetting("jandi", next);
  if (err) return { ok: false, error: err };
  revalidatePath("/admin/manage");
  return { ok: true, message: "저장되었습니다." };
}

// 테스트 메시지 보내기
export async function testJandi(target: string): Promise<ActionResult> {
  if (!(await isOwner())) return { ok: false, error: "관리자만 가능합니다." };
  const { value: cfg } = await getJandiConfig();
  const url = target === "team" ? cfg.teamUrl : target === "admin" ? cfg.adminUrl : cfg.branchUrls?.[target];
  if (!validJandiUrl(url)) return { ok: false, error: "먼저 웹훅 URL을 저장해 주세요." };
  const r = await sendJandi(url!, {
    body: "✅ 고객관리OS 잔디 알림 연결 테스트입니다.",
    color: "#10B981",
    sections: [
      {
        title: target === "team" ? "전체 영업팀 토픽" : target === "admin" ? "관리자 토픽" : `${target} 토픽`,
        description: `이 토픽으로 알림이 옵니다.\n${appUrl("/")}`,
      },
    ],
  });
  return r.ok ? { ok: true, message: "테스트 메시지를 보냈습니다. 잔디를 확인해 주세요." } : { ok: false, error: r.error };
}

// 아침 브리핑을 지금 바로 보내기 (미리 확인용)
export async function sendBriefNow(): Promise<ActionResult> {
  if (!(await isOwner())) return { ok: false, error: "관리자만 가능합니다." };
  const { value: cfg } = await getJandiConfig();
  const any =
    validJandiUrl(cfg.teamUrl) || validJandiUrl(cfg.adminUrl) || Object.values(cfg.branchUrls ?? {}).some((u) => validJandiUrl(u));
  if (!any) return { ok: false, error: "먼저 웹훅 URL을 저장해 주세요." };
  const report: string[] = [];
  await sendDailyBrief({ ...cfg, brief: true, admin: true }, report);
  return { ok: true, message: report.join(" · ") || "보낼 대상이 없습니다." };
}

// 방문 결과 미입력 추적 기준 변경
// 예약을 고르면: 지금 이후 새로 접수되는 예약 + 그 예약 방문일 이후 예약만 추적 / 비우면 전체 추적
export async function setPendingSince(formData: FormData): Promise<void> {
  if (!(await isOwner())) return;
  const id = String(formData.get("visitId") ?? "").trim();
  if (!id) {
    await setSetting("visit_pending", { since: null, fromVisitDate: null, label: "전체 예약", v: 2 });
  } else {
    const { data } = await createServiceClient().from(VISITS_TABLE).select("*").eq("id", id).maybeSingle();
    if (!data) return;
    const p = typeof data.payload === "object" && data.payload ? (data.payload as Record<string, unknown>) : {};
    const name = data.name || (typeof p.name === "string" ? p.name : "") || "(이름없음)";
    const d = visitDateOf(data);
    await setSetting("visit_pending", {
      since: new Date().toISOString(),
      fromVisitDate: d || null,
      label: d ? `새로 접수되는 예약 + ${name} 방문일(${d}) 이후 예약` : "새로 접수되는 예약부터",
      v: 2,
    });
  }
  revalidatePath("/");
  revalidatePath("/admin/visits");
  revalidatePath("/admin/manage");
}
