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

  const { data, error } = await supabase
    .from("employees")
    .select("name,team,showroom,position_name,status")
    .limit(1000);
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
        branch: e.showroom ? showroomLabel(e.showroom) : null,
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

// 전시장별 묶음 (본사 → 1·2·3·4전시장 → 강화 → 기타 가나다순 → 미지정)
export function groupByBranch(people: Salesperson[]): { branch: string; people: Salesperson[] }[] {
  const order = ["headquarters", "showroom1", "showroom2", "showroom3", "showroom4", "ganghwa"].map((k) => SHOWROOM_LABEL[k]);
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
