"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/auth";
import { bookAppointment, computeAvailability, type Slot } from "@/lib/availability";
import { onlyDigits } from "@/lib/format";
import { isValidDateIso } from "@/lib/time";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const statusSchema = z.enum([
  "solicitado",
  "confirmado",
  "a_caminho",
  "em_andamento",
  "finalizado",
  "cancelado",
  "faltou",
]);

export async function updateAppointmentStatus(appointmentId: string, status: string) {
  const parsedStatus = statusSchema.safeParse(status);
  if (!parsedStatus.success) return { error: "Status inválido." };

  const supabase = await createClient();
  // RLS garante que só agendamentos da própria barbearia são alterados.
  const { data, error } = await supabase
    .from("appointments")
    .update({ status: parsedStatus.data })
    .eq("id", appointmentId)
    .select("id");

  if (error || !data?.length) {
    return {
      error:
        error?.code === "23P01"
          ? "Esse horário já foi ocupado por outro agendamento."
          : "Não foi possível atualizar o agendamento.",
    };
  }

  revalidatePath("/admin");
  return { success: true as const };
}

export async function getPanelSlots(
  serviceId: string,
  barberId: string | null,
  dateIso: string,
): Promise<{ slots: Slot[] } | { error: string }> {
  const ctx = await getStaffContext();
  if (!ctx) return { error: "Sessão expirada. Entre de novo." };
  if (!isValidDateIso(dateIso)) return { error: "Data inválida." };

  const { data: service } = await ctx.supabase
    .from("services")
    .select("duration_minutes")
    .eq("id", serviceId)
    .eq("barbershop_id", ctx.barbershop.id)
    .single();
  if (!service) return { error: "Serviço não encontrado." };

  const slots = await computeAvailability({
    barbershop: ctx.barbershop,
    service,
    barberId,
    dateIso,
    includePast: true,
  });
  return { slots };
}

const manualSchema = z.object({
  serviceId: z.string().uuid(),
  barberId: z.string().uuid().nullable(),
  scheduledAt: z.string().datetime(),
  customerName: z.string().trim().min(2, "Informe o nome do cliente."),
  customerPhone: z
    .string()
    .transform(onlyDigits)
    .refine((v) => v.length === 0 || v.length === 10 || v.length === 11, "Telefone inválido."),
});

/** Encaixe/agendamento feito pelo próprio barbeiro (cliente ligou ou chegou). */
export async function createManualAppointment(input: z.input<typeof manualSchema>) {
  const ctx = await getStaffContext();
  if (!ctx) return { error: "Sessão expirada. Entre de novo." };

  const parsed = manualSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const result = await bookAppointment({
    ...parsed.data,
    barbershopId: ctx.barbershop.id,
    status: "confirmado",
    fromPanel: true,
  });
  if ("error" in result) return result;

  revalidatePath("/admin");
  return { success: true as const };
}
