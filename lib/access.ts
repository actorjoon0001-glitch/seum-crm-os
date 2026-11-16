// 고객DB · 일지 · KPI 보기 범위 (전시장 단위)
//  - 관리자(세움OS admin): 전체
//  - 관리자가 '권한 설정'에서 지정한 사람: 전체 또는 지정 전시장
//  - 그 외 영업사원: 자기 소속 전시장 (소속이 없으면 본인 담당 고객만)
//  - 포털 자동로그인(누군지 모름): 볼 수 없음 → 세움OS 계정 로그인 필요
import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/require-auth";
import { getSetting } from "@/lib/settings";
import { getSalespeople, type Salesperson } from "@/lib/staff";

export interface AccessGrant {
  scope: "own" | "all" | "branches";
  branches?: string[];
}
export interface AccessSetting {
  users: Record<string, AccessGrant>; // employees.id → 권한
}

export interface Access {
  ok: boolean; // 고객DB 를 볼 수 있는지
  all: boolean; // 전체 전시장
  isOwner: boolean;
  self: string | null; // 로그인한 사람 이름
  branches: string[]; // 볼 수 있는 전시장
  names: Set<string>; // 볼 수 있는 담당자 이름 (all 이면 비어 있음)
  label: string; // 화면 표시용 "보기 범위"
  staff: Salesperson[];
}

export const getAccessSetting = () => getSetting<AccessSetting>("access", { users: {} });

export const getAccess = cache(async (): Promise<Access> => {
  const s = await getSession();
  const supabase = createServiceClient();
  const staff = await getSalespeople(supabase);
  const base = { staff, names: new Set<string>(), branches: [] as string[] };
  if (!s) return { ...base, ok: false, all: false, isOwner: false, self: null, label: "로그인 필요" };
  if (s.role === "owner") return { ...base, ok: true, all: true, isOwner: true, self: s.name, label: "전체 전시장 (관리자)" };
  if (!s.eid) return { ...base, ok: false, all: false, isOwner: false, self: s.name, label: "세움OS 계정 로그인 필요" };

  const { value } = await getAccessSetting();
  const grant = value.users?.[s.eid];
  if (grant?.scope === "all") return { ...base, ok: true, all: true, isOwner: false, self: s.name, label: "전체 전시장 (권한 부여)" };

  const me = staff.find((p) => p.name === s.name);
  const branches = new Set<string>();
  if (me?.branch) branches.add(me.branch);
  if (grant?.scope === "branches") for (const b of grant.branches ?? []) branches.add(b);

  const names = new Set<string>(staff.filter((p) => p.branch && branches.has(p.branch)).map((p) => p.name));
  if (s.name) names.add(s.name);
  const list = Array.from(branches);
  return {
    ...base,
    ok: true,
    all: false,
    isOwner: false,
    self: s.name,
    branches: list,
    names,
    label: list.length ? list.join(" · ") : "본인 담당 고객만 (소속 전시장 미지정)",
  };
});

// 이 담당자의 고객을 볼 수 있는지
export function canSee(a: Access, assignee: string | null | undefined): boolean {
  if (!a.ok) return false;
  if (a.all) return true;
  return !!assignee && a.names.has(assignee);
}

// 삭제: 관리자 또는 담당자 본인
export function canDelete(a: Access, assignee: string | null | undefined): boolean {
  return a.isOwner || (!!assignee && assignee === a.self);
}
