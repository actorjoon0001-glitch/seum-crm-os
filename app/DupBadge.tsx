import Link from "next/link";
import { SOURCE_NAME, type CustomerRef } from "@/lib/dedupe";

// 같은 연락처가 다른 곳에도 있으면 '🔗 n곳' 표시 → 누르면 목록 펼침
export default function DupBadge({ refs }: { refs: CustomerRef[] }) {
  if (refs.length === 0) return null;
  const kinds = Array.from(new Set(refs.map((r) => SOURCE_NAME[r.kind])));
  return (
    <details className="group relative mt-0.5 inline-block">
      <summary
        className="inline-flex cursor-pointer list-none items-center gap-0.5 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 hover:bg-violet-200 [&::-webkit-details-marker]:hidden"
        title={`같은 연락처: ${kinds.join(", ")}`}
      >
        🔗 다른 곳 {refs.length}
      </summary>
      <div className="absolute left-0 z-20 mt-1 w-64 rounded-lg border border-violet-200 bg-white p-2 text-left text-xs shadow-lg">
        <div className="mb-1 font-semibold text-violet-800">같은 연락처로 등록된 기록</div>
        <ul className="space-y-1">
          {refs.map((r) => (
            <li key={`${r.kind}:${r.id}`}>
              <Link href={r.href} className="block rounded px-1.5 py-1 hover:bg-violet-50">
                <span className="font-semibold text-gray-800">{SOURCE_NAME[r.kind]}</span>
                <span className="block text-[11px] text-gray-500">{r.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
