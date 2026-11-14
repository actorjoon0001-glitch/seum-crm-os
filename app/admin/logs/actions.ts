"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  createServiceClient,
  SALES_CUSTOMERS_TABLE as CUST,
  SALES_CUSTOMER_LOGS_TABLE as LOGS,
  VISITS_TABLE,
  CALLS_TABLE,
} from "@/lib/supabase/server";
import { isAuthed } from "@/lib/require-auth";
import { COOKIE_OPTS, SP_COOKIE } from "@/lib/auth";
import { INFLOW_ROUTES, INFLOW_TYPES, isStage } from "@/lib/sales-db";
import { isDateStr, kstDateOf, kstToday } from "@/lib/kst";

export interface FormResult {
  ok: boolean;
  error?: string;
  message?: string;
  seq?: number;
}

type Supa = ReturnType<typeof createServiceClient>;

function refresh() {
  revalidatePath("/");
  revalidatePath("/admin/logs");
  revalidatePath("/admin/logs/customer");
  revalidatePath("/admin/kpi");
}

function rememberSp(name: string) {
  cookies().set(SP_COOKIE, encodeURIComponent(name), { ...COOKIE_OPTS, maxAge: 60 * 60 * 24 * 365 });
}

const digits = (v: string) => v.replace(/\D/g, "") || null;

// DB번호: SE-<접수연도>-<4자리 일련번호>
async function nextDbNo(supabase: Supa, year: string): Promise<string> {
  const { data } = await supabase
    .from(CUST)
    .select("db_no")
    .like("db_no", `SE-${year}-%`)
    .order("db_no", { ascending: false })
    .limit(1);
  const last = (data?.[0] as { db_no?: string } | undefined)?.db_no ?? "";
  const n = Number(last.split("-")[2] ?? 0) || 0;
  return `SE-${year}-${String(n + 1).padStart(4, "0")}`;
}

type NewCustomer = {
  received_date: string;
  customer_name: string | null;
  phone: string | null;
  region: string | null;
  inflow_type: string;
  inflow_route: string;
  interest_product: string | null;
  budget: string | null;
  branch: string | null;
  assignee: string;
  stage: string;
  memo: string | null;
  next_action_date: string | null;
  source_ref: string | null;
};

// 고객 등록 + '신규 등록' 일지 기록. 연락처 중복은 같은 담당자일 때만 막음.
async function insertCustomer(supabase: Supa, c: NewCustomer): Promise<FormResult> {
  const phone_digits = c.phone ? digits(c.phone) : null;
  let note = "";
  if (phone_digits) {
    const { data: dup } = await supabase
      .from(CUST)
      .select("db_no,assignee")
      .eq("phone_digits", phone_digits)
      .limit(5);
    const rows = (dup ?? []) as { db_no: string | null; assignee: string }[];
    const mine = rows.find((r) => r.assignee === c.assignee);
    if (mine) return { ok: false, error: `이미 등록된 고객입니다 (${mine.db_no ?? "-"}, 담당 ${mine.assignee}).` };
    if (rows.length) note = ` · 다른 담당자(${rows.map((r) => r.assignee).join(", ")})도 같은 연락처를 보유 중`;
  }

  const year = c.received_date.slice(0, 4);
  for (let attempt = 0; attempt < 4; attempt++) {
    const db_no = await nextDbNo(supabase, year);
    const { data, error } = await supabase
      .from(CUST)
      .insert({ ...c, db_no, phone_digits, last_contact_date: kstToday() })
      .select("id,db_no")
      .single();
    if (error?.code === "23505") continue; // DB번호 동시 발급 충돌 → 재시도
    if (error) return { ok: false, error: `저장 실패: ${error.message}` };
    await supabase.from(LOGS).insert({
      customer_id: data.id,
      assignee: c.assignee,
      log_date: kstToday(),
      kind: "created",
      to_stage: c.stage,
      note: c.memo,
    });
    return { ok: true, message: `${data.db_no} 등록 완료${note}` };
  }
  return { ok: false, error: "DB번호 발급이 겹쳤습니다. 다시 시도해 주세요." };
}

