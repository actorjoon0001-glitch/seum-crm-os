"use client";

import { useFormState, useFormStatus } from "react-dom";
import { login, type LoginState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-seum py-3 text-base font-semibold text-white transition hover:bg-seum-dark disabled:opacity-60"
    >
      {pending ? "확인 중..." : "로그인"}
    </button>
  );
}

export default function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useFormState<LoginState | null, FormData>(
    login,
    null
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          관리자 비밀번호
        </label>
        <input
          name="password"
          type="password"
          autoFocus
          required
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-seum focus:ring-2 focus:ring-seum/20"
          placeholder="비밀번호 입력"
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          name="remember"
          defaultChecked
          className="h-4 w-4 rounded border-gray-300 text-seum focus:ring-seum/30"
        />
        자동 로그인 (다음부터 비밀번호 입력 없이 유지)
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
