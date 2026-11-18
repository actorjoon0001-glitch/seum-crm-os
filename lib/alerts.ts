// 잔디 알림 실행기. 5분마다(Netlify 예약 함수) 호출되어
//  1) 새 방문예약 알림  2) 정해진 시각 아침 브리핑  3) 로그인 실패 급증 경고 를 처리합니다.
import { createServiceClient, VISITS_TABLE } from "@/lib/supabase/server";
import type { VisitReservation } from "@/lib/types";
import { getJandiConfig, getJandiState, setSetting, type JandiConfig, type JandiState } from "@/lib/settings";
import { sendJandi, validJandiUrl, appUrl, type JandiMessage } from "@/lib/jandi";
import { buildDailyBrief, newVisitMessage, newCallMessage } from "@/lib/briefing";
import { ACTIVITY_TABLE } from "@/lib/activity";
import { kstToday } from "@/lib/kst";
import { getSalespeople } from "@/lib/staff";
import type { CallLead } from "@/lib/types";
import { getTelegramConfig, sendTelegram, tgReady } from "@/lib/telegram";
import { remindUnacked, tgNotify } from "@/lib/acks";

const KST = 9 * 3600 * 1000;

function kstHHMM(): number {
  const d = new Date(Date.now() + KST);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

async function sendTo(url: string | undefined, msg: JandiMessage, report: string[], label: string) {
  if (!validJandiUrl(url)) return;
  const r = await sendJandi(url!, msg);
  report.push(`${label}: ${r.ok ? "전송" : `실패(${r.error})`}`);
}

// 아침 브리핑 전송 (전시장별 + 관리자, 잔디 · 텔레그램) — 토픽별 동시 전송으로 빠르게
// 전체 영업팀 토픽으로는 보내지 않음 (전시장마다 자기 토픽으로 받음)
// pick: 지정하면 그 전시장 이름 / "admin" 에만 보냄 (미리 보내기용)
export async function sendDailyBrief(cfg: JandiConfig, report: string[], pick?: Set<string>) {
  const brief = await buildDailyBrief(createServiceClient());
  const want = (k: string) => !pick || pick.has(k);
  const jobs: Promise<void>[] = [];
  if (cfg.brief) {
    for (const [branch, url] of Object.entries(cfg.branchUrls ?? {})) {
      const msg = brief.branches.get(branch);
      if (msg && want(branch)) jobs.push(sendTo(url, msg, report, `브리핑(${branch})`));
    }
  }
  if (cfg.admin && want("admin")) jobs.push(sendTo(cfg.adminUrl, brief.admin, report, "관리자 요약"));

  const { value: tg, missing } = await getTelegramConfig();
  if (!missing && tgReady(tg)) {
    const tgSend = async (chat: string, msg: JandiMessage, label: string) => {
      const r = await sendTelegram(tg, chat, msg);
      report.push(`텔레그램 ${label}: ${r.ok ? "전송" : `실패(${r.error})`}`);
    };
    if (cfg.brief)
      for (const [branch, chat] of Object.entries(tg.chats ?? {})) {
        const msg = brief.branches.get(branch);
        if (chat && msg && want(branch)) jobs.push(tgSend(chat, msg, `브리핑(${branch})`));
      }
    if (cfg.admin && tg.adminChat && want("admin")) jobs.push(tgSend(tg.adminChat, brief.admin, "관리자 요약"));
  }
  await Promise.all(jobs);
}

// 방문예약 고객 이름 (payload 우선)
function vName(r: VisitReservation): string | undefined {
  const p = (r as { payload?: unknown }).payload;
  const pn = p && typeof p === "object" ? (p as Record<string, unknown>).name : undefined;
  return (typeof pn === "string" && pn) || (r as { name?: string | null }).name || undefined;
}

async function telegramOn(): Promise<boolean> {
  const { value, missing } = await getTelegramConfig();
  return !missing && tgReady(value);
}

// 어떤 토픽이든 하나라도 연결됐는지
function anyUrl(cfg: JandiConfig): boolean {
  return (
    validJandiUrl(cfg.teamUrl) ||
    validJandiUrl(cfg.adminUrl) ||
    Object.values(cfg.branchUrls ?? {}).some((u) => validJandiUrl(u))
  );
}

// 전시장 토픽 → 없으면 전체 영업팀 토픽 → 없으면 관리자 토픽
function routeUrl(cfg: JandiConfig, branch: string | null | undefined): { url?: string; label: string } {
  const b = branch ? cfg.branchUrls?.[branch] : undefined;
  if (validJandiUrl(b)) return { url: b, label: branch! };
  if (validJandiUrl(cfg.teamUrl)) return { url: cfg.teamUrl, label: "영업팀" };
  if (validJandiUrl(cfg.adminUrl)) return { url: cfg.adminUrl, label: "관리자(전시장 토픽 없음)" };
  return { label: "-" };
}

export async function runTick(): Promise<{ ok: boolean; report: string[] }> {
  const report: string[] = [];
  const { value: cfg, missing } = await getJandiConfig();
  if (missing) return { ok: false, report: ["설정 테이블(crm_settings)이 없습니다."] };
  if (!anyUrl(cfg) && !(await telegramOn())) return { ok: true, report: ["잔디 · 텔레그램 미설정"] };

  const { value: state } = await getJandiState();
  const nowMs = Date.now();
  // 이전 실행이 아직 진행 중이면(잠금 4분) 건너뜀 — 겹쳐서 두 번 보내지 않도록
  if (state.lockUntil && Date.parse(state.lockUntil) > nowMs) return { ok: true, report: ["이전 실행 진행 중 — 건너뜀"] };

  const next: JandiState = {
    ...state,
    lastTickAt: new Date(nowMs).toISOString(),
    lockUntil: new Date(nowMs + 4 * 60 * 1000).toISOString(),
  };
  const save = () => setSetting("jandi_state", next);
  const supabase = createServiceClient();
  const today = kstToday();

  // 무엇을 보낼지 먼저 정하고, '보냈음' 기록을 먼저 저장한 뒤 전송 (중간에 끊겨도 반복 전송 안 됨)
  // 1) 새 방문예약
  let newVisits: VisitReservation[] = [];
  if (cfg.newVisit) {
    if (!state.visitCursor) {
      next.visitCursor = new Date(nowMs).toISOString(); // 처음 켰을 때 과거 예약을 한꺼번에 보내지 않음
    } else {
      const { data } = await supabase
        .from(VISITS_TABLE)
        .select("*")
        .gt("created_at", state.visitCursor)
        .order("created_at", { ascending: true })
        .limit(20);
      newVisits = (data ?? []) as VisitReservation[];
      if (newVisits.length) next.visitCursor = newVisits[newVisits.length - 1].created_at;
    }
  }
  // 2) 아침 브리핑 (정해진 시각 이후, 하루 1번)
  const briefDue = state.lastBriefDate !== today && kstHHMM() >= cfg.briefHour * 60 + cfg.briefMinute;
  if (briefDue) next.lastBriefDate = today;
  // 3) 로그인 실패 급증 (10분 내 5회 이상, 30분에 1번만)
  let fails: { actor: string | null; detail: string | null; ip: string | null }[] = [];
  const { value: tgCfg } = await getTelegramConfig();
  const tgAdmin = tgReady(tgCfg) && !!tgCfg.adminChat;
  if (cfg.admin && (validJandiUrl(cfg.adminUrl) || tgAdmin)) {
    const quiet = !state.lastFailAlertAt || nowMs - Date.parse(state.lastFailAlertAt) > 30 * 60 * 1000;
    if (quiet) {
      const { data } = await supabase
        .from(ACTIVITY_TABLE)
        .select("actor,detail,ip,created_at")
        .eq("kind", "login_failed")
        .gte("created_at", new Date(nowMs - 10 * 60 * 1000).toISOString())
        .limit(100);
      fails = (data ?? []) as typeof fails;
      if (fails.length >= 5) next.lastFailAlertAt = new Date(nowMs).toISOString();
      else fails = [];
    }
  }

  await save(); // ← 보내기 전에 기록 확정

  const jobs: Promise<void>[] = [];
  for (const r of newVisits) {
    const { msg, branch } = newVisitMessage(r);
    // 고객이 고른 전시장 토픽으로만 (전시장 토픽이 없을 때만 전체 영업팀 → 관리자 토픽으로 대신)
    const route = routeUrl(cfg, branch);
    jobs.push(sendTo(route.url, msg, report, `새 방문예약(${route.label})`));
    jobs.push(tgNotify(branch, msg, { kind: "v", id: String(r.id), name: vName(r) }, report, "새 방문예약"));
  }
  jobs.push(remindUnacked(report));
  if (briefDue) jobs.push(sendDailyBrief(cfg, report));
  if (fails.length) {
    const failMsg: JandiMessage = {
      body: `🚨 최근 10분 동안 로그인 실패 ${fails.length}건`,
      color: "#DC2626",
      sections: [
        {
          title: "실패 기록",
          description: fails
            .slice(0, 15)
            .map((f) => `• ${f.actor ?? "-"} · ${f.detail ?? ""} · IP ${f.ip ?? "-"}`)
            .join("\n"),
        },
        { title: "관리자 화면", description: appUrl("/admin/manage?kind=login_failed") },
      ],
    };
    jobs.push(sendTo(cfg.adminUrl, failMsg, report, "로그인 실패 경고"));
    if (tgAdmin)
      jobs.push(
        sendTelegram(tgCfg, tgCfg.adminChat, failMsg).then((r) => {
          report.push(`텔레그램 로그인 실패 경고: ${r.ok ? "전송" : `실패(${r.error})`}`);
        })
      );
  }
  await Promise.all(jobs);

  // 실행 결과 기록 (관리자 화면 '최근 전송' 표시용) + 잠금 해제
  if (report.length) {
    const at = new Date().toISOString();
    next.recent = [...report.map((r) => ({ at, text: r })), ...(state.recent ?? [])].slice(0, 30);
  }
  next.lockUntil = undefined;
  await save();
  return { ok: true, report };
}

// 대표번호 문의 등록 즉시 알림 (등록 화면에서 호출)
export async function notifyNewCall(
  c: Pick<CallLead, "name" | "phone" | "inquiry" | "region" | "salesperson" | "called_at"> & {
    grade?: string | null;
    branch?: string | null;
    id?: string | null;
  },
  by: string | null
) {
  try {
    const { value: cfg, missing } = await getJandiConfig();
    if (missing || !cfg.newCall) return;
    // 넘길 전시장이 정해졌으면 그 전시장 토픽 → 아니면 담당 영업사원의 전시장 토픽 (둘 다 없으면 전체/관리자)
    let branch: string | null = c.branch ?? null;
    if (!branch && c.salesperson) {
      const staff = await getSalespeople(createServiceClient());
      branch = staff.find((s) => s.name === c.salesperson)?.branch ?? null;
    }
    const route = routeUrl(cfg, branch);
    const msg = newCallMessage(c, by);
    // 전시장 토픽으로만 (전체 영업팀 토픽에 중복으로 올리지 않음)
    if (route.url) await sendJandi(route.url, msg);
    await tgNotify(branch, msg, c.id ? { kind: "c", id: String(c.id), name: c.name || undefined } : undefined);
  } catch {
    /* 알림 실패는 등록에 영향 없음 */
  }
}

// 대표번호 문의를 전시장으로 넘겼을 때: 그 전시장 토픽으로 알림
export async function notifyCallHandoff(
  c: Pick<CallLead, "name" | "phone" | "inquiry" | "region" | "salesperson" | "called_at" | "memo"> & {
    grade?: string | null;
    id?: string | null;
  },
  branch: string,
  by: string | null
) {
  try {
    const { value: cfg, missing } = await getJandiConfig();
    if (missing) return;
    const route = routeUrl(cfg, branch);
    const msg: JandiMessage = {
      body: `📨 대표번호 문의가 [${branch}]으로 넘어왔습니다 — ${c.name || "(이름없음)"}`,
      color: "#6366F1",
      sections: [
        {
          title: `${c.name || "(이름없음)"}${c.phone ? ` · ${c.phone}` : ""}`,
          description: [
            c.region && `지역: ${c.region}`,
            c.inquiry && `문의: ${c.inquiry}`,
            c.grade && `고객등급: ${c.grade}`,
            c.memo && `메모: ${c.memo}`,
            `담당: ${c.salesperson || "⚠ 미배정 — 전시장에서 담당자를 정해 주세요"}`,
            by && `넘긴 사람: ${by}`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
        { title: "대표번호 고객 보기", description: appUrl(`/admin/calls/main?branch=${encodeURIComponent(branch)}`) },
      ],
    };
    if (route.url) await sendJandi(route.url, msg);
    await tgNotify(branch, msg, c.id ? { kind: "c", id: String(c.id), name: c.name || undefined } : undefined);
  } catch {
    /* 알림 실패는 이관에 영향 없음 */
  }
}

// 방문예약을 전시장으로 넘겼을 때: 그 전시장 잔디 영업팀 토픽으로 알림
export async function notifyVisitHandoff(r: VisitReservation, branch: string, by: string | null) {
  try {
    const { value: cfg, missing } = await getJandiConfig();
    if (missing) return;
    const route = routeUrl(cfg, branch);
    const { msg } = newVisitMessage(r);
    const out: JandiMessage = {
      ...msg,
      body: `📨 방문예약 고객이 [${branch}]으로 넘어왔습니다 — ${msg.body.split("— ")[1] ?? ""}${by ? `\n넘긴 사람: ${by}` : ""}`,
      color: "#6366F1",
    };
    if (route.url) await sendJandi(route.url, out);
    await tgNotify(branch, out, { kind: "v", id: String(r.id), name: vName(r) });
  } catch {
    /* 알림 실패는 넘기기에 영향 없음 */
  }
}

// 자동 실행 비밀값 (Netlify 예약 함수와 같은 방식으로 계산)
export async function cronSecret(): Promise<string> {
  const base = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`seum-cron::${base}`));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
