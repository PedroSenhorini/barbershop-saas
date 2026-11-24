import type { requireStaff } from "@/lib/auth";
import { customerInsight, type CustomerInsight } from "@/lib/customers";
import type { Customer, CustomerStats } from "@/lib/supabase/types";

type Supabase = Awaited<ReturnType<typeof requireStaff>>["supabase"];

/** O Supabase devolve no máximo 1000 linhas por consulta. */
const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>) {
  const rows: T[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data } = await page(i * PAGE_SIZE, (i + 1) * PAGE_SIZE - 1);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

export type CustomerRow = {
  customer: Pick<Customer, "id" | "name" | "phone" | "tags" | "last_contacted_at">;
  stats: CustomerStats | null;
  insight: CustomerInsight;
};

/** Todos os clientes com os números e a situação (novo, ativo, sumido...). */
export async function loadCustomerRows(supabase: Supabase, now = new Date()): Promise<CustomerRow[]> {
  const [customers, stats] = await Promise.all([
    fetchAll<CustomerRow["customer"]>((from, to) =>
      supabase.from("customers").select("id, name, phone, tags, last_contacted_at").order("id").range(from, to),
    ),
    fetchAll<CustomerStats>((from, to) =>
      supabase.from("customer_stats").select("*").order("customer_id").range(from, to),
    ),
  ]);
  const byId = new Map(stats.map((s) => [s.customer_id, s]));
  return customers.map((customer) => {
    const s = byId.get(customer.id) ?? null;
    return {
      customer,
      stats: s,
      insight: customerInsight(
        s ?? { visits: 0, first_visit_at: null, last_visit_at: null, next_appointment_at: null },
        now,
      ),
    };
  });
}
