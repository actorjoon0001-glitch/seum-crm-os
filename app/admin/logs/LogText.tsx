import { stageColor, type SalesCustomerLog } from "@/lib/sales-db";

// 일지 1건 표시 (신규 등록 / 단계 변경 / 상담 메모)
export default function LogText({ log }: { log: SalesCustomerLog }) {
  if (log.kind === "created")
    return (
      <span className="text-gray-600">
        <span className="mr-1 rounded bg-seum-light px-1.5 text-xs font-bold text-seum-dark">신규 등록</span>
        <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${stageColor(log.to_stage)}`}>{log.to_stage}</span>
        {log.note && <span className="ml-1">{log.note}</span>}
      </span>
    );
  if (log.kind === "stage")
    return (
      <span className="text-gray-600">
        단계 변경 <span className="text-gray-400">{log.from_stage}</span> →{" "}
        <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${stageColor(log.to_stage)}`}>{log.to_stage}</span>
      </span>
    );
  return <span className="whitespace-pre-wrap text-gray-600">💬 {log.note}</span>;
}
