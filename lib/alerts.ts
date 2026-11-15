// 잔디 알림 실행기. 5분마다(Netlify 예약 함수) 호출되어
//  1) 새 방문예약 알림  2) 정해진 시각 아침 브리핑  3) 로그인 실패 급증 경고 를 처리합니다.
import { createServiceClient, VISITS_TABLE } from "@/lib/supabase/server";
import type { VisitReservation } from "@/lib/types";
import { getJandiConfig, getJandiState, setSetting, type JandiConfig, type JandiState } from "@/lib/settings";
import { sendJandi, validJandiUrl, appUrl, type JandiMessage } from "@/lib/jandi";
import { buildDailyBrief, newVisitMessage, newCallMessage } from "@/lib/briefing";
import { ACTIVITY_TABLE } from "@/lib/activity";
import { kstToday } from "@/lib/kst";
import type { CallLead } from "@/lib/types";

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

// 아침 브리핑 전송 (영업팀 + 전시장별 + 관리자)
export async function sendDailyBrief(cfg: JandiConfig, report: string[]) {
  const brief = await buildDailyBrief(createServiceClient());
  if (cfg.brief) {
    await sendTo(cfg.teamUrl, brief.team, report, "브리핑(영업팀)");
    for (const [branch, url] of Object.entries(cfg.branchUrls ?? {})) {
      const msg = brief.branches.get(branch);
      if (msg) await sendTo(url, msg, report, `브리핑(${branch})`);
    }
  }
  if (cfg.admin) await sendTo(cfg.adminUrl, brief.admin, report, "관리자 요약");
}

export async function runTick(): Promise<{ ok: boolean; report: string[] }> {
  const report: string[] = [];
  const { value: cfg, missing } = await getJandiConfig();
  if (missing) return { ok: false, report: ["설정 테이블(crm_settings)이 없습니다."] };
  if (!validJandiUrl(cfg.teamUrl) && !validJandiUrl(cfg.adminUrl)) return { ok: true, report: ["잔디 웹훅 미설정"] };

  const { value: state } = await getJandiState();
  const next: JandiState = { ...state, lastTickAt: new Date().toISOString() };
  const supabase = createServiceClient();

  // 1) 새 방문예약 알림
  if (cfg.newVisit && validJandiUrl(cfg.teamUrl)) {
    if (!state.visitCursor) {
      next.visitCursor = new Date().toISOString(); // 처음 켰을 때 과거 예약을 한꺼번에 보내지 않음
    } else {
      const { data } = await supabase
        .from(VISITS_TABLE)
        .select("*")
        .gt("created_at", state.visitCursor)
        .order("created_at", { ascending: true })
        .limit(20);
      for (const r of (data ?? []) as VisitReservation[]) {
        const { msg, branch } = newVisitMessage(r);
        await sendTo(cfg.teamUrl, msg, report, "새 방문예약(영업팀)");
        const bUrl = branch ? cfg.branchUrls?.[branch] : undefined;
        if (bUrl) await sendTo(bUrl, msg, report, `새 방문예약(${branch})`);
        next.visitCursor = r.created_at;
      }
    }
  }

  // 2) 아침 브리핑 (정해진 시각 이후, 하루 1번)
  const today = kstToday();
  if (state.lastBriefDate !== today && kstHHMM() >= cfg.briefHour * 60 + cfg.briefMinute) {
    await sendDailyBrief(cfg, report);
    next.lastBriefDate = today;
  }

  // 3) 로그인 실패 급증 (10분 내 5회 이상, 30분에 1번만)
  if (cfg.admin && validJandiUrl(cfg.adminUrl)) {
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from(ACTIVITY_TABLE)
      .select("actor,detail,ip,created_at")
      .eq("kind", "login_failed")
      .gte("created_at", since)
      .limit(100);
    const fails = (data ?? []) as { actor: string | null; detail: string | null; ip: string | null }[];
    const quiet = !state.lastFailAlertAt || Date.now() - Date.parse(state.lastFailAlertAt) > 30 * 60 * 1000;
    if (fails.length >= 5 && quiet) {
      await sendTo(
        cfg.adminUrl,
        {
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
        },
        report,
        "로그인 실패 경고"
      );
      next.lastFailAlertAt = new Date().toISOString();
    }
  }

  await setSetting("jandi_state", next);
  return { ok: true, report };
}

// 대표번호 문의 등록 즉시 알림 (등록 화면에서 호출)
export async function notifyNewCall(
  c: Pick<CallLead, "name" | "phone" | "inquiry" | "region" | "salesperson" | "called_at">,
  by: string | null
) {
  try {
    const { value: cfg, missing } = await getJandiConfig();
    if (missing || !cfg.newCall || !validJandiUrl(cfg.teamUrl)) return;
    await sendJandi(cfg.teamUrl, newCallMessage(c, by));
  } catch {
    /* 알림 실패는 등록에 영향 없음 */
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
