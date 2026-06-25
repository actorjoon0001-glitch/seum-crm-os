import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createServiceClient,
  hasSupabaseEnv,
  CUSTOMERS_TABLE,
  EVENTS_TABLE,
} from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import {
  SOURCE_LABEL,
  STATUS_LABEL,
  type Customer,
} from "@/lib/types";
import StatusSelect from "../StatusSelect";
import { MemoEditor, AssigneeEditor } from "./DetailEditors";

export const dynamic = "force-dynamic";

interface CustomerEvent {
  id: string;
  type: string;
  detail: string | null;
  created_at: string;
}

export default async function CustomerDetail({
  params,
}: {
  params: { id: string };
}) {
  if (!hasSupabaseEnv()) notFound();

  const supabase = createServiceClient();
  const { data } = await supabase
    .from(CUSTOMERS_TABLE)
    .select("*")
    .eq("id", params.id)
    .single();

  if (!data) notFound();
  const c = data as Customer;

  const { data: events } = await supabase
    .from(EVENTS_TABLE)
    .select("*")
    .eq("customer_id", c.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">
        ← 고객관리 목록
      </Link>

      <div className="mt-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{c.name}</h1>
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                c.source === "visit"
                  ? "bg-seum-light text-seum-dark"
                  : "bg-purple-100 text-purple-700"
              }`}
            >
              {SOURCE_LABEL[c.source]}
            </span>
          </div>
          <a href={`tel:${c.phone}`} className="mt-1 block text-sm text-seum">
            {c.phone}
          </a>
        </div>
        <StatusSelect id={c.id} status={c.status} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="이메일" value={c.email} />
        <Field label="희망 방문일시" value={formatDateTime(c.preferred_at)} />
        <Field label="방문 목적 / 관심" value={c.purpose} />
        <Field label="유입경로" value={c.channel} />
        <Field label="접수일" value={formatDateTime(c.created_at)} />
        <Field label="최근 수정" value={formatDateTime(c.updated_at)} />
        {c.external_id && <Field label="call-os ID" value={c.external_id} />}
      </div>

      <Section title="담당자">
        <AssigneeEditor id={c.id} assignee={c.assigned_to} />
      </Section>

      <Section title="상담 메모">
        <MemoEditor id={c.id} memo={c.memo} />
      </Section>

      <Section title="이력">
        {events && events.length > 0 ? (
          <ul className="space-y-2">
            {(events as CustomerEvent[]).map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2 text-sm"
              >
                <span className="text-gray-700">
                  {e.type === "status_change"
                    ? `상태 변경 → ${STATUS_LABEL[e.detail as keyof typeof STATUS_LABEL] ?? e.detail}`
                    : e.detail}
                </span>
                <span className="text-xs text-gray-400">
                  {formatDateTime(e.created_at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">이력이 없습니다.</p>
        )}
      </Section>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3">
      <div className="text-xs font-medium text-gray-400">{label}</div>
      <div className="mt-0.5 text-sm text-gray-800">{value || "-"}</div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-bold text-gray-500">{title}</h2>
      {children}
    </section>
  );
}
