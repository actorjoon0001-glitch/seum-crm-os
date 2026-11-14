// 세움OS 직원 명단(employees, 같은 Supabase) → 영업사원 목록
import type { SupabaseClient } from "@supabase/supabase-js";
import { showroomLabel } from "@/lib/types";

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
