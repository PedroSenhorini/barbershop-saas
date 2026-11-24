"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/action-form";
import { staffAction, text } from "@/lib/action-utils";

export async function saveLoyaltySettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const { error, ctx } = await staffAction(true);
  if (!ctx) return { error };

  const cashback = Number((text(formData, "cashback") || "0").replace(",", "."));
  if (!Number.isFinite(cashback) || cashback < 0 || cashback > 50) return { error: "Cashback entre 0% e 50%." };

  const google = text(formData, "google");
  if (google && !/^https:\/\/\S+$/.test(google)) return { error: "O link do Google precisa começar com https://" };

  const pixel = text(formData, "pixel").replace(/\D/g, "");
  if (pixel && (pixel.length < 5 || pixel.length > 20)) return { error: "ID do pixel inválido (só números)." };

  const instagram = text(formData, "instagram").replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "");
  if (instagram && !/^[A-Za-z0-9._]{1,30}$/.test(instagram)) return { error: "Usuário do Instagram inválido." };

  const about = text(formData, "about").slice(0, 600);

  const { data } = await ctx.supabase
    .from("barbershops")
    .update({
      cashback_percent: Math.round(cashback * 100) / 100,
      google_review_url: google || null,
      meta_pixel_id: pixel || null,
      instagram: instagram || null,
      about: about || null,
    })
    .eq("id", ctx.barbershop.id)
    .select("id");
  if (!data?.length) return { error: "Não foi possível salvar." };

  revalidatePath("/admin/fidelidade");
  revalidatePath(`/${ctx.barbershop.slug}`);
  return { error: null, ok: Date.now() };
}
