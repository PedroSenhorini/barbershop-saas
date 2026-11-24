"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/action-form";
import { optionalText, staffAction, text, uuidOrNull } from "@/lib/action-utils";
import { addDaysIso, isValidDateIso, zonedDateTime } from "@/lib/time";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function createBlock(_prev: FormState, formData: FormData): Promise<FormState> {
  const { error, ctx } = await staffAction();
  if (!ctx) return { error };
  const isOwner = ctx.profile.role === "owner";
  const tz = ctx.barbershop.timezone;

  // Barbeiro só bloqueia a própria agenda.
  const barberField = text(formData, "barberId");
  const barberId = isOwner ? (barberField === "todos" ? null : uuidOrNull(formData, "barberId")) : ctx.profile.id;
  if (isOwner && barberField !== "todos" && !barberId) return { error: "Escolha de quem é o bloqueio." };

  const startDate = text(formData, "startDate");
  const endDate = text(formData, "endDate") || startDate;
  const startTime = text(formData, "startTime");
  const endTime = text(formData, "endTime");
  if (!isValidDateIso(startDate) || !isValidDateIso(endDate)) return { error: "Data inválida." };
  if ((startTime && !TIME_RE.test(startTime)) || (endTime && !TIME_RE.test(endTime))) {
    return { error: "Horário inválido." };
  }

  // Sem horário = dia inteiro (da meia-noite do início à meia-noite após o fim).
  const startsAt = zonedDateTime(startDate, startTime || "00:00", tz);
  const endsAt = endTime ? zonedDateTime(endDate, endTime, tz) : zonedDateTime(addDaysIso(endDate, 1), "00:00", tz);
  if (endsAt <= startsAt) return { error: "O fim precisa ser depois do início." };
  if (endsAt.getTime() - startsAt.getTime() > 90 * 86_400_000) return { error: "Bloqueio de no máximo 90 dias." };

  const { error: dbError } = await ctx.supabase.from("time_blocks").insert({
    barbershop_id: ctx.barbershop.id,
    barber_id: barberId,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    reason: optionalText(formData, "reason", 80),
    created_by: ctx.profile.id,
  });
  if (dbError) return { error: "Não foi possível salvar o bloqueio." };

  revalidatePath("/admin/bloqueios");
  revalidatePath("/admin/semana");
  return { error: null, ok: Date.now() };
}

export async function deleteBlock(_prev: FormState, formData: FormData): Promise<FormState> {
  const { error, ctx } = await staffAction();
  if (!ctx) return { error };
  const id = uuidOrNull(formData, "id");
  if (!id) return { error: "Bloqueio inválido." };
  // RLS: barbeiro só apaga os próprios bloqueios.
  const { data } = await ctx.supabase.from("time_blocks").delete().eq("id", id).select("id");
  if (!data?.length) return { error: "Não foi possível remover." };
  revalidatePath("/admin/bloqueios");
  revalidatePath("/admin/semana");
  return { error: null, ok: Date.now() };
}
