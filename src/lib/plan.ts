import type { Barbershop } from "@/lib/supabase/types";

/** Nomes dos planos do sistema (coluna barbershops.plan). Preços ficam fora do app: cobrança manual. */
export const PLAN_LABEL: Record<Barbershop["plan"], string> = {
  teste: "Período de teste",
  ativo: "Plano ativo",
  individual: "Individual",
  duo: "Duo",
  time: "Time",
  premium: "Premium",
};

/** Dias que faltam do teste (arredondado para cima); 0 = termina hoje; negativo = já acabou; null = sem teste. */
export function trialDaysLeft(
  shop: Pick<Barbershop, "plan" | "trial_ends_at">,
  now: number = Date.now(),
): number | null {
  if (shop.plan !== "teste" || !shop.trial_ends_at) return null;
  return Math.ceil((Date.parse(shop.trial_ends_at) - now) / 86_400_000);
}

/** Texto curto do aviso de teste, ou null quando não há o que avisar. */
export function trialNotice(daysLeft: number | null) {
  if (daysLeft === null) return null;
  if (daysLeft < 0) return "Seu período de teste terminou.";
  if (daysLeft === 0) return "Seu período de teste termina hoje.";
  if (daysLeft === 1) return "Seu período de teste termina amanhã.";
  return `Seu período de teste termina em ${daysLeft} dias.`;
}

/** WhatsApp do suporte (NEXT_PUBLIC_SUPPORT_WHATSAPP, só dígitos com DDD), se configurado. */
export function supportWhatsApp() {
  const digits = (process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
}
