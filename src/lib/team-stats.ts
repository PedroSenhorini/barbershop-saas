import { fetchAll } from "@/lib/customer-data";
import { monthRange, paidAmount } from "@/lib/finance";
import type { requireStaff } from "@/lib/auth";
import type { PaymentMethod } from "@/lib/supabase/types";
import { addDaysIso, zonedDateTime } from "@/lib/time";

type Supabase = Awaited<ReturnType<typeof requireStaff>>["supabase"];

export type BarberMonth = {
  barberId: string;
  /** Atendimentos finalizados no mês (inclui os do Clube). */
  services: number;
  /** Receita de serviços (o que foi cobrado; plano do Clube conta 0). */
  serviceRevenue: number;
  /** Atendimentos pelo plano do Clube e os minutos que tomaram. */
  planServices: number;
  planMinutes: number;
  productRevenue: number;
  /** Clientes distintos atendidos. */
  customers: number;
  noShows: number;
};

/** Pura: comissão de um profissional, arredondada a centavos. */
export function commissionFor(
  m: Pick<BarberMonth, "serviceRevenue" | "productRevenue">,
  servicePercent: number,
  productPercent: number,
) {
  const value = (m.serviceRevenue * servicePercent + m.productRevenue * productPercent) / 100;
  return Math.round(value * 100) / 100;
}

/**
 * Pura: dos clientes atendidos no mês, quantos já tinham vindo antes (primeira
 * visita antes do início do mês) e quantos eram novos.
 */
export function returningSplit(customerIds: string[], firstVisitAt: Map<string, string | null>, monthStartMs: number) {
  let returning = 0;
  for (const id of customerIds) {
    const first = firstVisitAt.get(id);
    if (first && Date.parse(first) < monthStartMs) returning++;
  }
  return { returning, newcomers: customerIds.length - returning };
}

/** Pura: ticket médio por atendimento pago (sem os do Clube). */
export function averageTicket(m: Pick<BarberMonth, "services" | "planServices" | "serviceRevenue" | "productRevenue">) {
  const paid = m.services - m.planServices;
  return paid > 0 ? Math.round(((m.serviceRevenue + m.productRevenue) / paid) * 100) / 100 : 0;
}

type Row = {
  barber_id: string | null;
  customer_id: string | null;
  status: string;
  payment_method: PaymentMethod | null;
  amount_paid: number | null;
  scheduled_at: string;
  ends_at: string;
  service: { price: number } | null;
};

/** Números do mês por profissional. Sob RLS: o barbeiro vê só as próprias vendas. */
export async function monthByBarber(supabase: Supabase, monthIso: string, tz: string) {
  const { first, last } = monthRange(monthIso);
  const from = zonedDateTime(first, "00:00", tz).toISOString();
  const to = zonedDateTime(addDaysIso(last, 1), "00:00", tz).toISOString();

  // O Supabase devolve no máximo 1000 linhas por consulta (.limit maior não
  // adianta): fetchAll pagina, senão um mês movimentado sairia cortado.
  const [appts, sales] = await Promise.all([
    fetchAll<Row>((rangeFrom, rangeTo) =>
      supabase
        .from("appointments")
        .select("barber_id, customer_id, status, payment_method, amount_paid, scheduled_at, ends_at, service:services(price)")
        .in("status", ["finalizado", "faltou"])
        .gte("scheduled_at", from)
        .lt("scheduled_at", to)
        .order("id")
        .range(rangeFrom, rangeTo) as unknown as PromiseLike<{ data: Row[] | null }>,
    ),
    fetchAll<{ seller_id: string | null; total: number }>((rangeFrom, rangeTo) =>
      supabase
        .from("sales")
        .select("seller_id, total")
        .gte("created_at", from)
        .lt("created_at", to)
        .order("id")
        .range(rangeFrom, rangeTo),
    ),
  ]);

  const map = new Map<string, BarberMonth & { customerSet: Set<string> }>();
  const get = (id: string) => {
    let m = map.get(id);
    if (!m) {
      m = {
        barberId: id,
        services: 0,
        serviceRevenue: 0,
        planServices: 0,
        planMinutes: 0,
        productRevenue: 0,
        customers: 0,
        noShows: 0,
        customerSet: new Set(),
      };
      map.set(id, m);
    }
    return m;
  };

  for (const a of appts) {
    if (!a.barber_id) continue;
    const m = get(a.barber_id);
    if (a.status === "faltou") {
      m.noShows++;
      continue;
    }
    m.services++;
    if (a.customer_id) m.customerSet.add(a.customer_id);
    if (a.payment_method === "plano") {
      m.planServices++;
      m.planMinutes += Math.max(0, (new Date(a.ends_at).getTime() - new Date(a.scheduled_at).getTime()) / 60_000);
    } else {
      m.serviceRevenue += paidAmount(a);
    }
  }
  for (const s of sales) {
    if (s.seller_id) get(s.seller_id).productRevenue += Number(s.total);
  }

  return [...map.values()].map(({ customerSet, ...m }) => ({
    ...m,
    serviceRevenue: Math.round(m.serviceRevenue * 100) / 100,
    productRevenue: Math.round(m.productRevenue * 100) / 100,
    customers: customerSet.size,
    /** Quem foi atendido no mês (para separar clientes novos de recorrentes). */
    customerIds: [...customerSet],
  }));
}
