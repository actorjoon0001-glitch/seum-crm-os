import { CALL_LEADS_SQL } from "@/lib/call-leads-sql";
import { isMissingTable as isMissing } from "@/lib/db-errors";
import SetupSqlNotice from "@/app/SetupSqlNotice";

export function isMissingTable(err: { code?: string; message?: string } | null) {
  return isMissing(err, "call_leads");
}

// call_leads 테이블이 아직 없을 때: 1회 실행할 SQL 안내
export default function CallsSetupNotice({ message }: { message: string }) {
  return (
    <SetupSqlNotice
      title="전화 고객 테이블"
      table="call_leads"
      sql={CALL_LEADS_SQL}
      message={message}
      after="대표번호 / 영업사원 핸드폰 고객 등록이 바로 가능합니다."
    />
  );
}
