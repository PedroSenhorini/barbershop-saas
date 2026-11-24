import Link from "next/link";
import { Star } from "lucide-react";
import { Empty, List, Page, PageHeader, Section, Stat } from "@/components/page-ui";
import { requireStaff } from "@/lib/auth";
import type { CustomerFeedback } from "@/lib/supabase/types";

export default async function ReviewsPage() {
  const { supabase, barbershop } = await requireStaff();
  const [{ data }, { data: staff }, { data: customers }] = await Promise.all([
    supabase.from("customer_feedback").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("users").select("id, full_name"),
    supabase.from("customers").select("id, name").limit(5000),
  ]);
  const list = (data ?? []) as CustomerFeedback[];
  const names = new Map((staff ?? []).map((s) => [s.id, s.full_name]));
  const customerNames = new Map((customers ?? []).map((c) => [c.id, c.name]));
  const avg = list.length ? list.reduce((s, f) => s + f.rating, 0) / list.length : 0;
  const promoters = list.filter((f) => f.rating >= 4).length;

  const byBarber = new Map<string, { sum: number; n: number }>();
  for (const f of list) {
    if (!f.barber_id) continue;
    const b = byBarber.get(f.barber_id) ?? { sum: 0, n: 0 };
    b.sum += f.rating;
    b.n += 1;
    byBarber.set(f.barber_id, b);
  }

  return (
    <Page>
      <PageHeader
        title="Avaliações"
        description={
          <>
            Depois de finalizado, o link pessoal do cliente pede uma nota. Quem dá 4 ou 5 é convidado a avaliar no Google
            {barbershop.google_review_url ? "" : " (cadastre o link em Fidelidade e marketing)"}; nota baixa fica só aqui.
          </>
        }
      />
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Nota média" value={list.length ? avg.toFixed(1).replace(".", ",") : "—"} />
        <Stat label="Avaliações" value={String(list.length)} />
        <Stat label="Notas 4 e 5" value={list.length ? `${Math.round((promoters / list.length) * 100)}%` : "—"} tone="positive" />
      </div>

      {byBarber.size > 0 && (
        <Section title="Por profissional">
          <List>
            {[...byBarber.entries()].map(([id, b]) => (
              <li key={id} className="flex justify-between px-4 py-3 text-sm">
                <span>{names.get(id) ?? "Removido"}</span>
                <span className="font-medium">
                  {(b.sum / b.n).toFixed(1).replace(".", ",")} ★ <span className="text-muted-foreground">({b.n})</span>
                </span>
              </li>
            ))}
          </List>
        </Section>
      )}

      <Section title="Últimas">
        {list.length === 0 ? (
          <Empty>Nenhuma avaliação ainda.</Empty>
        ) : (
          <List>
            {list.map((f) => (
              <li key={f.id} className="space-y-1 px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={n <= f.rating ? "size-4 fill-amber-400 text-amber-400" : "size-4 text-muted-foreground/40"} />
                    ))}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(f.created_at).toLocaleDateString("pt-BR", { timeZone: barbershop.timezone })}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  {f.customer_id ? (
                    <Link href={`/admin/clientes/${f.customer_id}`} className="hover:underline">
                      {customerNames.get(f.customer_id) ?? "Cliente"}
                    </Link>
                  ) : (
                    "Cliente"
                  )}
                  {f.barber_id ? ` · com ${names.get(f.barber_id) ?? ""}` : ""}
                </p>
                {f.comment && <p>“{f.comment}”</p>}
              </li>
            ))}
          </List>
        )}
      </Section>
    </Page>
  );
}
