import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
      <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-seum-light px-4 py-1 text-sm font-semibold text-seum-dark">
        세움 SEUM
      </div>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        고객관리<span className="text-seum">OS</span>
      </h1>
      <p className="mt-4 max-w-xl text-lg text-gray-600">
        수기 계약 고객과 계약서 사진을 한 곳에서 확인하고, 방문예약·call-os
        고객까지 통합 관리합니다.
      </p>

      <div className="mt-10 grid w-full gap-4 sm:grid-cols-2">
        <Link
          href="/admin"
          className="group rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:border-seum hover:shadow-md"
        >
          <div className="text-sm font-medium text-seum">관리자</div>
          <div className="mt-1 text-xl font-bold">고객관리 대시보드</div>
          <p className="mt-2 text-sm text-gray-500">
            수기 계약 고객 목록과 계약서 사진을 확인하세요.
          </p>
          <span className="mt-4 inline-block text-sm font-semibold text-seum group-hover:underline">
            대시보드 열기 →
          </span>
        </Link>

        <Link
          href="/reserve"
          className="group rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:border-seum hover:shadow-md"
        >
          <div className="text-sm font-medium text-seum">고객용</div>
          <div className="mt-1 text-xl font-bold">방문예약 신청</div>
          <p className="mt-2 text-sm text-gray-500">
            방문을 원하는 고객이 직접 예약을 신청합니다.
          </p>
          <span className="mt-4 inline-block text-sm font-semibold text-seum group-hover:underline">
            예약폼 열기 →
          </span>
        </Link>
      </div>
    </main>
  );
}
