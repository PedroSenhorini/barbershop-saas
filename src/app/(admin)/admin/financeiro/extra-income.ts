import type { requireStaff } from "@/lib/auth";
import type { CashMethod, CashMovement } from "@/lib/supabase/types";
import { zonedDateTime } from "@/lib/time";

type Supabase = Awaited<ReturnType<typeof requireStaff>>["supabase"];

export type ExtraIncome = {
  byMethod: Record<CashMethod, number>;
  sales: number;
  /** Vendas no fiado (não entram no caixa até serem pagas). */
  salesOnCredit: number;
  debtsReceived: number;
  club: number;
  total: number;
};

/**
 * Dinheiro que entra fora dos atendimentos: vendas, fiado recebido e
 * mensalidades do Clube, entre dois dias (fim exclusivo) no fuso da barbearia.
 */
export async function extraIncome(
  supabase: Supabase,
  fromIso: string,
  toIsoExclusive: string,
  tz: string,
): Promise<ExtraIncome> {
  const from = zonedDateTime(fromIso, "00:00", tz).toISOString();
  const to = zonedDateTime(toIsoExclusive, "00:00", tz).toISOString();
  const [{ data: sales }, { data: debts }, { data: club }] = await Promise.all([
    supabase.from("sales").select("payment_method, total").gte("created_at", from).lt("created_at", to).limit(10000),
    supabase.from("debt_payments").select("payment_method, amount").gte("paid_on", fromIso).lt("paid_on", toIsoExclusive).limit(10000),
    supabase.from("club_payments").select("payment_method, amount").gte("paid_on", fromIso).lt("paid_on", toIsoExclusive).limit(10000),
  ]);

  const byMethod: Record<CashMethod, number> = { dinheiro: 0, pix: 0, cartao: 0 };
  let salesTotal = 0;
  let salesOnCredit = 0;
  for (const s of sales ?? []) {
    if (s.payment_method === "fiado") salesOnCredit += Number(s.total);
    else {
      byMethod[s.payment_method] += Number(s.total);
      salesTotal += Number(s.total);
    }
  }
  let debtsReceived = 0;
  for (const d of debts ?? []) {
    byMethod[d.payment_method] += Number(d.amount);
    debtsReceived += Number(d.amount);
  }
  let clubTotal = 0;
  for (const c of club ?? []) {
    byMethod[c.payment_method] += Number(c.amount);
    clubTotal += Number(c.amount);
  }
  return {
    byMethod,
    sales: salesTotal,
    salesOnCredit,
    debtsReceived,
    club: clubTotal,
    total: salesTotal + debtsReceived + clubTotal,
  };
}

/** Troco inicial + reforços − retiradas: o que deve sobrar na gaveta além das entradas em dinheiro. */
export function drawerAdjustment(movements: Pick<CashMovement, "kind" | "amount">[]) {
  return movements.reduce(
    (s, m) => s + (m.kind === "sangria" ? -Number(m.amount) : Number(m.amount)),
    0,
  );
}
