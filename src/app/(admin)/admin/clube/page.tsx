import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { ActionButton, ActionForm } from "@/components/action-form";
import { Card, Empty, Page, PageHeader, Section, Stat, fieldClass } from "@/components/page-ui";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireStaff } from "@/lib/auth";
import { dueStatus, minusOneMonth, splitPot } from "@/lib/club";
import { formatCurrency } from "@/lib/format";
import { monthByBarber } from "@/lib/team-stats";
import { todayIso, zonedDateTime } from "@/lib/time";
import { clubDueMessage, whatsAppLink } from "@/lib/whatsapp";
import type { ClubPlan, ClubSubscription } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { cancelSubscription, payClub, subscribe } from "./actions";

const DUE_STYLE = {
  em_dia: "text-muted-foreground",
  vence_logo: "text-amber-700 dark:text-amber-400",
  vencido: "text-destructive font-medium",
} as const;

export default async function ClubPage() {
  const { supabase, profile, barbershop } = await requireStaff();
  const isOwner = profile.role === "owner";
  const tz = barbershop.timezone;
  const today = todayIso(tz);
  const month = today.slice(0, 7);

  const [{ data: subs }, { data: plans }, { data: customers }, { data: payments }, stats, { data: staff }] = await Promise.all([
    supabase.from("club_subscriptions").select("*").eq("status", "ativa").order("next_due_on"),
    supabase.from("club_plans").select("*").order("price"),
    supabase.from("customers").select("id, name, phone").order("name").limit(5000),
    supabase.from("club_payments").select("amount, paid_on").gte("paid_on", `${month}-01`).lte("paid_on", today),
    monthByBarber(supabase, month, tz),
    supabase.from("users").select("id, full_name"),
  ]);

  const active = (subs ?? []) as ClubSubscription[];
  const planById = new Map(((plans ?? []) as ClubPlan[]).map((p) => [p.id, p]));
  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));
  const staffName = new Map((staff ?? []).map((s) => [s.id, s.full_name]));
  const mrr = active.reduce((s, x) => s + Number(x.price), 0);
  const received = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const overdue = active.filter((s) => dueStatus(s.next_due_on, today) === "vencido");

  // Uso no ciclo atual: atendimentos pelo plano desde o último vencimento pago.
  const oldestCycle = active.reduce((min, s) => (minusOneMonth(s.next_due_on) < min ? minusOneMonth(s.next_due_on) : min), today);
  const { data: planAppts } = await supabase
    .from("appointments")
    .select("customer_id, scheduled_at")
    .eq("payment_method", "plano")
    .eq("status", "finalizado")
    .gte("scheduled_at", zonedDateTime(oldestCycle, "00:00", tz).toISOString())
    .limit(5000);
  const usage = (s: ClubSubscription) => {
    const from = zonedDateTime(minusOneMonth(s.next_due_on), "00:00", tz).getTime();
    return (planAppts ?? []).filter((a) => a.customer_id === s.customer_id && new Date(a.scheduled_at).getTime() >= from).length;
  };

  const pot = splitPot(received, Object.fromEntries(stats.map((m) => [m.barberId, m.planMinutes])));
  const subscribed = new Set(active.map((s) => s.customer_id));
  const sellable = ((plans ?? []) as ClubPlan[]).filter((p) => p.active);
  const fmtDate = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

  return (
    <Page>
      <PageHeader
        title="Clube"
        description="Assinaturas mensais dos clientes. Cobrança manual: registre o pagamento quando receber (Pix, dinheiro ou cartão) e o vencimento anda um mês."
        action={
          isOwner ? (
            <Link href="/admin/clube/planos" className={cn(buttonVariants({ variant: "outline" }), "h-10")}>
              Planos
            </Link>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Assinantes" value={String(active.length)} />
        <Stat label="Receita mensal (MRR)" value={formatCurrency(mrr)} hint="soma dos planos ativos" />
        <Stat label="Recebido no mês" value={formatCurrency(received)} tone="positive" />
        <Stat label="Vencidos" value={String(overdue.length)} tone={overdue.length ? "negative" : undefined} />
      </div>

      <Section title="Assinantes">
        {active.length === 0 ? (
          <Empty>{sellable.length === 0 ? "Crie um plano em Planos para começar a vender." : "Nenhum assinante ainda."}</Empty>
        ) : (
          <div className="space-y-2">
            {active.map((s) => {
              const c = customerById.get(s.customer_id);
              const plan = planById.get(s.plan_id);
              const status = dueStatus(s.next_due_on, today);
              const used = usage(s);
              return (
                <Card key={s.id} className="space-y-2 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <Link href={`/admin/clientes/${s.customer_id}`} className="font-medium hover:underline">
                        {c?.name ?? "Cliente"}
                      </Link>
                      <p className="text-muted-foreground">
                        {plan?.name ?? "Plano"} · {formatCurrency(Number(s.price))}/mês · usou {used}
                        {plan?.uses_per_month ? ` de ${plan.uses_per_month}` : ""} neste ciclo
                      </p>
                      <p className={DUE_STYLE[status]}>
                        {status === "vencido" ? "Venceu" : "Vence"} em {fmtDate(s.next_due_on)}
                      </p>
                    </div>
                    {c && status !== "em_dia" && (
                      <a
                        href={whatsAppLink(
                          c.phone,
                          clubDueMessage({
                            customerName: c.name,
                            barbershopName: barbershop.name,
                            planName: plan?.name ?? "",
                            amount: formatCurrency(Number(s.price)),
                            dueLabel: fmtDate(s.next_due_on),
                            overdue: status === "vencido",
                          }),
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
                      >
                        <MessageCircle className="size-4" />
                        Cobrar
                      </a>
                    )}
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    <ActionForm action={payClub} submitLabel="Registrar pagamento" successMessage="Pago!" className="flex flex-wrap items-start gap-1.5 space-y-0" submitClassName="h-9">
                      <input type="hidden" name="id" value={s.id} />
                      <Input name="amount" inputMode="decimal" defaultValue={String(s.price).replace(".", ",")} aria-label="Valor" className="h-9 w-24" />
                      <select name="method" required defaultValue="" aria-label="Forma de pagamento" className={cn(fieldClass, "h-9 w-28")}>
                        <option value="" disabled>
                          Como?
                        </option>
                        <option value="pix">Pix</option>
                        <option value="dinheiro">Dinheiro</option>
                        <option value="cartao">Cartão</option>
                      </select>
                    </ActionForm>
                    <ActionButton action={cancelSubscription} fields={{ id: s.id }} variant="ghost" confirm="Cancelar esta assinatura?" successMessage="Assinatura cancelada.">
                      Cancelar
                    </ActionButton>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Section>

      {sellable.length > 0 && (
        <Section title="Nova assinatura">
          <Card>
            <ActionForm action={subscribe} submitLabel="Assinar" successMessage="Assinatura criada!" resetOnSuccess>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-3">
                  <Label htmlFor="customerId">Cliente</Label>
                  <select id="customerId" name="customerId" required defaultValue="" className={fieldClass}>
                    <option value="" disabled>
                      Escolha o cliente
                    </option>
                    {(customers ?? [])
                      .filter((c) => !subscribed.has(c.id))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="planId">Plano</Label>
                  <select id="planId" name="planId" required defaultValue="" className={fieldClass}>
                    <option value="" disabled>
                      Escolha o plano
                    </option>
                    {sellable.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {formatCurrency(Number(p.price))}/mês
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="firstDue">1º vencimento</Label>
                  <Input id="firstDue" name="firstDue" type="date" defaultValue={today} className="h-11" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Depois de assinar, registre o primeiro pagamento acima. Ao finalizar um atendimento deste cliente, escolha
                “Plano do Clube”.
              </p>
            </ActionForm>
          </Card>
        </Section>
      )}

      {isOwner && Object.keys(pot).length > 0 && (
        <Section title="Repasse do mês (pote por tempo)">
          <p className="text-sm text-muted-foreground">
            O recebido em mensalidades ({formatCurrency(received)}) dividido pelos minutos que cada um atendeu pelo plano.
          </p>
          <ul className="divide-y rounded-xl border bg-card">
            {Object.entries(pot).map(([id, value]) => {
              const m = stats.find((x) => x.barberId === id);
              return (
                <li key={id} className="flex justify-between px-4 py-3 text-sm">
                  <span>
                    {staffName.get(id) ?? "Profissional"}
                    <span className="text-muted-foreground"> · {m?.planServices ?? 0} atend. · {Math.round(m?.planMinutes ?? 0)} min</span>
                  </span>
                  <span className="font-semibold">{formatCurrency(value)}</span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </Page>
  );
}