function readCustomerForm(formData: FormData): NewCustomer | string {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const c: NewCustomer = {
    received_date: isDateStr(get("received_date")) ? get("received_date") : kstToday(),
    customer_name: get("customer_name") || null,
    phone: get("phone") || null,
    region: get("region") || null,
    inflow_type: get("inflow_type"),
    inflow_route: get("inflow_route"),
    interest_product: get("interest_product") || null,
    budget: get("budget") || null,
    branch: get("branch") || null,
    assignee: get("assignee"),
    stage: get("stage") || "1차상담",
    memo: get("memo") || null,
    next_action_date: isDateStr(get("next_action_date")) ? get("next_action_date") : null,
    source_ref: null,
  };
  if (!c.assignee) return "배정담당자(영업사원)를 선택해 주세요.";
  if (!c.customer_name && !c.phone) return "고객명 또는 연락처를 입력해 주세요.";
  if (!(INFLOW_TYPES as readonly string[]).includes(c.inflow_type)) return "*유입구분을 선택해 주세요.";
  if (!(INFLOW_ROUTES as readonly string[]).includes(c.inflow_route)) return "*유입경로를 선택해 주세요.";
  if (!isStage(c.stage)) return "*진행단계를 선택해 주세요.";
  return c;
}

export async function createCustomer(prev: FormResult | null, formData: FormData): Promise<FormResult> {
  if (!(await isAuthed())) return { ok: false, error: "로그인이 필요합니다." };
  const c = readCustomerForm(formData);
  if (typeof c === "string") return { ok: false, error: c };
  const res = await insertCustomer(createServiceClient(), c);
  if (res.ok) {
    rememberSp(c.assignee);
    refresh();
  }
  return { ...res, seq: res.ok ? (prev?.seq ?? 0) + 1 : prev?.seq };
}

