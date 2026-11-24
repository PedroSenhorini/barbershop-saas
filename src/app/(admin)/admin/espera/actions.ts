"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/action-form";
import { optionalText, staffAction, text, uuidOrNull } from "@/lib/action-utils";
import { onlyDigits } from "@/lib/format";
import { isValidDateIso } from "@/lib/time";
import type { WaitlistPeriod, WaitlistStatus } from "@/lib/supabase/types";

const PERIODS: WaitlistPeriod[] = ["qualquer", "manha", "tarde", "noite"];
const STATUSES: WaitlistStatus[] = ["aguardando", "avisado", "agendado", "desistiu"];

export async function addToWaitlist(_prev: FormState, formData: FormData): Promise<FormState> {
  const { error, ctx } = await staffAction();
  if (!ctx) return { error };
  const name = text(formData, "name");
  const phone = onlyDigits(text(formData, "phone"));
  const period = text(formData, "period") as WaitlistPeriod;
  const date = text(formData, "date");
  if (name.length < 2) return { error: "Informe o nome." };
  if (phone.length < 10 || phone.length > 11) return { error: "Informe um WhatsApp com DDD." };

  const { error: dbError } = await ctx.supabase.from("waitlist_entries").insert({
    barbershop_id: ctx.barbershop.id,
    customer_name: name.slice(0, 120),
    customer_phone: phone,
    service_id: uuidOrNull(formData, "serviceId"),
    barber_id: uuidOrNull(formData, "barberId"),
    preferred_date: isValidDateIso(date) ? date : null,
    preferred_period: PERIODS.includes(period) ? period : "qualquer",
    notes: optionalText(formData, "notes", 500),
  });
  if (dbError) return { error: "Não foi possível salvar." };
  revalidatePath("/admin/espera");
  return { error: null, ok: Date.now() };
}

export async function setWaitlistStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const { error, ctx } = await staffAction();
  if (!ctx) return { error };
  const id = uuidOrNull(formData, "id");
  const status = text(formData, "status") as WaitlistStatus;
  if (!id || !STATUSES.includes(status)) return { error: "Dados inválidos." };

  const { data } = await ctx.supabase
    .from("waitlist_entries")
    .update({ status, ...(status === "avisado" ? { notified_at: new Date().toISOString() } : {}) })
    .eq("id", id)
    .select("id");
  if (!data?.length) return { error: "Não foi possível atualizar." };
  revalidatePath("/admin/espera");
  return { error: null, ok: Date.now() };
}
