import Link from "next/link";
import { logout } from "@/app/login/actions";

export type NavKey = "home" | "visits" | "main" | "mobile";

const ITEMS: { key: NavKey; href: string; label: string }[] = [
  { key: "home", href: "/", label: "📊 한눈에 보기" },
  { key: "visits", href: "/admin/visits", label: "🏠 방문예약" },
  { key: "main", href: "/admin/calls/main", label: "☎️ 대표번호" },
  { key: "mobile", href: "/admin/calls/mobile", label: "📱 영업사원 핸드폰" },
];

// 모든 화면 상단 공통 내비게이션 (3개 고객 카테고리 + 한눈에 보기)
export default function AppNav({ active }: { active: NavKey }) {
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
      <div className="flex flex-wrap items-center gap-1">
        <Link href="/" className="mr-3 text-lg font-bold tracking-tight">
          세움 고객관리<span className="text-seum">OS</span>
        </Link>
        {ITEMS.map((it) => (
          <Link
            key={it.key}
            href={it.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              active === it.key
                ? "bg-seum text-white"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            }`}
          >
            {it.label}
          </Link>
        ))}
      </div>
      <form action={logout}>
        <button className="rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:text-gray-600">
          로그아웃
        </button>
      </form>
    </nav>
  );
}
