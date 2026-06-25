"use server";

import { revalidatePath } from "next/cache";
import {
  createServiceClient,
  CUSTOMERS_TABLE,
  EVENTS_TABLE,
} from "@/lib/supabase/server";
import type { CustomerStatus } from "@/lib/types";

export async function updateStatus(id: string, status: CustomerStatus) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from(CUSTOMERS_TABLE)
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await supabase.from(EVENTS_TABLE).insert({
    customer_id: id,
    type: "status_change",
    detail: status,
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/${id}`);
}

export async function updateMemo(id: string, memo: string) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from(CUSTOMERS_TABLE)
    .update({ memo })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/${id}`);
}

export async function updateAssignee(id: string, assigned_to: string) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from(CUSTOMERS_TABLE)
    .update({ assigned_to: assigned_to || null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath(`/admin/${id}`);
}
