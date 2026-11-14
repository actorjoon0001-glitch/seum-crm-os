"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { login, type LoginState } from "./actions";

const EMAIL_KEY = "seum_login_email";

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

const input =
  "w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-seum focus:ring-2 focus:ring-seum/20";

export default function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useFormState<LoginState | null, FormData>(login, null);
  const [email, setEmail] = useState("");

  // 이 기기에서 마지막으로 쓴 아이디(이메일) 기억
  useEffect(() => {
    try {
      setEmail(localStorage.getItem(EMAIL_KEY) ?? "");
    } catch {
      /* 저장소 사용 불가 */
    }
  }, []);

  return (
    <form
      action={formAction}
      onSubmit={() => {
        try {
          if (email.trim()) localStorage.setItem(EMAIL_KEY, email.trim());
        } catch {
          /* 무시 */
        }
      }}
      className="space-y-4"
    >
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">세움OS 아이디 (이메일)</label>
        <input
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
          className={input}
          placeholder="example@seum.com"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">비밀번호</label>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={input}
          placeholder="세움OS 비밀번호"
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          name="remember"
          defaultChecked
          className="h-4 w-4 rounded border-gray-300 text-seum focus:ring-seum/30"
        />
        자동 로그인 (30일 동안 유지)
      </label>

      {state?.error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{state.error}</p>}

      <SubmitButton />
      <p className="text-center text-xs leading-relaxed text-gray-400">
        세움OS에 가입하고 승인받은 계정으로 로그인합니다.
        <br />
        계정이 없거나 비밀번호를 잊었다면 세움OS에서 가입 · 비밀번호 찾기를 해 주세요.
      </p>
    </form>
  );
}
