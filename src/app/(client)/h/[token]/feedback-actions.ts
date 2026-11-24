"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Avaliação do atendimento pelo link pessoal. O token é a credencial (como
 * em respondToAppointment); só vale para atendimento finalizado, uma vez.
 */
export async function submitFeedback(
  token: string,
  rating: number,
  comment: string,
): Promise<{ error: string } | { ok: true; googleUrl: string | null }> {
  if (!/^[0-9a-f]{32}$/.test(token)) return { error: "Link inválido." };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Escolha de 1 a 5 estrelas." };

  const supabase = createAdminClient();
  const { data: appt } = await supabase
    .from("appointments")
    .select("id, status, barbershop_id, customer_id, barber_id, barbershop:barbershops(google_review_url)")
    .eq("public_token", token)
    .maybeSingle();
  if (!appt || appt.status !== "finalizado") return { error: "Só dá para avaliar depois do atendimento." };

  const { error } = await supabase.from("customer_feedback").insert({
    barbershop_id: appt.barbershop_id,
    appointment_id: appt.id,
    customer_id: appt.customer_id,
    barber_id: appt.barber_id,
    rating,
    comment: comment.trim().slice(0, 500) || null,
  });
  // 23505: já avaliou (aba aberta duas vezes); trata como sucesso.
  if (error && error.code !== "23505") return { error: "Não foi possível enviar. Tente de novo." };

  revalidatePath(`/h/${token}`);
  const shop = appt.barbershop as { google_review_url: string | null } | null;
  // Só convida para o Google quem gostou; nota baixa fica com a barbearia.
  return { ok: true, googleUrl: rating >= 4 ? (shop?.google_review_url ?? null) : null };
}
