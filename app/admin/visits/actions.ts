"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient, VISITS_TABLE } from "@/lib/supabase/server";

export async function updateVisitStatus(id: string, status: string) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from(VISITS_TABLE)
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/visits");
}

export async function updateVisitAssignee(id: string, assigned_to: string) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from(VISITS_TABLE)
    .update({ assigned_to: assigned_to || null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/visits");
}
