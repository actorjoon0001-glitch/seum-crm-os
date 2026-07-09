import Link from "next/link";
import { requireAuth } from "@/lib/require-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  await requireAuth("/");
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
      <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-seum-light px-4 py-1 text-sm font-semibold text-seum-dark">
        세움 SEUM
      </div>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        고객관리<span className="text-seum">OS</span>
      </h1>
      <p className="mt-4 max-w-xl text-lg text-gray-600">
        수기 계약 고객과 방문예약 고객을 한 곳에서 관리하는 내부 시스템입니다.
      </p>

      <div className="mt-10 grid w-full gap-4 sm:grid-cols-2">
        <Link
          href="/admin"
          className="group rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:border-seum hover:shadow-md"
        >
          <div className="text-sm font-medium text-seum">계약</div>
          <div className="mt-1 text-xl font-bold">계약 고객 관리</div>
          <p className="mt-2 text-sm text-gray-500">
            수기 계약 고객 목록과 계약서 파일을 확인하세요.
          </p>
          <span className="mt-4 inline-block text-sm font-semibold text-seum group-hover:underline">
            대시보드 열기 →
          </span>
        </Link>

        <Link
          href="/admin/visits"
          className="group rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:border-seum hover:shadow-md"
        >
          <div className="text-sm font-medium text-seum">방문예약</div>
          <div className="mt-1 text-xl font-bold">방문예약 고객</div>
          <p className="mt-2 text-sm text-gray-500">
            방문예약한 고객 목록을 확인하세요.
          </p>
          <span className="mt-4 inline-block text-sm font-semibold text-seum group-hover:underline">
            예약 목록 열기 →
          </span>
        </Link>
      </div>
    </main>
  );
}
