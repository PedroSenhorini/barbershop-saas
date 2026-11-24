"use server";

import { revalidatePath } from "next/cache";
import { staffAction } from "@/lib/action-utils";

/** Marca que o cliente foi chamado agora (some da fila por 14 dias). */
export async function markContacted(customerId: string) {
  const { error, ctx } = await staffAction();
  if (!ctx) return { error };
  if (!/^[0-9a-f-]{36}$/i.test(customerId)) return { error: "Cliente inválido." };
  const { data } = await ctx.supabase
    .from("customers")
    .update({ last_contacted_at: new Date().toISOString() })
    .eq("id", customerId)
    .select("id");
  if (!data?.length) return { error: "Não foi possível marcar." };
  revalidatePath("/admin/chamar");
  return { error: null };
}
