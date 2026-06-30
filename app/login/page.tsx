import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "로그인 | 세움 고객관리OS",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const next = searchParams.next || "/admin";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="text-center">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-seum-light px-4 py-1 text-sm font-semibold text-seum-dark">
          세움 SEUM
        </div>
        <h1 className="text-2xl font-bold">
          고객관리<span className="text-seum">OS</span>
        </h1>
        <p className="mt-1 text-sm text-gray-500">관리자 전용 · 로그인이 필요합니다</p>
      </div>

      <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <LoginForm next={next} />
      </div>
    </main>
  );
}
