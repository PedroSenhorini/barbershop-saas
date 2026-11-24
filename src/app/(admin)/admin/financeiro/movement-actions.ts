"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/action-form";
import { money, optionalText, staffAction, text, uuidOrNull } from "@/lib/action-utils";
import { isValidDateIso } from "@/lib/time";
import type { CashMovementKind } from "@/lib/supabase/types";

const KINDS: CashMovementKind[] = ["abertura", "sangria", "suprimento"];

export async function addCashMovement(_prev: FormState, formData: FormData): Promise<FormState> {
  const { error, ctx } = await staffAction(true);
  if (!ctx) return { error };
  const day = text(formData, "day");
  const kind = text(formData, "kind") as CashMovementKind;
  const amount = money(formData, "amount");
  if (!isValidDateIso(day) || !KINDS.includes(kind)) return { error: "Dados inválidos." };
  if (amount === null || amount <= 0) return { error: "Informe o valor." };

  const { error: dbError } = await ctx.supabase.from("cash_movements").insert({
    barbershop_id: ctx.barbershop.id,
    day,
    kind,
    amount,
    notes: optionalText(formData, "notes", 120),
    created_by: ctx.profile.id,
  });
  if (dbError) return { error: "Não foi possível registrar." };
  revalidatePath("/admin/financeiro");
  return { error: null, ok: Date.now() };
}

export async function deleteCashMovement(_prev: FormState, formData: FormData): Promise<FormState> {
  const { error, ctx } = await staffAction(true);
  if (!ctx) return { error };
  const id = uuidOrNull(formData, "id");
  if (!id) return { error: "Movimento inválido." };
  const { data } = await ctx.supabase.from("cash_movements").delete().eq("id", id).select("id");
  if (!data?.length) return { error: "Não foi possível remover." };
  revalidatePath("/admin/financeiro");
  return { error: null, ok: Date.now() };
}
