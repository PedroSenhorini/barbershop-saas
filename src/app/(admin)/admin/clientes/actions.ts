"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffContext } from "@/lib/auth";
import { parseMoney } from "@/lib/finance";

const customerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2, "Informe o nome do cliente.").max(120, "Nome muito longo."),
  notes: z
    .string()
    .trim()
    .max(1000, "Observações com no máximo 1000 caracteres.")
    .transform((v) => v || null),
  // "vip, degradê" → ["vip", "degradê"]: minúsculas, sem repetir, até 10.
  tags: z
    .string()
    .transform((v) =>
      [...new Set(v.split(",").map((t) => t.trim().toLowerCase().replace(/^#/, "").slice(0, 24)).filter(Boolean))].slice(0, 10),
    ),
});

export type CustomerFormState = { error: string | null; ok?: number };

export async function saveCustomer(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const ctx = await getStaffContext();
  if (!ctx) return { error: "Sua sessão expirou. Entre de novo." };

  const parsed = customerSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name") ?? "",
    notes: formData.get("notes") ?? "",
    tags: formData.get("tags") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { id, name, notes, tags } = parsed.data;
  // Sem o select, um update barrado pela RLS (cliente de outra barbearia)
  // "dá certo" afetando 0 linhas.
  const { data, error } = await ctx.supabase
    .from("customers")
    .update({ name, notes, tags })
    .eq("id", id)
    .select("id");

  if (error || !data?.length) return { error: "Não foi possível salvar o cliente." };

  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${id}`);
  return { error: null, ok: Date.now() };
}

/** Usa (desconta) saldo de cashback do cliente. */
export async function spendCashback(_prev: CustomerFormState, formData: FormData): Promise<CustomerFormState> {
  const ctx = await getStaffContext();
  if (!ctx) return { error: "Sua sessão expirou. Entre de novo." };
  const id = String(formData.get("id") ?? "");
  const amount = parseMoney(String(formData.get("amount") ?? ""));
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Cliente inválido." };
  if (amount === null || amount <= 0) return { error: "Informe o valor." };

  const { data: entries } = await ctx.supabase.from("cashback_entries").select("amount").eq("customer_id", id);
  const balance = Math.round((entries ?? []).reduce((s, e) => s + Number(e.amount), 0) * 100) / 100;
  if (amount > balance) return { error: `Saldo disponível: R$ ${balance.toFixed(2).replace(".", ",")}.` };

  const { error } = await ctx.supabase.from("cashback_entries").insert({
    barbershop_id: ctx.barbershop.id,
    customer_id: id,
    amount: -amount,
    reason: "uso",
    created_by: ctx.profile.id,
  });
  if (error) return { error: "Não foi possível registrar." };
  revalidatePath(`/admin/clientes/${id}`);
  return { error: null, ok: Date.now() };
}
