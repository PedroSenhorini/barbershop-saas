import type { WaitlistPeriod, WaitlistStatus } from "@/lib/supabase/types";

export const PERIOD_LABEL: Record<WaitlistPeriod, string> = {
  qualquer: "Qualquer horário",
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

export const WAITLIST_STATUS_LABEL: Record<WaitlistStatus, string> = {
  aguardando: "Aguardando",
  avisado: "Avisado",
  agendado: "Agendou",
  desistiu: "Desistiu",
};

/** Canais sugeridos para os links com ?origem= (Divulgar e relatórios). */
export const SOURCES: { key: string; label: string }[] = [
  { key: "instagram", label: "Instagram" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "google", label: "Google" },
  { key: "facebook", label: "Facebook" },
  { key: "cartao", label: "Cartão de visita" },
  { key: "cartaz", label: "Cartaz / QR na barbearia" },
  { key: "indicacao", label: "Indicação" },
];

export function sourceLabel(key: string | null) {
  if (!key) return "Direto (sem origem)";
  return SOURCES.find((s) => s.key === key)?.label ?? key;
}

/** Normaliza ?origem= para o formato aceito no banco; inválido vira null. */
export function normalizeSource(value: unknown) {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase().slice(0, 40);
  return /^[a-z0-9_-]{1,40}$/.test(v) ? v : null;
}

export const LEAD_STATUS_LABEL: Record<"novo" | "contatado" | "virou_cliente", string> = {
  novo: "Novo",
  contatado: "Contatado",
  virou_cliente: "Virou cliente",
};
