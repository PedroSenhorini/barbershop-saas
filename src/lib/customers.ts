import type { CustomerStats } from "@/lib/supabase/types";

/**
 * Situação de um cliente, para a lista "novos e sumidos".
 *
 * - `sem_visita`: tem cadastro (agendou), mas nenhum atendimento finalizado.
 * - `novo`: primeira visita há pouco tempo.
 * - `sumido`: passou bem do tempo em que costuma voltar e não tem horário
 *   marcado. O prazo vem da frequência do próprio cliente, não de um número
 *   fixo: quem corta toda semana some antes de quem vem a cada dois meses.
 * - `ativo`: o resto.
 */
export type CustomerStatus = "novo" | "ativo" | "sumido" | "sem_visita";

export const CUSTOMER_STATUS_LABEL: Record<CustomerStatus, string> = {
  novo: "Novo",
  ativo: "Ativo",
  sumido: "Sumido",
  sem_visita: "Sem visita",
};

/** Primeira visita dentro desta janela conta como cliente novo. */
export const NEW_CUSTOMER_DAYS = 30;
/** Intervalo suposto para quem só veio uma vez. */
export const DEFAULT_INTERVAL_DAYS = 30;
/** Ninguém é "sumido" com menos de 3 semanas sem vir. */
export const MIN_GONE_DAYS = 21;
/** Teto da frequência, para um cliente esporádico não ficar "ativo" para sempre. */
export const MAX_INTERVAL_DAYS = 120;
/** Sumido = passou 50% do tempo em que costuma voltar. */
const GONE_FACTOR = 1.5;

const DAY_MS = 86_400_000;

export type CustomerInsight = {
  status: CustomerStatus;
  /** Dias desde a última visita (null sem visita). */
  daysSinceLastVisit: number | null;
  /** De quantos em quantos dias o cliente costuma vir (média das visitas). */
  averageIntervalDays: number | null;
  /** Quando deveria voltar, pela frequência (null sem visita). */
  expectedReturnAt: Date | null;
  /** Dias de atraso em relação à volta esperada (0 se não está atrasado). */
  daysOverdue: number;
};

type StatsInput = Pick<
  CustomerStats,
  "visits" | "first_visit_at" | "last_visit_at" | "next_appointment_at"
>;

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

export function customerInsight(stats: StatsInput, now: Date = new Date()): CustomerInsight {
  const visits = Number(stats.visits) || 0;
  if (visits === 0 || !stats.last_visit_at || !stats.first_visit_at) {
    return {
      status: "sem_visita",
      daysSinceLastVisit: null,
      averageIntervalDays: null,
      expectedReturnAt: null,
      daysOverdue: 0,
    };
  }

  const first = new Date(stats.first_visit_at);
  const last = new Date(stats.last_visit_at);
  const daysSinceLastVisit = Math.max(0, daysBetween(last, now));

  // Média entre a primeira e a última visita. Duas visitas no mesmo dia não
  // podem virar "frequência de 0 dias".
  const averageIntervalDays =
    visits >= 2 ? Math.max(1, Math.round(daysBetween(first, last) / (visits - 1))) : null;
  const interval = Math.min(averageIntervalDays ?? DEFAULT_INTERVAL_DAYS, MAX_INTERVAL_DAYS);

  const expectedReturnAt = new Date(last.getTime() + interval * DAY_MS);
  const daysOverdue = Math.max(0, daysBetween(expectedReturnAt, now));

  const hasNext = Boolean(stats.next_appointment_at);
  const goneAfter = Math.max(MIN_GONE_DAYS, Math.round(interval * GONE_FACTOR));

  let status: CustomerStatus;
  if (!hasNext && daysSinceLastVisit > goneAfter) status = "sumido";
  else if (daysBetween(first, now) <= NEW_CUSTOMER_DAYS) status = "novo";
  else status = "ativo";

  return { status, daysSinceLastVisit, averageIntervalDays, expectedReturnAt, daysOverdue };
}

/** "hoje", "ontem", "há 5 dias", "há 3 meses". */
export function formatDaysAgo(days: number) {
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 60) return `há ${days} dias`;
  const months = Math.round(days / 30);
  if (months < 24) return `há ${months} meses`;
  return `há ${Math.round(days / 365)} anos`;
}

/** Busca sem acento e sem diferenciar maiúsculas; telefone pelos dígitos. */
export function matchesCustomerSearch(
  customer: { name: string; phone: string },
  query: string,
) {
  const q = normalize(query.trim());
  if (!q) return true;
  const digits = query.replace(/\D/g, "");
  if (digits.length >= 3 && customer.phone.includes(digits)) return true;
  return normalize(customer.name).includes(q);
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
