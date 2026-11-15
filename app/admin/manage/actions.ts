"use server";

import { revalidatePath } from "next/cache";
import { isOwner } from "@/lib/require-auth";
import { DEFAULT_JANDI, getJandiConfig, setSetting, type JandiConfig } from "@/lib/settings";
import { appUrl, sendJandi, validJandiUrl } from "@/lib/jandi";
import { sendDailyBrief } from "@/lib/alerts";

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
  for (const branch of formData.getAll("branch").map(String)) {
    const v = url(`branch:${branch}`, cur.branchUrls?.[branch] ?? "");
    if (v) next.branchUrls[branch] = v;
  }

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
        title: target === "team" ? "영업팀 토픽" : target === "admin" ? "관리자 토픽" : `${target} 토픽`,
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
  if (!validJandiUrl(cfg.teamUrl) && !validJandiUrl(cfg.adminUrl)) return { ok: false, error: "먼저 웹훅 URL을 저장해 주세요." };
  const report: string[] = [];
  await sendDailyBrief({ ...cfg, brief: true, admin: true }, report);
  return { ok: true, message: report.join(" · ") || "보낼 대상이 없습니다." };
}
