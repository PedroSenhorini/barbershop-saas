"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/action-form";
import { money, optionalText, staffAction, text, uuidOrNull } from "@/lib/action-utils";
import { isValidDateIso, todayIso } from "@/lib/time";

function refresh() {
  revalidatePath("/admin/clube");
  revalidatePath("/admin/clube/planos");
  revalidatePath("/admin/financeiro");
}

export async function savePlan(_prev: FormState, formData: FormData): Promise<FormState> {
  const { error, ctx } = await staffAction(true);
  if (!ctx) return { error };
  const id = uuidOrNull(formData, "id");
  const name = text(formData, "name");
  const price = money(formData, "price");
  const usesRaw = text(formData, "uses");
  const uses = usesRaw ? Number(usesRaw) : null;
  if (name.length < 2) return { error: "Informe o nome do plano." };
  if (price === null) return { error: "Preço inválido." };
  if (uses !== null && (!Number.isInteger(uses) || uses < 1 || uses > 60)) return { error: "Atendimentos por mês inválido." };

  const values = {
    name: name.slice(0, 60),
    price,
    uses_per_month: uses,
    description: optionalText(formData, "description", 200),
    active: formData.get("active") === "on",
  };
  const { error: dbError } = id
    ? await ctx.supabase.from("club_plans").update(values).eq("id", id)
    : await ctx.supabase.from("club_plans").insert({ ...values, barbershop_id: ctx.barbershop.id });
  if (dbError) return { error: "Não foi possível salvar o plano." };
  refresh();
  return { error: null, ok: Date.now() };
}

export async function subscribe(_prev: FormState, formData: FormData): Promise<FormState> {
  const { error, ctx } = await staffAction();
  if (!ctx) return { error };
  const customerId = uuidOrNull(formData, "customerId");
  const planId = uuidOrNull(formData, "planId");
  const firstDue = text(formData, "firstDue") || todayIso(ctx.barbershop.timezone);
  if (!customerId || !planId) return { error: "Escolha o cliente e o plano." };
  if (!isValidDateIso(firstDue)) return { error: "Data inválida." };

  const { data: plan } = await ctx.supabase.from("club_plans").select("price, active").eq("id", planId).maybeSingle();
  if (!plan?.active) return { error: "Plano indisponível." };

  const { error: dbError } = await ctx.supabase.from("club_subscriptions").insert({
    barbershop_id: ctx.barbershop.id,
    customer_id: customerId,
    plan_id: planId,
    price: plan.price,
    started_on: todayIso(ctx.barbershop.timezone),
    next_due_on: firstDue,
    sold_by: ctx.profile.id,
  });
  if (dbError) {
    return { error: dbError.code === "23505" ? "Este cliente já tem uma assinatura ativa." : "Não foi possível assinar." };
  }
  refresh();
  revalidatePath(`/admin/clientes/${customerId}`);
  return { error: null, ok: Date.now() };
}

export async function payClub(_prev: FormState, formData: FormData): Promise<FormState> {
  const { error, ctx } = await staffAction();
  if (!ctx) return { error };
  const id = uuidOrNull(formData, "id");
  const method = text(formData, "method");
  const amount = money(formData, "amount");
  if (!id) return { error: "Assinatura inválida." };
  if (!["dinheiro", "pix", "cartao"].includes(method)) return { error: "Escolha como recebeu." };
  if (amount === null) return { error: "Valor inválido." };

  const { data, error: dbError } = await ctx.supabase.rpc("register_club_payment", {
    p_subscription_id: id,
    p_amount: amount,
    p_method: method,
    p_paid_on: todayIso(ctx.barbershop.timezone),
  });
  if (dbError) return { error: "Não foi possível registrar o pagamento." };
  refresh();
  const next = String(data ?? "").split("-").reverse().join("/");
  return { error: null, ok: Date.now(), notice: next ? `Pago! Próximo vencimento: ${next}.` : "Pago!" };
}

export async function cancelSubscription(_prev: FormState, formData: FormData): Promise<FormState> {
  const { error, ctx } = await staffAction();
  if (!ctx) return { error };
  const id = uuidOrNull(formData, "id");
  if (!id) return { error: "Assinatura inválida." };
  const { data } = await ctx.supabase
    .from("club_subscriptions")
    .update({ status: "cancelada", canceled_on: todayIso(ctx.barbershop.timezone) })
    .eq("id", id)
    .select("id");
  if (!data?.length) return { error: "Não foi possível cancelar." };
  refresh();
  return { error: null, ok: Date.now() };
}
