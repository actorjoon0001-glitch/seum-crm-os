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
          주소 / 방문 희망 매장
        </label>
        <input
          name="address"
          className={inputClass}
          placeholder="예) 서울 강남점 / 거주 지역"
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
