// 세움OS 직원 명단(employees, 같은 Supabase) → 영업사원 목록
import type { SupabaseClient } from "@supabase/supabase-js";
import { SHOWROOM_LABEL, showroomLabel } from "@/lib/types";

export interface Salesperson {
  name: string;
  branch: string | null; // 소속 전시장 (담당지점 기본값)
  position: string | null;
  fromStaff: boolean; // 세움OS 직원 명단에서 온 이름인지
}

// 세움OS 영업팀(승인된 직원) + 고객 DB에 이미 담당자로 쓰인 이름
export async function getSalespeople(
  supabase: SupabaseClient,
  extraNames: string[] = []
): Promise<Salesperson[]> {
  const out = new Map<string, Salesperson>();

  const [{ data, error }, { data: rooms }] = await Promise.all([
    supabase.from("employees").select("name,team,showroom,position_name,status").limit(1000),
    // 세움OS 전시장 관리(showrooms: code → name). 없으면 기본 한글 매핑 사용
    supabase.from("showrooms").select("code,name").limit(200),
  ]);
  const roomName = new Map<string, string>();
  for (const r of (rooms ?? []) as { code: string | null; name: string | null }[])
    if (r.code && r.name?.trim()) roomName.set(r.code, r.name.trim());
  const branchLabel = (code: string) => SHOWROOM_LABEL[code] ?? roomName.get(code) ?? showroomLabel(code);
  if (!error && data) {
    const staff = (data as {
      name: string | null;
      team: string | null;
      showroom: string | null;
      position_name: string | null;
      status: string | null;
    }[]).filter((e) => e.name?.trim() && (!e.status || e.status === "approved"));
    const sales = staff.filter((e) => (e.team ?? "").includes("영업"));
    for (const e of sales.length ? sales : staff) {
      const name = e.name!.trim();
      out.set(name, {
        name,
        branch: e.showroom ? branchLabel(e.showroom) : null,
        position: e.position_name,
        fromStaff: true,
      });
    }
  }

  for (const n of extraNames) {
    const name = n?.trim();
    if (name && !out.has(name)) out.set(name, { name, branch: null, position: null, fromStaff: false });
  }
  return Array.from(out.values()).sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

export const NO_BRANCH = "전시장 미지정";

// 전시장별 묶음 (서울마곡지사 → 본사 → 1·2·3·4전시장 → 강화 → 광주 → 안동 → 기타 가나다순 → 미지정)
export function groupByBranch(people: Salesperson[]): { branch: string; people: Salesperson[] }[] {
  const order = ["magok", "headquarters", "showroom1", "showroom2", "showroom3", "showroom4", "ganghwa", "gwangju", "andong"].map(
    (k) => SHOWROOM_LABEL[k]
  );
  const map = new Map<string, Salesperson[]>();
  for (const p of people) {
    const b = p.branch?.trim() || NO_BRANCH;
    if (!map.has(b)) map.set(b, []);
    map.get(b)!.push(p);
  }
  const rank = (b: string) => {
    if (b === NO_BRANCH) return 10000;
    const i = order.indexOf(b);
    return i >= 0 ? i : 100;
  };
  return Array.from(map.entries())
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0], "ko"))
    .map(([branch, people]) => ({ branch, people }));
}

// 전시장 정렬 순서 (서울마곡지사 → 본사 → 1~4전시장 → 강화 → 광주 → 안동 → 기타)
const BRANCH_ORDER = ["magok", "headquarters", "showroom1", "showroom2", "showroom3", "showroom4", "ganghwa", "gwangju", "andong"].map(
  (k) => SHOWROOM_LABEL[k]
);
const branchRank = (b: string) => {
  const i = BRANCH_ORDER.indexOf(b);
  return i >= 0 ? i : 100;
};

// 운영하지 않는 전시장 (세움OS 목록에 남아 있어도 숨김)
export const HIDDEN_BRANCHES = ["4전시장", "2전시장"];

// 전체 전시장 목록: 세움OS 전시장 관리(showrooms) + 직원 소속 전시장
// (소속 직원이 아직 없는 전시장도 포함 — 잔디 토픽 연결 · 대표번호 넘기기용)
export async function getBranches(supabase: SupabaseClient): Promise<string[]> {
  const set = new Set<string>();
  const { data, error } = await supabase.from("showrooms").select("code,name").limit(200);
  if (!error && data && data.length) {
    for (const r of data as { code: string | null; name: string | null }[]) {
      const label = (r.code && SHOWROOM_LABEL[r.code]) || r.name?.trim() || (r.code ? showroomLabel(r.code) : "");
      if (label) set.add(label);
    }
  } else {
    // showrooms 테이블을 못 읽으면 세움OS 기본 전시장 목록 사용
    for (const k of ["magok", "headquarters", "showroom1", "showroom3", "ganghwa", "gwangju", "andong"])
      set.add(SHOWROOM_LABEL[k]);
  }
  for (const p of await getSalespeople(supabase)) if (p.branch?.trim()) set.add(p.branch.trim());
  set.add(SHOWROOM_LABEL.magok); // 서울마곡지사 (showrooms 에 아직 없을 수 있음)
  return Array.from(set)
    .filter((b) => !HIDDEN_BRANCHES.includes(b))
    .sort((a, b) => branchRank(a) - branchRank(b) || a.localeCompare(b, "ko"));
}
