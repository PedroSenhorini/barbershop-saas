import { daysSince } from "@/lib/time";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Empty, Page, PageHeader, Stat, fieldClass } from "@/components/page-ui";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireOwnerPage } from "@/lib/auth";
import { formatDaysAgo } from "@/lib/customers";
import { openDebts, type Debt } from "@/lib/debts";
import { formatCurrency } from "@/lib/format";
import { debtMessage, whatsAppLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { receiveDebt } from "./actions";

export default async function DebtsPage() {
  const { supabase, barbershop } = await requireOwnerPage();
  const debts = await openDebts(supabase);
  const { data: customers } = await supabase.from("customers").select("id, phone").limit(5000);
  const phones = new Map((customers ?? []).map((c) => [c.id, c.phone]));

  const groups = new Map<string, Debt[]>();
  for (const d of debts) {
    const key = d.customerId ?? `sem-${d.customerName}`;
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  const total = debts.reduce((s, d) => s + d.remaining, 0);
  const days = (iso: string) => daysSince(iso);
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { timeZone: barbershop.timezone, day: "2-digit", month: "2-digit" });

  return (
    <Page>
      <PageHeader title="Fiado" description="Quem levou e ficou devendo. Ao receber, o valor entra no caixa do dia." />
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Total em aberto" value={formatCurrency(total)} tone={total > 0 ? "warning" : undefined} />
        <Stat label="Clientes devendo" value={String(groups.size)} />
      </div>

      {debts.length === 0 ? (
        <Empty>Ninguém devendo. 🎉</Empty>
      ) : (
        [...groups.entries()].map(([key, items]) => {
          const owed = items.reduce((s, d) => s + d.remaining, 0);
          const first = items[0];
          const phone = first.customerId ? phones.get(first.customerId) : null;
          return (
            <section key={key} className="space-y-2 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  {first.customerId ? (
                    <Link href={`/admin/clientes/${first.customerId}`} className="font-medium hover:underline">
                      {first.customerName}
                    </Link>
                  ) : (
                    <p className="font-medium">{first.customerName}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Deve {formatCurrency(owed)} · desde {formatDaysAgo(days(first.date))}
                  </p>
                </div>
                {phone && (
                  <a
                    href={whatsAppLink(phone, debtMessage({ customerName: first.customerName, barbershopName: barbershop.name, amount: formatCurrency(owed) }))}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
                  >
                    <MessageCircle className="size-4" />
                    Cobrar
                  </a>
                )}
              </div>
              <ul className="divide-y">
                {items.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                    <span className="w-12 tabular-nums text-muted-foreground">{date(d.date)}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {d.description}
                      {d.paid > 0 ? ` (pagou ${formatCurrency(d.paid)} de ${formatCurrency(d.amount)})` : ""}
                    </span>
                    <span className="font-medium tabular-nums">{formatCurrency(d.remaining)}</span>
                    <ActionForm action={receiveDebt} submitLabel="Receber" successMessage="Recebido!" className="flex items-start gap-1.5 space-y-0" submitClassName="h-9">
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="kind" value={d.kind} />
                      <Input name="amount" inputMode="decimal" placeholder={d.remaining.toFixed(2).replace(".", ",")} aria-label="Valor recebido" className="h-9 w-24" />
                      <select name="method" required defaultValue="" aria-label="Forma de pagamento" className={cn(fieldClass, "h-9 w-28")}>
                        <option value="" disabled>
                          Como?
                        </option>
                        <option value="dinheiro">Dinheiro</option>
                        <option value="pix">Pix</option>
                        <option value="cartao">Cartão</option>
                      </select>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </Page>
  );
}