// 상세 화면에서 고객 정보 수정 (단계 변경 시 일지에도 기록)
export async function updateCustomer(prev: FormResult | null, formData: FormData): Promise<FormResult> {
  if (!(await isAuthed())) return { ok: false, error: "로그인이 필요합니다." };
  const id = String(formData.get("id") ?? "");
  const c = readCustomerForm(formData);
  if (typeof c === "string") return { ok: false, error: c };
  const supabase = createServiceClient();
  const { data: cur, error: e1 } = await supabase.from(CUST).select("stage").eq("id", id).single();
  if (e1) return { ok: false, error: e1.message };

  const { source_ref: _ignore, memo: _memo, ...fields } = c;
  void _ignore;
  void _memo;
  const { error } = await supabase
    .from(CUST)
    .update({
      ...fields,
      phone_digits: c.phone ? digits(c.phone) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (cur.stage !== c.stage) {
    await supabase.from(LOGS).insert({
      customer_id: id,
      assignee: c.assignee,
      log_date: kstToday(),
      kind: "stage",
      from_stage: cur.stage,
      to_stage: c.stage,
    });
  }
  refresh();
  return { ok: true, message: "저장되었습니다.", seq: (prev?.seq ?? 0) + 1 };
}

// 목록에서 진행단계 변경 → 일지 기록
export async function changeStage(id: string, stage: string) {
  if (!(await isAuthed())) throw new Error("로그인이 필요합니다.");
  if (!isStage(stage)) throw new Error("잘못된 진행단계입니다.");
  const supabase = createServiceClient();
  const { data: cur, error: e1 } = await supabase.from(CUST).select("stage,assignee").eq("id", id).single();
  if (e1) throw new Error(e1.message);
  if (cur.stage === stage) return;
  const today = kstToday();
  const { error } = await supabase
    .from(CUST)
    .update({ stage, last_contact_date: today, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await supabase.from(LOGS).insert({
    customer_id: id,
    assignee: cur.assignee,
    log_date: today,
    kind: "stage",
    from_stage: cur.stage,
    to_stage: stage,
  });
  refresh();
}

// 오늘 상담 내용 기록 (+ 다음 연락일)
export async function addNote(id: string, note: string, nextDate?: string) {
  if (!(await isAuthed())) throw new Error("로그인이 필요합니다.");
  const text = note.trim();
  if (!text) return;
  const supabase = createServiceClient();
  const { data: cur, error: e1 } = await supabase.from(CUST).select("assignee").eq("id", id).single();
  if (e1) throw new Error(e1.message);
  const today = kstToday();
  const patch: Record<string, unknown> = {
    memo: text,
    last_contact_date: today,
    updated_at: new Date().toISOString(),
  };
  if (nextDate !== undefined) patch.next_action_date = isDateStr(nextDate) ? nextDate : null;
  const { error } = await supabase.from(CUST).update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  await supabase.from(LOGS).insert({
    customer_id: id,
    assignee: cur.assignee,
    log_date: today,
    kind: "note",
    note: text,
  });
  refresh();
}

export async function setNextDate(id: string, date: string) {
  if (!(await isAuthed())) throw new Error("로그인이 필요합니다.");
  if (date && !isDateStr(date)) throw new Error("날짜 형식 오류");
  const supabase = createServiceClient();
  const { error } = await supabase
    .from(CUST)
    .update({ next_action_date: date || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function deleteCustomer(id: string) {
  if (!(await isAuthed())) throw new Error("로그인이 필요합니다.");
  const supabase = createServiceClient();
  const { error } = await supabase.from(CUST).delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

// 방문예약 / 전화 고객에서 배정된 고객을 내 고객 DB로 가져오기
export async function importAssigned(ref: string, assignee: string, branch: string): Promise<FormResult> {
  if (!(await isAuthed())) return { ok: false, error: "로그인이 필요합니다." };
  const [kind, srcId] = ref.split(":");
  const supabase = createServiceClient();
  const base = {
    received_date: kstToday(),
    assignee,
    branch: branch || null,
    stage: "1차상담",
    memo: null as string | null,
    next_action_date: null,
    budget: null as string | null,
    interest_product: null as string | null,
    region: null as string | null,
    source_ref: ref,
  };

  let c: NewCustomer;
  if (kind === "visit") {
    const { data, error } = await supabase.from(VISITS_TABLE).select("*").eq("id", srcId).single();
    if (error) return { ok: false, error: error.message };
    const p = (typeof data.payload === "object" && data.payload) || {};
    const pick = (keys: string[], col?: string) => {
      for (const k of keys) {
        const v = (p as Record<string, unknown>)[k];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
      return col && data[col] ? String(data[col]) : null;
    };
    c = {
      ...base,
      received_date: kstDateOf(data.submitted_at ?? data.created_at),
      customer_name: pick(["name"], "name"),
      phone: pick(["phone"], "phone"),
      region: pick(["landAddress", "addrJibun"], "addr_jibun"),
      inflow_type: "배정",
      inflow_route: "온라인예약",
      interest_product: [pick(["houseType", "interestType"], "interest_type"), pick(["pyeong", "size"], "size")]
        .filter(Boolean)
        .join(" ") || null,
      budget: pick(["budget"], "budget"),
      stage: "방문예정",
      memo: pick(["memo"], "memo"),
    };
  } else if (kind === "call") {
    const { data, error } = await supabase.from(CALLS_TABLE).select("*").eq("id", srcId).single();
    if (error) return { ok: false, error: error.message };
    c = {
      ...base,
      received_date: kstDateOf(data.called_at),
      customer_name: data.name,
      phone: data.phone,
      region: data.region,
      inflow_type: data.channel === "main" ? "배정" : "개별",
      inflow_route: data.channel === "main" ? "대표번호" : "기타",
      memo: data.inquiry,
    };
  } else return { ok: false, error: "잘못된 요청입니다." };

  const res = await insertCustomer(supabase, c);
  if (res.ok) refresh();
  return res;
}
