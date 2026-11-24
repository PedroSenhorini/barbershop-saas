"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/action-form";
import { money, staffAction, text, uuidOrNull } from "@/lib/action-utils";

function refresh() {
  revalidatePath("/admin/produtos");
  revalidatePath("/admin/vender");
  revalidatePath("/admin/financeiro");
}

export async function setSalePrice(_prev: FormState, formData: FormData): Promise<FormState> {
  const { error, ctx } = await staffAction(true);
  if (!ctx) return { error };
  const id = uuidOrNull(formData, "id");
  if (!id) return { error: "Produto inválido." };
  const raw = text(formData, "salePrice");
  const price = raw ? money(formData, "salePrice") : null;
  if (raw && price === null) return { error: "Preço inválido." };

  const { data } = await ctx.supabase.from("products").update({ sale_price: price }).eq("id", id).select("id");
  if (!data?.length) return { error: "Não foi possível salvar." };
  refresh();
  return { error: null, ok: Date.now() };
}

export async function createProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const { error, ctx } = await staffAction(true);
  if (!ctx) return { error };
  const name = text(formData, "name");
  const price = money(formData, "salePrice");
  const quantity = Number(text(formData, "quantity") || "0");
  const minQuantity = Number(text(formData, "minQuantity") || "0");
  if (name.length < 2) return { error: "Informe o nome do produto." };
  if (text(formData, "salePrice") && price === null) return { error: "Preço inválido." };
  if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(minQuantity) || minQuantity < 0) {
    return { error: "Quantidade inválida." };
  }

  const { error: dbError } = await ctx.supabase.from("products").insert({
    barbershop_id: ctx.barbershop.id,
    name: name.slice(0, 80),
    sale_price: price,
    quantity,
    min_quantity: minQuantity,
  });
  if (dbError) return { error: "Não foi possível criar o produto." };
  refresh();
  return { error: null, ok: Date.now() };
}
