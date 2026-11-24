import { paidAmount } from "@/lib/finance";
import { hoursForDate } from "@/lib/hours";
import type { PaymentMethod, WeeklyHours } from "@/lib/supabase/types";
import { addDaysIso, toMinutes } from "@/lib/time";

/**
 * Contas da tela Relatórios. Tudo puro (sem banco) para dar para testar: a
 * página busca as linhas e passa para cá.
 */

/** Os `count` meses terminando em `lastMonth` ("AAAA-MM"), do mais antigo ao mais novo. */
export function lastMonths(lastMonth: string, count: number) {
  const [y, m] = lastMonth.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (count - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export type FinishedRow = {
  /** Mês do atendimento no fuso da barbearia ("AAAA-MM"). */
  month: string;
  payment_method: PaymentMethod | null;
  amount_paid: number | null;
  service: { id: string; name: string; price: number } | null;
};

export type MonthRevenue = { month: string; services: number; products: number; club: number; total: number };

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Faturamento por mês: serviços feitos (inclui fiado, que é venda; o atendimento
 * pelo plano do Clube não entra, porque o Clube já entra pela mensalidade),
 * produtos vendidos e mensalidades do Clube recebidas.
 */
export function revenueByMonth(
  months: string[],
  finished: FinishedRow[],
  sales: { month: string; total: number }[],
  clubPayments: { month: string; amount: number }[],
): MonthRevenue[] {
  const rows = new Map(months.map((m) => [m, { month: m, services: 0, products: 0, club: 0, total: 0 }]));
  for (const a of finished) {
    const r = rows.get(a.month);
    if (r && a.payment_method !== "plano") r.services += paidAmount(a);
  }
  for (const s of sales) {
    const r = rows.get(s.month);
    if (r) r.products += Number(s.total);
  }
  for (const p of clubPayments) {
    const r = rows.get(p.month);
    if (r) r.club += Number(p.amount);
  }
  return [...rows.values()].map((r) => ({
    month: r.month,
    services: round(r.services),
    products: round(r.products),
    club: round(r.club),
    total: round(r.services + r.products + r.club),
  }));
}

export type ServiceStat = { name: string; count: number; revenue: number };

/** Serviços feitos no mês, do mais feito para o menos feito. */
export function topServices(finished: FinishedRow[]): ServiceStat[] {
  const map = new Map<string, ServiceStat>();
  for (const a of finished) {
    if (!a.service) continue;
    const s = map.get(a.service.id) ?? { name: a.service.name, count: 0, revenue: 0 };
    s.count++;
    if (a.payment_method !== "plano") s.revenue += paidAmount(a);
    map.set(a.service.id, s);
  }
  return [...map.values()]
    .map((s) => ({ ...s, revenue: round(s.revenue) }))
    .sort((a, b) => b.count - a.count || b.revenue - a.revenue);
}

/** Agendamentos por origem (?origem=). null = painel ou link sem origem. */
export function countBySource(rows: { source: string | null }[]) {
  const map = new Map<string | null, number>();
  for (const r of rows) map.set(r.source, (map.get(r.source) ?? 0) + 1);
  return [...map.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

/** Minutos em que a barbearia fica aberta num dia (sem o intervalo). */
export function openMinutes(weeklyHours: WeeklyHours, dateIso: string) {
  const day = hoursForDate(weeklyHours, dateIso);
  if (!day) return 0;
  let minutes = toMinutes(day.close) - toMinutes(day.open);
  if (day.breakStart && day.breakEnd) minutes -= toMinutes(day.breakEnd) - toMinutes(day.breakStart);
  return Math.max(0, minutes);
}

/**
 * Capacidade do período em minutos: horas abertas de cada dia × barbeiros que
 * atendem. Não desconta bloqueios (folgas), então a ocupação real é um pouco
 * maior do que a mostrada.
 */
export function capacityMinutes(weeklyHours: WeeklyHours, fromIso: string, toIsoInclusive: string, barbers: number) {
  let total = 0;
  for (let d = fromIso; d <= toIsoInclusive; d = addDaysIso(d, 1)) total += openMinutes(weeklyHours, d);
  return total * Math.max(0, barbers);
}

/** Ocupação em % (0–100, inteiro). */
export function occupancyPercent(bookedMinutes: number, capacity: number) {
  if (capacity <= 0) return 0;
  return Math.min(100, Math.round((bookedMinutes / capacity) * 100));
}
