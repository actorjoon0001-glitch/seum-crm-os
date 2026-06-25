"use client";

import { useTransition } from "react";
import { updateStatus } from "./actions";
import {
  STATUS_LABEL,
  STATUS_ORDER,
  STATUS_COLOR,
  type CustomerStatus,
} from "@/lib/types";

export default function StatusSelect({
  id,
  status,
}: {
  id: string;
  status: CustomerStatus;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as CustomerStatus;
        startTransition(() => updateStatus(id, next));
      }}
      className={`cursor-pointer rounded-full border-0 px-3 py-1 text-xs font-semibold outline-none ring-1 ring-inset ring-black/5 ${STATUS_COLOR[status]} ${pending ? "opacity-50" : ""}`}
    >
      {STATUS_ORDER.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}
