"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/action-form";
import { money, staffAction, text, uuidOrNull } from "@/lib/action-utils";
import { openDebts } from "@/lib/debts";
import { todayIso } from "@/lib/time";

export async function receiveDebt(_prev: FormState, formData: FormData): Promise<FormState> {
  const { error, ctx } = await staffAction(true);
  if (!ctx) return { error };
  const id = uuidOrNull(formData, "id");
  const kind = text(formData, "kind");
  const method = text(formData, "method");
  if (!id || (kind !== "appointment" && kind !== "sale")) return { error: "Fiado inválido." };
  if (!["dinheiro", "pix", "cartao"].includes(method)) return { error: "Escolha como recebeu." };

  // Valor em aberto calculado no servidor; o dono pode receber uma parte.
  const debt = (await openDebts(ctx.supabase)).find((d) => d.id === id && d.kind === kind);
  if (!debt) return { error: "Este fiado já foi quitado." };
  const typed = text(formData, "amount") ? money(formData, "amount") : debt.remaining;
  if (typed === null || typed <= 0) return { error: "Valor inválido." };
  const amount = Math.min(typed, debt.remaining);

  const { error: dbError } = await ctx.supabase.from("debt_payments").insert({
    barbershop_id: ctx.barbershop.id,
    appointment_id: kind === "appointment" ? id : null,
    sale_id: kind === "sale" ? id : null,
    amount,
    payment_method: method as "dinheiro" | "pix" | "cartao",
    paid_on: todayIso(ctx.barbershop.timezone),
    received_by: ctx.profile.id,
  });
  if (dbError) return { error: "Não foi possível registrar." };

  revalidatePath("/admin/fiado");
  revalidatePath("/admin/financeiro");
  revalidatePath("/admin/clientes");
  return { error: null, ok: Date.now() };
}
