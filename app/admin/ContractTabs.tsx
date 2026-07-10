import Link from "next/link";

// 계약 고객 화면 상단 탭: 수기 계약 / 전자 계약
export function ContractTabs({
  active,
  manualCount,
  electronicCount,
}: {
  active: "manual" | "electronic";
  manualCount?: number;
  electronicCount?: number;
}) {
  const base = "rounded-lg px-4 py-1.5 transition";
  const on = "bg-seum text-white";
  const off = "text-gray-500 hover:text-gray-800";
  return (
    <div className="mt-6 inline-flex rounded-xl border border-gray-200 bg-white p-1 text-sm font-semibold shadow-sm">
      <Link href="/admin" className={`${base} ${active === "manual" ? on : off}`}>
        ✍️ 수기 계약
        {manualCount !== undefined ? (
          <span className="ml-1 opacity-70">{manualCount}</span>
        ) : null}
      </Link>
      <Link
        href="/admin/econtracts"
        className={`${base} ${active === "electronic" ? on : off}`}
      >
        🖥️ 전자 계약
        {electronicCount !== undefined ? (
          <span className="ml-1 opacity-70">{electronicCount}</span>
        ) : null}
      </Link>
    </div>
  );
}
