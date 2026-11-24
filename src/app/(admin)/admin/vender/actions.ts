"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { staffAction, uuidOrNull } from "@/lib/action-utils";

const saleSchema = z.object({
  items: z
    .array(
      z.union([
        z.object({ productId: z.string().uuid(), quantity: z.number().positive().max(999) }),
        z.object({
          description: z.string().trim().min(1, "Descreva o item avulso.").max(120),
          quantity: z.number().positive().max(999),
          unitPrice: z.number().min(0).max(100_000),
        }),
      ]),
    )
    .min(1, "Adicione pelo menos um item."),
  paymentMethod: z.enum(["dinheiro", "pix", "cartao", "fiado"]),
  discount: z.number().min(0).max(100_000),
  customerId: z.string().uuid().nullable(),
  appointmentId: z.string().uuid().nullable(),
  sellerId: z.string().uuid().nullable(),
});

export type SaleInput = z.input<typeof saleSchema>;

export async function registerSale(input: SaleInput): Promise<{ error: string } | { ok: true }> {
  const { error, ctx } = await staffAction();
  if (!ctx) return { error };
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  // Barbeiro vende em nome próprio; o dono escolhe o vendedor.
  const sellerId = ctx.profile.role === "owner" ? (d.sellerId ?? ctx.profile.id) : ctx.profile.id;

  // Comanda: sem cliente escolhido, usa o cliente do atendimento.
  let customerId = d.customerId;
  if (!customerId && d.appointmentId) {
    const { data } = await ctx.supabase.from("appointments").select("customer_id").eq("id", d.appointmentId).maybeSingle();
    customerId = data?.customer_id ?? null;
  }
  if (d.paymentMethod === "fiado" && !customerId) return { error: "Para vender fiado, escolha o cliente." };

  const { error: dbError } = await ctx.supabase.rpc("register_sale", {
    p_items: d.items.map((i) =>
      "productId" in i
        ? { product_id: i.productId, quantity: i.quantity }
        : { product_id: null, description: i.description, quantity: i.quantity, unit_price: i.unitPrice },
    ),
    p_payment_method: d.paymentMethod,
    p_discount: d.discount,
    p_customer_id: customerId,
    p_appointment_id: d.appointmentId,
    p_seller_id: sellerId,
  });
  if (dbError) {
    const known = ["Desconto inválido", "Produto sem preço de venda", "Fiado precisa de cliente"].find((m) =>
      dbError.message.includes(m),
    );
    return { error: known ? `${known}.` : "Não foi possível registrar a venda." };
  }

  revalidatePath("/admin/vender");
  revalidatePath("/admin/financeiro");
  return { ok: true };
}

export async function deleteSale(_prev: FormState, formData: FormData): Promise<FormState> {
  const { error, ctx } = await staffAction(true);
  if (!ctx) return { error };
  const id = uuidOrNull(formData, "id");
  if (!id) return { error: "Venda inválida." };
  // Não devolve ao estoque automaticamente: o dono ajusta em Estoque se precisar.
  const { data } = await ctx.supabase.from("sales").delete().eq("id", id).select("id");
  if (!data?.length) return { error: "Não foi possível excluir." };
  revalidatePath("/admin/vender");
  revalidatePath("/admin/financeiro");
  return { error: null, ok: Date.now() };
}
