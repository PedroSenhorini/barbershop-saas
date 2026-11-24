"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/action-form";
import { staffAction, text, uuidOrNull } from "@/lib/action-utils";
import type { Lead } from "@/lib/supabase/types";

const STATUSES: Lead["status"][] = ["novo", "contatado", "virou_cliente"];

export async function setLeadStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const { error, ctx } = await staffAction();
  if (!ctx) return { error };
  const id = uuidOrNull(formData, "id");
  const status = text(formData, "status") as Lead["status"];
  if (!id || !STATUSES.includes(status)) return { error: "Dados inválidos." };

  // RLS: só cadastros da própria barbearia.
  const { data } = await ctx.supabase.from("leads").update({ status }).eq("id", id).select("id");
  if (!data?.length) return { error: "Não foi possível atualizar." };
  revalidatePath("/admin/cadastros");
  return { error: null, ok: Date.now() };
}
