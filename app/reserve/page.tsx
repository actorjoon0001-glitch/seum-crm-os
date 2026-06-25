import Link from "next/link";
import ReserveForm from "./ReserveForm";

export const metadata = {
  title: "방문예약 신청 | 세움",
};

export default function ReservePage() {
  return (
    <main className="mx-auto min-h-screen max-w-lg px-6 py-12">
      <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
        ← 세움 홈
      </Link>

      <div className="mt-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-seum-light px-3 py-1 text-xs font-semibold text-seum-dark">
          세움 방문예약
        </div>
        <h1 className="mt-3 text-2xl font-bold">방문예약 신청</h1>
        <p className="mt-1 text-sm text-gray-500">
          아래 정보를 입력하시면 담당자가 확인 후 연락드립니다.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <ReserveForm />
      </div>
    </main>
  );
}
