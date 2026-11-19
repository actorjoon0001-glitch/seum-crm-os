"use server";

import { revalidatePath } from "next/cache";
import { currentUserName, isOwner } from "@/lib/require-auth";
import { logActivity } from "@/lib/activity";
import { DEFAULT_JANDI, getJandiConfig, getSetting, setSetting, type JandiConfig } from "@/lib/settings";
import { appUrl, sendJandi, validJandiUrl } from "@/lib/jandi";
import { sendDailyBrief } from "@/lib/alerts";
import {
  DEFAULT_TELEGRAM,
  getTelegramConfig,
  registerWebhook,
  sendTelegram,
  tgApi,
  tgReady,
  type TelegramConfig,
} from "@/lib/telegram";
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
    visitToAdmin: formData.get("visitToAdmin") != null,
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

// 아침 브리핑을 지금 바로 보내기 (미리 확인용) — 고른 곳에만 보냄 (잔디 · 텔레그램 둘 다)
// targets: "admin" / 전시장 이름
export async function sendBriefNow(targets: string[] = []): Promise<ActionResult> {
  if (!(await isOwner())) return { ok: false, error: "관리자만 가능합니다." };
  const pick = new Set((Array.isArray(targets) ? targets : []).map((t) => String(t)));
  if (pick.size === 0) return { ok: false, error: "보낼 곳을 하나 이상 골라 주세요." };
  const { value: cfg } = await getJandiConfig();
  const report: string[] = [];
  await sendDailyBrief({ ...cfg, brief: true, admin: true }, report, pick);
  return report.length ? { ok: true, message: report.join(" · ") } : { ok: false, error: "고른 곳에 연결된 잔디 · 텔레그램 방이 없습니다." };
}

// ---------- 텔레그램 ----------
// 설정 저장 (새 토큰을 넣으면 확인 후 웹훅 자동 등록)
export async function saveTelegram(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!(await isOwner())) return { ok: false, error: "관리자만 설정할 수 있습니다." };
  const { value: cur, missing } = await getTelegramConfig();
  if (missing) return { ok: false, error: "설정 테이블(crm_settings)을 먼저 만들어 주세요." };
  const get = (k: string) => String(formData.get(k) ?? "").trim();

  const next: TelegramConfig = { ...DEFAULT_TELEGRAM, ...cur, chats: {} };
  let note = "";
  if (formData.get("tgToken__clear") != null) {
    if (tgReady(cur)) await tgApi(cur.token, "deleteWebhook", {});
    await setSetting("telegram", { ...DEFAULT_TELEGRAM });
    revalidatePath("/admin/manage");
    return { ok: true, message: "텔레그램 연결을 해제했습니다." };
  }
  const token = get("tgToken");
  if (token) {
    if (!/^\d+:[\w-]{20,}$/.test(token)) return { ok: false, error: "봇 토큰 형식이 아닙니다. (숫자:영문… 형태)" };
    const me = await tgApi<{ username?: string }>(token, "getMe");
    if (!me.ok) return { ok: false, error: `토큰 확인 실패: ${me.error}` };
    next.token = token;
    next.botUsername = me.result?.username ?? "";
    const wh = await registerWebhook(token);
    note = wh.ok ? " 봇 연결 완료." : ` (웹훅 등록 실패: ${wh.error})`;
  }
  if (!tgReady(next)) return { ok: false, error: "먼저 봇 토큰을 넣어 주세요." };

  // 전시장 ↔ 단톡방 (폼 필드 이름은 번호로, 한글은 값으로)
  const shown = new Set<string>();
  for (let i = 0; formData.has(`tgBranchName_${i}`); i++) {
    const branch = get(`tgBranchName_${i}`);
    if (!branch) continue;
    shown.add(branch);
    const chat = get(`tgChat_${i}`);
    if (chat) next.chats[branch] = chat;
  }
  for (const [b, c] of Object.entries(cur.chats ?? {})) if (!shown.has(b) && c) next.chats[b] = c;
  if (formData.has("tgAdminChat")) next.adminChat = get("tgAdminChat");
  if (formData.has("tgRemindMin")) next.remindMin = Math.max(0, Math.min(240, Number(get("tgRemindMin")) || 0));
  if (formData.has("tgOptions")) next.maskPhone = formData.get("tgMaskPhone") != null;

  const err = await setSetting("telegram", next);
  if (err) return { ok: false, error: err };
  revalidatePath("/admin/manage");
  return { ok: true, message: `저장되었습니다.${note}` };
}

// 웹훅 다시 등록 (주소가 바뀌었거나 단톡방이 목록에 안 뜰 때)
export async function reconnectTelegram(): Promise<ActionResult> {
  if (!(await isOwner())) return { ok: false, error: "관리자만 가능합니다." };
  const { value: cfg } = await getTelegramConfig();
  if (!tgReady(cfg)) return { ok: false, error: "먼저 봇 토큰을 저장해 주세요." };
  const r = await registerWebhook(cfg.token);
  revalidatePath("/admin/manage");
  return r.ok ? { ok: true, message: "다시 연결했습니다." } : { ok: false, error: r.error };
}

// 테스트 메시지 (target: 전시장 이름 / "admin")
export async function testTelegram(target: string): Promise<ActionResult> {
  if (!(await isOwner())) return { ok: false, error: "관리자만 가능합니다." };
  const { value: cfg } = await getTelegramConfig();
  if (!tgReady(cfg)) return { ok: false, error: "먼저 봇 토큰을 저장해 주세요." };
  const chat = target === "admin" ? cfg.adminChat : cfg.chats?.[target];
  if (!chat) return { ok: false, error: "먼저 단톡방을 지정하고 저장해 주세요." };
  const r = await sendTelegram(cfg, chat, {
    body: "✅ 고객관리OS 텔레그램 알림 연결 테스트입니다.",
    sections: [{ title: target === "admin" ? "관리자 방" : `${target} 방`, description: `이 방으로 알림이 옵니다.\n${appUrl("/")}` }],
  });
  return r.ok ? { ok: true, message: "보냈습니다." } : { ok: false, error: r.error };
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

// 고객DB · 일지 · KPI 보기 권한 저장 (관리자만)
export async function saveAccess(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!(await isOwner())) return { ok: false, error: "관리자만 설정할 수 있습니다." };
  const users: Record<string, { scope: "all" | "branches"; branches?: string[] }> = {};
  const changes: string[] = [];
  for (let i = 0; formData.has(`eid_${i}`); i++) {
    const eid = String(formData.get(`eid_${i}`) ?? "");
    const scope = String(formData.get(`scope_${i}`) ?? "own");
    if (!eid) continue;
    if (scope === "all") users[eid] = { scope: "all" };
    else if (scope === "branches") {
      const branches = formData.getAll(`br_${i}`).map(String).filter(Boolean);
      users[eid] = { scope: "branches", branches };
    }
  }
  const { value: prev } = await getSetting<{ users: Record<string, unknown> }>("access", { users: {} });
  const before = JSON.stringify(prev.users ?? {});
  const err = await setSetting("access", { users });
  if (err) return { ok: false, error: err };
  if (before !== JSON.stringify(users)) changes.push(`넓은 권한 ${Object.keys(users).length}명`);
  if (changes.length) await logActivity("permission", { actor: await currentUserName(), role: "owner", detail: `고객DB 보기 권한 변경 · ${changes.join(", ")}` });
  revalidatePath("/admin/manage");
  revalidatePath("/admin/logs");
  revalidatePath("/admin/kpi");
  return { ok: true, message: "권한이 저장되었습니다. 바로 적용됩니다." };
}
