import Link from "next/link";
import { logout } from "@/app/login/actions";
import { currentRole, currentUserName } from "@/lib/require-auth";

export type NavKey = "home" | "visits" | "main" | "mobile" | "logs" | "kpi" | "manage";

const ITEMS: { key: NavKey; href: string; label: string }[] = [
  { key: "home", href: "/", label: "📊 한눈에 보기" },
  { key: "visits", href: "/admin/visits", label: "🏠 방문예약" },
  { key: "main", href: "/admin/calls/main", label: "☎️ 대표번호" },
  { key: "mobile", href: "/admin/calls/mobile", label: "📱 영업사원 영업폰" },
  { key: "logs", href: "/admin/logs", label: "📒 고객DB · 일지" },
  { key: "kpi", href: "/admin/kpi", label: "📈 KPI" },
];

// 모든 화면 상단 공통 내비게이션. 세움OS 권한이 admin 인 계정에만 '관리자' 메뉴 표시
export default async function AppNav({ active }: { active: NavKey }) {
  const role = await currentRole();
  const name = await currentUserName();
  const items =
    role === "owner" ? [...ITEMS, { key: "manage" as NavKey, href: "/admin/manage", label: "🛡️ 관리자" }] : ITEMS;

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
      <div className="flex flex-wrap items-center gap-1">
        <Link href="/" className="mr-3 text-lg font-bold tracking-tight">
          세움 고객관리<span className="text-seum">OS</span>
        </Link>
        {items.map((it) => (
          <Link
            key={it.key}
            href={it.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              active === it.key
                ? it.key === "manage"
                  ? "bg-gray-900 text-white"
                  : "bg-seum text-white"
                : it.key === "manage"
                  ? "text-gray-800 ring-1 ring-gray-300 hover:bg-gray-100"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            }`}
          >
            {it.label}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {name && (
          <span className="text-sm text-gray-500">
            {role === "owner" && <span className="mr-1 rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-bold text-white">관리자</span>}
            {name} 님
          </span>
        )}
        <form action={logout}>
          <button className="rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:text-gray-600">로그아웃</button>
        </form>
      </div>
    </nav>
  );
}
