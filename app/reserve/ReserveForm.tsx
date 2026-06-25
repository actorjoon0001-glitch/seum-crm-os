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

export default function ReserveForm() {
  const [state, formAction] = useFormState<ReserveResult | null, FormData>(
    submitReservation,
    null
  );

  if (state?.ok) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
        <div className="text-2xl">✅</div>
        <h2 className="mt-3 text-xl font-bold text-green-800">
          예약이 접수되었습니다
        </h2>
        <p className="mt-2 text-sm text-green-700">
          담당자가 확인 후 입력하신 연락처로 연락드리겠습니다.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          이름 <span className="text-red-500">*</span>
        </label>
        <input name="name" required className={inputClass} placeholder="홍길동" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          연락처 <span className="text-red-500">*</span>
        </label>
        <input
          name="phone"
          required
          type="tel"
          className={inputClass}
          placeholder="010-1234-5678"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          이메일
        </label>
        <input
          name="email"
          type="email"
          className={inputClass}
          placeholder="example@email.com"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          희망 방문일시
        </label>
        <input name="preferred_at" type="datetime-local" className={inputClass} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          방문 목적 / 관심 사항
        </label>
        <input
          name="purpose"
          className={inputClass}
          placeholder="상담받고 싶은 내용을 적어주세요"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          유입경로
        </label>
        <select name="channel" className={inputClass} defaultValue="">
          <option value="" disabled>
            선택해주세요
          </option>
          <option value="검색">검색(네이버/구글)</option>
          <option value="지인소개">지인소개</option>
          <option value="SNS">SNS/유튜브</option>
          <option value="광고">광고</option>
          <option value="기타">기타</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          남기실 말씀
        </label>
        <textarea
          name="memo"
          rows={3}
          className={inputClass}
          placeholder="추가로 전달하실 내용"
        />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
