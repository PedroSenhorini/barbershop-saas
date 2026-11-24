"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/action-form";
import { staffAction, text, uuidOrNull } from "@/lib/action-utils";
import { bookAppointment } from "@/lib/availability";
import { seriesDates } from "@/lib/recurring";
import { isValidDateIso, zonedDateTime } from "@/lib/time";

export async function createSeries(_prev: FormState, formData: FormData): Promise<FormState> {
  const { error, ctx } = await staffAction();
  if (!ctx) return { error };

  const customerId = uuidOrNull(formData, "customerId");
  const serviceId = uuidOrNull(formData, "serviceId");
  const barberId = uuidOrNull(formData, "barberId");
  const firstDate = text(formData, "firstDate");
  const time = text(formData, "time");
  const everyWeeks = Number(text(formData, "everyWeeks"));
  const count = Number(text(formData, "count"));
  if (!customerId || !serviceId || !barberId) return { error: "Escolha cliente, serviço e barbeiro." };
  if (!isValidDateIso(firstDate) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Data ou horário inválido." };
  if (!Number.isFinite(everyWeeks) || !Number.isFinite(count)) return { error: "Frequência inválida." };

  // A RLS garante que o cliente é da barbearia de quem está logado.
  const { data: customer } = await ctx.supabase
    .from("customers")
    .select("name, phone")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) return { error: "Cliente não encontrado." };

  const seriesId = crypto.randomUUID();
  const tz = ctx.barbershop.timezone;
  const created: string[] = [];
  const skipped: string[] = [];

  // Uma por vez: cada agendamento confere a agenda já com os anteriores.
  for (const date of seriesDates(firstDate, everyWeeks, count)) {
    const result = await bookAppointment({
      barbershopId: ctx.barbershop.id,
      serviceId,
      barberId,
      scheduledAt: zonedDateTime(date, time, tz).toISOString(),
      customerName: customer.name,
      customerPhone: customer.phone,
      status: "confirmado",
      fromPanel: true,
      seriesId,
    });
    if ("error" in result) skipped.push(date.split("-").reverse().slice(0, 2).join("/"));
    else created.push(date);
  }

  if (created.length === 0) {
    return { error: "Nenhum horário livre nessas datas. Confira o horário e o expediente do barbeiro." };
  }

  revalidatePath("/admin/horarios-fixos");
  revalidatePath("/admin");
  revalidatePath("/admin/semana");
  return {
    error: null,
    ok: Date.now(),
    notice:
      skipped.length > 0
        ? `${created.length} horários marcados. Ocupados, ficaram de fora: ${skipped.join(", ")}.`
        : `${created.length} horários marcados!`,
  };
}

export async function cancelSeries(_prev: FormState, formData: FormData): Promise<FormState> {
  const { error, ctx } = await staffAction();
  if (!ctx) return { error };
  const seriesId = uuidOrNull(formData, "seriesId");
  if (!seriesId) return { error: "Série inválida." };

  const { data, error: dbError } = await ctx.supabase
    .from("appointments")
    .update({ status: "cancelado" })
    .eq("series_id", seriesId)
    .gt("scheduled_at", new Date().toISOString())
    .in("status", ["solicitado", "confirmado"])
    .select("id");
  if (dbError) return { error: "Não foi possível cancelar." };

  revalidatePath("/admin/horarios-fixos");
  revalidatePath("/admin");
  return { error: null, ok: Date.now(), notice: `${data?.length ?? 0} horários futuros cancelados.` };
}
