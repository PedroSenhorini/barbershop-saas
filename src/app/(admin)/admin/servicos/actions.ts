"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffContext } from "@/lib/auth";

const serviceSchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(2, "Informe o nome do serviço."),
  description: z.string().trim().max(200).transform((v) => v || null),
  // Aceita "45", "45,90" ou "45.90".
  price: z
    .string()
    .transform((v) => {
      const s = v.trim().replace(/^R\$\s*/, "");
      return s ? Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s) : NaN;
    })
    .refine((v) => Number.isFinite(v) && v >= 0, "Preço inválido."),
  durationMinutes: z.coerce.number().int().min(5, "Duração mínima de 5 minutos.").max(480),
  active: z.boolean(),
});

export type ServiceFormState = { error: string | null; ok?: number };

export async function saveService(
  _prev: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  const ctx = await getStaffContext();
  if (!ctx || ctx.profile.role !== "owner") {
    return { error: "Apenas o dono pode alterar serviços." };
  }

  const parsed = serviceSchema.safeParse({
    id: formData.get("id") || null,
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    price: String(formData.get("price") ?? ""),
    durationMinutes: formData.get("durationMinutes"),
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { id, durationMinutes, ...rest } = parsed.data;
  const values = { ...rest, duration_minutes: durationMinutes };

  const { error } = id
    ? await ctx.supabase.from("services").update(values).eq("id", id)
    : await ctx.supabase
        .from("services")
        .insert({ ...values, barbershop_id: ctx.barbershop.id });

  if (error) return { error: "Não foi possível salvar o serviço." };

  revalidatePath("/admin/servicos");
  revalidatePath(`/${ctx.barbershop.slug}`);
  return { error: null, ok: Date.now() };
}

export async function deleteService(id: string) {
  const ctx = await getStaffContext();
  if (!ctx || ctx.profile.role !== "owner") {
    return { error: "Apenas o dono pode alterar serviços." };
  }

  const { error } = await ctx.supabase.from("services").delete().eq("id", id);
  if (error) {
    // 23503 = serviço já usado em agendamentos (FK on delete restrict).
    // Mantemos o histórico e só tiramos da página pública.
    if (error.code === "23503") {
      await ctx.supabase.from("services").update({ active: false }).eq("id", id);
      revalidatePath("/admin/servicos");
      return { hidden: true as const };
    }
    return { error: "Não foi possível excluir." };
  }

  revalidatePath("/admin/servicos");
  return { success: true as const };
}
