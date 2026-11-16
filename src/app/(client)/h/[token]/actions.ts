"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { dateIsoInZone } from "@/lib/time";
import type { AppointmentStatus } from "@/lib/supabase/types";

/**
 * Respostas do cliente pelo link pessoal (/h/<token>). Sem login: o token é a
 * credencial, então cada ação só vale a partir dos status que fazem sentido
 * e o update é condicionado ao status lido (evita corrida com o painel).
 */

const tokenSchema = z.string().regex(/^[0-9a-f]{32}$/);
const actionSchema = z.enum(["confirmar", "a_caminho", "cancelar"]);
export type CustomerAction = z.infer<typeof actionSchema>;

const CANCELLABLE: AppointmentStatus[] = ["solicitado", "confirmado", "a_caminho"];

export async function respondToAppointment(
  token: string,
  action: CustomerAction,
): Promise<{ success: true } | { error: string }> {
  const parsedToken = tokenSchema.safeParse(token);
  const parsedAction = actionSchema.safeParse(action);
  if (!parsedToken.success || !parsedAction.success) return { error: "Link inválido." };

  const admin = createAdminClient();
  const { data: appt } = await admin
    .from("appointments")
    .select("id, status, scheduled_at, ends_at, customer_confirmed_at, barbershop:barbershops(timezone)")
    .eq("public_token", parsedToken.data)
    .single();
  if (!appt) return { error: "Agendamento não encontrado." };

  const now = new Date();
  const startsAt = new Date(appt.scheduled_at);
  const endsAt = new Date(appt.ends_at);
  const timezone = (appt.barbershop as { timezone: string } | null)?.timezone ?? "America/Sao_Paulo";

  let update: { status?: AppointmentStatus; customer_confirmed_at?: string };
  switch (parsedAction.data) {
    case "confirmar":
      if (appt.status !== "confirmado" || now >= startsAt) {
        return { error: "Não dá mais para confirmar este horário." };
      }
      update = { customer_confirmed_at: now.toISOString() };
      break;
    case "a_caminho":
      // Só no dia do horário: "a caminho" na véspera não ajuda ninguém.
      if (
        appt.status !== "confirmado" ||
        now >= endsAt ||
        dateIsoInZone(now, timezone) !== dateIsoInZone(startsAt, timezone)
      ) {
        return { error: "Você pode avisar que está a caminho no dia do horário." };
      }
      update = {
        status: "a_caminho",
        customer_confirmed_at: appt.customer_confirmed_at ?? now.toISOString(),
      };
      break;
    case "cancelar":
      if (!CANCELLABLE.includes(appt.status) || now >= startsAt) {
        return { error: "Este horário não pode mais ser cancelado por aqui. Fale com a barbearia." };
      }
      update = { status: "cancelado" };
      break;
  }

  const { data, error } = await admin
    .from("appointments")
    .update(update)
    .eq("id", appt.id)
    .eq("status", appt.status)
    .select("id");
  if (error || !data?.length) {
    return { error: "Não foi possível atualizar. Recarregue a página e tente de novo." };
  }

  revalidatePath(`/h/${parsedToken.data}`);
  return { success: true };
}
