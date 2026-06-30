"use client";

import { useFormState, useFormStatus } from "react-dom";
import { submitReservation, type ReserveResult } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-seum py-3 text-base font-semibold text-white transition hover:bg-seum-dark disabled:opacity-60"
    >
      {pending ? "접수 중..." : "방문예약 신청하기"}
    </button>
  );
}

const inputClass =
  "w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-seum focus:ring-2 focus:ring-seum/20";

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1 block text-sm font-medium text-gray-700">
      {children}
      {required && <span className="text-red-500"> *</span>}
    </label>
  );
}

function Select({
  name,
  options,
  placeholder,
}: {
  name: string;
  options: string[];
  placeholder: string;
}) {
  return (
    <select name={name} defaultValue="" className={inputClass}>
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export default function ReserveForm() {
  const [state, formAction] = useFormState<ReserveResult | null, FormData>(
    submitReservation,
    null
  );

  if (state?.ok) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
        <div className="text-2xl">✅</div>
        <h2 className="mt-3 text-xl font-bold text-green-800">예약이 접수되었습니다</h2>
        <p className="mt-2 text-sm text-green-700">
          담당자가 확인 후 입력하신 연락처로 연락드리겠습니다. 감사합니다.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label required>이름</Label>
        <input name="name" required className={inputClass} placeholder="홍길동" />
      </div>

      <div>
        <Label required>연락처</Label>
        <input
          name="phone"
          required
          type="tel"
          className={inputClass}
          placeholder="010-1234-5678"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>방문 희망일</Label>
          <input name="visitDate" type="date" className={inputClass} />
        </div>
        <div>
          <Label>방문 희망시간</Label>
          <Select
            name="visitTime"
            placeholder="시간 선택"
            options={[
              "10:00",
              "11:00",
              "12:00",
              "13:00",
              "14:00",
              "15:00",
              "16:00",
              "17:00",
            ]}
          />
        </div>
      </div>

      <div>
        <Label>방문 인원</Label>
        <Select
          name="visitorCount"
          placeholder="인원 선택"
          options={["1명", "2명", "3명", "4명", "5명 이상"]}
        />
      </div>

      <div>
        <Label>관심 상품</Label>
        <Select
          name="interestType"
          placeholder="관심 상품 선택"
          options={[
            "체험형 쉼터",
            "이동식 주택",
            "농막",
            "모듈러 주택",
            "단독주택",
            "기타",
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>희망 평수</Label>
          <Select
            name="size"
            placeholder="평수 선택"
            options={["6평", "10평", "15평", "18평", "20평", "20평 이상", "상담 후 결정"]}
          />
        </div>
        <div>
          <Label>예산 범위</Label>
          <Select
            name="budget"
            placeholder="예산 선택"
            options={[
              "3천만원 이하",
              "3천~5천",
              "5천~8천",
              "8천~1억",
              "1억 이상",
              "상담 후 결정",
            ]}
          />
        </div>
      </div>

      <div>
        <Label>토지 보유 여부</Label>
        <Select
          name="landOwned"
          placeholder="선택"
          options={["있음", "없음", "검토중"]}
        />
      </div>

      <div>
        <Label>토지 지번주소</Label>
        <input
          name="addrJibun"
          className={inputClass}
          placeholder="예) 인천 강화군 삼흥리 51-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>희망 방 개수</Label>
          <Select
            name="roomCount"
            placeholder="선택"
            options={["1개", "2개", "3개", "상담 후 결정"]}
          />
        </div>
        <div>
          <Label>희망 화장실 개수</Label>
          <Select
            name="bathCount"
            placeholder="선택"
            options={["1개", "2개", "상담 후 결정"]}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>데크 희망</Label>
          <Select
            name="wantDeck"
            placeholder="선택"
            options={["희망", "미희망", "상담 후 결정"]}
          />
        </div>
        <div>
          <Label>3D 도면 희망</Label>
          <Select name="want3D" placeholder="선택" options={["희망", "미희망"]} />
        </div>
      </div>

      <div>
        <Label>유입경로</Label>
        <Select
          name="source"
          placeholder="어떻게 알게 되셨나요?"
          options={["유튜브", "네이버 검색", "인스타그램", "블로그", "지인소개", "광고", "기타"]}
        />
      </div>

      <div>
        <Label>문의 / 남기실 말씀</Label>
        <textarea
          name="memo"
          rows={3}
          className={inputClass}
          placeholder="추가로 전달하실 내용을 적어주세요"
        />
      </div>

      <label className="flex items-start gap-2 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
        <input type="checkbox" name="agree" value="동의" required className="mt-0.5" />
        <span>
          개인정보 수집·이용에 동의합니다. <span className="text-red-500">*</span>
          <br />
          <span className="text-xs text-gray-400">
            (수집항목: 이름·연락처 등 / 목적: 방문예약 상담 / 보유기간: 상담 종료 후 파기)
          </span>
        </span>
      </label>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
