"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffContext } from "@/lib/auth";
import { weeklyHoursSchema } from "@/lib/hours";
import { onlyDigits } from "@/lib/format";
import { slugSchema } from "@/lib/slugs";

const settingsSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da barbearia."),
  phone: z
    .string()
    .transform(onlyDigits)
    .refine((v) => v.length === 10 || v.length === 11, "Informe o WhatsApp com DDD."),
  address: z.string().trim().max(200).transform((v) => v || null),
  slug: slugSchema,
  weeklyHours: weeklyHoursSchema,
});

export type SettingsState = { error: string | null; ok?: number };

export async function saveSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const ctx = await getStaffContext();
  if (!ctx || ctx.profile.role !== "owner") {
    return { error: "Apenas o dono pode alterar os ajustes." };
  }

  let weeklyHours: unknown;
  try {
    weeklyHours = JSON.parse(String(formData.get("weeklyHours")));
  } catch {
    return { error: "Horários inválidos." };
  }

  const parsed = settingsSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
    address: formData.get("address") ?? "",
    slug: formData.get("slug"),
    weeklyHours,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { weeklyHours: weekly_hours, ...rest } = parsed.data;
  const { error } = await ctx.supabase
    .from("barbershops")
    .update({ ...rest, weekly_hours })
    .eq("id", ctx.barbershop.id);

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Esse link já está em uso por outra barbearia. Escolha outro."
          : "Não foi possível salvar.",
    };
  }

  revalidatePath("/admin", "layout");
  revalidatePath(`/${ctx.barbershop.slug}`);
  revalidatePath(`/${parsed.data.slug}`);
  return { error: null, ok: Date.now() };
}
