"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { bookAppointment, computeAvailability, type Slot } from "@/lib/availability";
import { onlyDigits } from "@/lib/format";
import { isValidDateIso } from "@/lib/time";
import { verifyTurnstile } from "@/lib/turnstile";

/**
 * Fluxo público de agendamento. Tudo passa pela service role porque a tabela
 * `appointments` não tem policy de RLS para anônimos — ver supabase/schema.sql.
 */

export async function getSlots(
  barbershopId: string,
  serviceId: string,
  barberId: string | null,
  dateIso: string,
): Promise<{ slots: Slot[] } | { error: string }> {
  if (!isValidDateIso(dateIso)) return { error: "Data inválida." };

  const supabase = createAdminClient();
  const [{ data: barbershop }, { data: service }] = await Promise.all([
    supabase
      .from("barbershops")
      .select("id, timezone, weekly_hours, active")
      .eq("id", barbershopId)
      .single(),
    supabase
      .from("services")
      .select("duration_minutes, barbershop_id, active")
      .eq("id", serviceId)
      .single(),
  ]);

  if (!barbershop || !service || service.barbershop_id !== barbershop.id || !service.active) {
    return { error: "Serviço não encontrado." };
  }
  if (!barbershop.active) return { slots: [] };

  const slots = await computeAvailability({ barbershop, service, barberId, dateIso });
  return { slots };
}

const createAppointmentSchema = z.object({
  barbershopId: z.string().uuid(),
  serviceId: z.string().uuid(),
  barberId: z.string().uuid().nullable(),
  scheduledAt: z.string().datetime(),
  customerName: z.string().trim().min(2, "Informe seu nome."),
  customerPhone: z
    .string()
    .transform(onlyDigits)
    .refine((v) => v.length === 10 || v.length === 11, "Informe um WhatsApp com DDD."),
});

export type CreateAppointmentInput = z.input<typeof createAppointmentSchema> & {
  /** Campo-isca (ver components/anti-spam.tsx). */
  website?: string;
  turnstileToken?: string | null;
};

export async function createAppointment(
  input: CreateAppointmentInput,
): Promise<{ success: true; barberId: string; publicToken: string } | { error: string }> {
  // Robô: finge sucesso e não grava nada. Sem token, a tela de sucesso não
  // mostra o link de acompanhamento.
  if (input.website) return { success: true, barberId: input.barberId ?? "", publicToken: "" };

  const parsed = createAppointmentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  if (!(await verifyTurnstile(input.turnstileToken))) {
    return { error: "Não conseguimos confirmar que você não é um robô. Tente de novo." };
  }

  const result = await bookAppointment({ ...parsed.data, status: "solicitado" });
  if ("error" in result) return result;
  return { success: true, barberId: result.barberId, publicToken: result.publicToken };
}
