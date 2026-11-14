import { GRADES } from "@/lib/sales-db";

// 고객등급 기준 (가로 한 줄)
export default function GradeLegend({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600 ${className}`}>
      <span className="font-bold text-gray-700">▶ 고객등급 기준</span>
      {GRADES.map((g) => (
        <span key={g.value} className="inline-flex items-center gap-1">
          <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-black ${g.color}`}>
            {g.value}
          </span>
          {g.desc}
        </span>
      ))}
    </div>
  );
}
