"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/action-form";
import { money, staffAction, text, uuidOrNull } from "@/lib/action-utils";

function percent(value: string) {
  if (!value) return 0;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) / 100 : null;
}

export async function saveCommission(_prev: FormState, formData: FormData): Promise<FormState> {
  const { error, ctx } = await staffAction(true);
  if (!ctx) return { error };
  const id = uuidOrNull(formData, "id");
  const service = percent(text(formData, "commission"));
  const product = percent(text(formData, "productCommission"));
  const goalRaw = text(formData, "goal");
  const goal = goalRaw ? money(formData, "goal") : null;
  if (!id) return { error: "Profissional inválido." };
  if (service === null || product === null) return { error: "Porcentagem entre 0 e 100." };
  if (goalRaw && goal === null) return { error: "Meta inválida." };

  // Confere pela sessão que o profissional é desta barbearia (RLS também barra).
  const { data } = await ctx.supabase
    .from("users")
    .update({ commission_percent: service, product_commission_percent: product, monthly_goal: goal })
    .eq("id", id)
    .eq("barbershop_id", ctx.barbershop.id)
    .select("id");
  if (!data?.length) return { error: "Não foi possível salvar." };
  revalidatePath("/admin/comissoes");
  revalidatePath("/admin/desempenho");
  return { error: null, ok: Date.now() };
}
