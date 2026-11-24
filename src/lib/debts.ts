import type { requireStaff } from "@/lib/auth";

type Supabase = Awaited<ReturnType<typeof requireStaff>>["supabase"];

export type Debt = {
  kind: "appointment" | "sale";
  id: string;
  customerId: string | null;
  customerName: string;
  date: string;
  description: string;
  amount: number;
  paid: number;
  remaining: number;
};

/**
 * Fiados em aberto: atendimentos finalizados e vendas marcados como "fiado",
 * menos o que já foi quitado em debt_payments. Só o dono enxerga (RLS).
 */
export async function openDebts(supabase: Supabase, customerId?: string): Promise<Debt[]> {
  let appts = supabase
    .from("appointments")
    .select("id, customer_id, customer_name, scheduled_at, amount_paid, service:services(name, price)")
    .eq("status", "finalizado")
    .eq("payment_method", "fiado");
  let sales = supabase.from("sales").select("id, customer_id, created_at, total").eq("payment_method", "fiado");
  if (customerId) {
    appts = appts.eq("customer_id", customerId);
    sales = sales.eq("customer_id", customerId);
  }

  const [{ data: a }, { data: s }, { data: payments }, { data: customers }] = await Promise.all([
    appts.limit(1000),
    sales.limit(1000),
    supabase.from("debt_payments").select("appointment_id, sale_id, amount").limit(5000),
    supabase.from("customers").select("id, name").limit(5000),
  ]);

  const paidBy = new Map<string, number>();
  for (const p of payments ?? []) {
    const key = p.appointment_id ?? p.sale_id!;
    paidBy.set(key, (paidBy.get(key) ?? 0) + Number(p.amount));
  }
  const names = new Map((customers ?? []).map((c) => [c.id, c.name]));

  type ApptRow = {
    id: string;
    customer_id: string | null;
    customer_name: string;
    scheduled_at: string;
    amount_paid: number | null;
    service: { name: string; price: number } | null;
  };

  const debts: Debt[] = [
    ...((a ?? []) as unknown as ApptRow[]).map((x) => {
      const amount = Number(x.amount_paid ?? x.service?.price ?? 0);
      return {
        kind: "appointment" as const,
        id: x.id,
        customerId: x.customer_id,
        customerName: x.customer_name,
        date: x.scheduled_at,
        description: x.service?.name ?? "Atendimento",
        amount,
        paid: paidBy.get(x.id) ?? 0,
        remaining: 0,
      };
    }),
    ...(s ?? []).map((x) => ({
      kind: "sale" as const,
      id: x.id,
      customerId: x.customer_id,
      customerName: (x.customer_id && names.get(x.customer_id)) || "Cliente",
      date: x.created_at,
      description: "Venda no balcão",
      amount: Number(x.total),
      paid: paidBy.get(x.id) ?? 0,
      remaining: 0,
    })),
  ];

  return debts
    .map((d) => ({ ...d, remaining: Math.round((d.amount - d.paid) * 100) / 100 }))
    .filter((d) => d.remaining > 0)
    .sort((x, y) => x.date.localeCompare(y.date));
}
