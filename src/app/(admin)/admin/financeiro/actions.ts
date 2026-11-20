"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffContext } from "@/lib/auth";
import { EXPENSE_CATEGORIES, parseMoney } from "@/lib/finance";
import { isValidDateIso } from "@/lib/time";
import type { ExpenseCategory } from "@/lib/supabase/types";

/**
 * Caixa, gastos e estoque: só o dono. As policies de RLS (supabase/schema.sql)
 * também barram, mas checamos aqui para devolver uma mensagem clara.
 */
async function requireOwner() {
  const ctx = await getStaffContext();
  if (!ctx || ctx.profile.role !== "owner") return null;
  return ctx;
}

const NOT_OWNER = { error: "Apenas o dono pode mexer no financeiro." } as const;

function done() {
  revalidatePath("/admin/financeiro");
  return { success: true as const };
}

const money = z
  .string()
  .transform((v, ctx) => {
    const n = parseMoney(v);
    if (n === null) {
      ctx.addIssue({ code: "custom", message: "Valor inválido." });
      return z.NEVER;
    }
    return n;
  });

const dateIso = z.string().refine((v) => isValidDateIso(v), "Data inválida.");

// ---------------------------------------------------------------------------
// Caixa
// ---------------------------------------------------------------------------

export async function saveCashCount(day: string, counted: string, notes: string) {
  const ctx = await requireOwner();
  if (!ctx) return NOT_OWNER;
  const parsed = z.object({ day: dateIso, counted: money }).safeParse({ day, counted });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await ctx.supabase.from("cash_counts").upsert({
    barbershop_id: ctx.barbershop.id,
    day: parsed.data.day,
    counted: parsed.data.counted,
    notes: notes.trim() || null,
    counted_by: ctx.profile.id,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "Não foi possível salvar a conferência." };
  return done();
}

// ---------------------------------------------------------------------------
// Gastos
// ---------------------------------------------------------------------------

const expenseSchema = z.object({
  category: z.custom<ExpenseCategory>(
    (v) => EXPENSE_CATEGORIES.includes(v as ExpenseCategory),
    "Escolha a categoria.",
  ),
  description: z.string().trim().min(2, "Descreva o gasto.").max(120),
  amount: money,
  spentOn: dateIso,
});

export type ExpenseState = { error: string | null; ok?: number };

export async function addExpense(_prev: ExpenseState, formData: FormData): Promise<ExpenseState> {
  const ctx = await requireOwner();
  if (!ctx) return NOT_OWNER;
  const parsed = expenseSchema.safeParse({
    category: formData.get("category"),
    description: formData.get("description"),
    amount: String(formData.get("amount") ?? ""),
    spentOn: formData.get("spentOn"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await ctx.supabase.from("expenses").insert({
    barbershop_id: ctx.barbershop.id,
    category: parsed.data.category,
    description: parsed.data.description,
    amount: parsed.data.amount,
    spent_on: parsed.data.spentOn,
    created_by: ctx.profile.id,
  });
  if (error) return { error: "Não foi possível lançar o gasto." };
  revalidatePath("/admin/financeiro");
  return { error: null, ok: Date.now() };
}

export async function deleteExpense(expenseId: string) {
  const ctx = await requireOwner();
  if (!ctx) return NOT_OWNER;
  const { data, error } = await ctx.supabase.from("expenses").delete().eq("id", expenseId).select("id");
  if (error || !data?.length) return { error: "Não foi possível excluir." };
  return done();
}

// ---------------------------------------------------------------------------
// Estoque
// ---------------------------------------------------------------------------

const quantity = z
  .string()
  .transform((v, ctx) => {
    const n = parseMoney(v);
    if (n === null) {
      ctx.addIssue({ code: "custom", message: "Quantidade inválida." });
      return z.NEVER;
    }
    return n;
  });

const productSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do produto.").max(80),
  quantity,
  minQuantity: quantity,
});

export type ProductState = { error: string | null; ok?: number };

export async function addProduct(_prev: ProductState, formData: FormData): Promise<ProductState> {
  const ctx = await requireOwner();
  if (!ctx) return NOT_OWNER;
  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    quantity: String(formData.get("quantity") || "0"),
    minQuantity: String(formData.get("minQuantity") || "0"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await ctx.supabase.from("products").insert({
    barbershop_id: ctx.barbershop.id,
    name: parsed.data.name,
    quantity: parsed.data.quantity,
    min_quantity: parsed.data.minQuantity,
  });
  if (error) return { error: "Não foi possível cadastrar o produto." };
  revalidatePath("/admin/financeiro");
  return { error: null, ok: Date.now() };
}

export async function deleteProduct(productId: string) {
  const ctx = await requireOwner();
  if (!ctx) return NOT_OWNER;
  // Gastos de compras antigas continuam no financeiro (product_id vira null).
  const { data, error } = await ctx.supabase.from("products").delete().eq("id", productId).select("id");
  if (error || !data?.length) return { error: "Não foi possível excluir." };
  return done();
}

export async function registerPurchase(productId: string, qty: string, amount: string, spentOn: string) {
  const ctx = await requireOwner();
  if (!ctx) return NOT_OWNER;
  const parsed = z
    .object({ qty: quantity.refine((n) => n > 0, "Quantidade inválida."), amount: money, spentOn: dateIso })
    .safeParse({ qty, amount, spentOn });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await ctx.supabase.rpc("register_purchase", {
    p_product_id: productId,
    p_quantity: parsed.data.qty,
    p_amount: parsed.data.amount,
    p_spent_on: parsed.data.spentOn,
  });
  if (error) return { error: "Não foi possível registrar a compra." };
  return done();
}

export async function adjustStock(productId: string, delta: number) {
  const ctx = await requireOwner();
  if (!ctx) return NOT_OWNER;
  if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 10_000) {
    return { error: "Quantidade inválida." };
  }
  const { data, error } = await ctx.supabase.rpc("adjust_stock", {
    p_product_id: productId,
    p_delta: delta,
  });
  if (error || data === null) return { error: "Não foi possível atualizar o estoque." };
  return done();
}
