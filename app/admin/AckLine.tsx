import { hhmm, type AckState } from "@/lib/telegram";

// 텔레그램 [확인] [연락완료] 기록 한 줄 (목록 화면)
export default function AckLine({ ack }: { ack?: AckState | null }) {
  if (!ack?.sentAt) return null;
  const day = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit" }) : "";
  const stamp = (iso?: string) => (iso && day(iso) !== day(ack.sentAt) ? `${day(iso)} ${hhmm(iso)}` : hhmm(iso));
  if (!ack.ackBy) {
    const min = Math.floor((Date.now() - Date.parse(ack.sentAt)) / 60000);
    return (
      <div className="mt-0.5 text-[10px] font-semibold text-red-600" title="텔레그램 알림 후 아직 아무도 '확인'을 누르지 않음">
        ⏳ 미확인 {min < 60 ? `${min}분` : min < 1440 ? `${Math.floor(min / 60)}시간` : `${Math.floor(min / 1440)}일`}째
      </div>
    );
  }
  return (
    <div className="mt-0.5 space-y-px text-[10px] leading-tight">
      <div className="text-emerald-700">
        ✅ {ack.ackBy} {stamp(ack.ackAt)}
      </div>
      {ack.doneBy ? (
        <div className="text-indigo-700">
          📞 {ack.doneBy} {stamp(ack.doneAt)} 연락완료
        </div>
      ) : (
        <div className="text-amber-600">📞 연락 전</div>
      )}
    </div>
  );
}
