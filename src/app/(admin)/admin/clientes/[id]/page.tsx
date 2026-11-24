import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Crown, MessageCircle, Repeat, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { STATUS_LABEL, STATUS_STYLE } from "@/lib/appointment-status";
import { requireStaff } from "@/lib/auth";
import { customerInsight, formatDaysAgo } from "@/lib/customers";
import { PAYMENT_LABEL, paidAmount } from "@/lib/finance";
import { formatCurrency, maskPhone } from "@/lib/format";
import { getSiteUrl } from "@/lib/site-url";
import { formatTime } from "@/lib/time";
import { comeBackMessage, helloMessage, reviewRequestMessage, whatsAppLink } from "@/lib/whatsapp";
import type { AppointmentStatus, CustomerStats, PaymentMethod } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { CustomerStatusBadge } from "../status-badge";
import { ActionForm } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { openDebts } from "@/lib/debts";
import { spendCashback } from "../actions";
import { CustomerForm } from "./customer-form";

const HISTORY_LIMIT = 50;

type HistoryItem = {
  id: string;
  scheduled_at: string;
  status: AppointmentStatus;
  amount_paid: number | null;
  payment_method: PaymentMethod | null;
  service: { name: string; price: number } | null;
  barber: { full_name: string } | null;
};

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { supabase, profile, barbershop } = await requireStaff();
  const isOwner = profile.role === "owner";
  const tz = barbershop.timezone;

  // A RLS só devolve clientes da barbearia de quem está logado.
  const [{ data: customer }, { data: stats }, { data: history }, siteUrl, { data: cashback }, { data: subscription }, debts] = await Promise.all([
    supabase.from("customers").select("id, name, phone, notes, tags, created_at").eq("id", id).maybeSingle(),
    supabase.from("customer_stats").select("*").eq("customer_id", id).maybeSingle(),
    supabase
      .from("appointments")
      .select(
        "id, scheduled_at, status, amount_paid, payment_method, service:services(name, price), barber:users(full_name)",
      )
      .eq("customer_id", id)
      .order("scheduled_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    getSiteUrl(),
    supabase.from("cashback_entries").select("amount").eq("customer_id", id),
    supabase.from("club_subscriptions").select("id, price, next_due_on, plan_id").eq("customer_id", id).eq("status", "ativa").maybeSingle(),
    isOwner ? openDebts(supabase, id) : Promise.resolve([]),
  ]);

  if (!customer) notFound();

  const cashbackBalance = Math.round((cashback ?? []).reduce((sum, e) => sum + Number(e.amount), 0) * 100) / 100;
  const owed = debts.reduce((sum, d) => sum + d.remaining, 0);
  const planName = subscription
    ? ((await supabase.from("club_plans").select("name").eq("id", subscription.plan_id).maybeSingle()).data?.name ?? "Plano")
    : null;

  const s = stats as CustomerStats | null;
  const items = (history ?? []) as unknown as HistoryItem[];
  const insight = customerInsight(
    s ?? { visits: 0, first_visit_at: null, last_visit_at: null, next_appointment_at: null },
  );
  const visits = Number(s?.visits ?? 0);
  const bookingUrl = `${siteUrl}/${barbershop.slug}`;
  const message =
    insight.status === "sumido"
      ? comeBackMessage({ customerName: customer.name, barbershopName: barbershop.name, bookingUrl })
      : helloMessage(customer.name);

  const dateLabel = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", {
      timeZone: tz,
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 p-4 md:p-6">
      <Link
        href="/admin/clientes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Clientes
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-semibold">{customer.name}</h1>
            <CustomerStatusBadge status={insight.status} />
          </div>
          <p className="text-sm text-muted-foreground">{maskPhone(customer.phone)}</p>
        </div>
        <a
          href={whatsAppLink(customer.phone, message)}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants(), "h-11 gap-2")}
        >
          <MessageCircle className="size-4" />
          {insight.status === "sumido" ? "Chamar de volta" : "WhatsApp"}
        </a>
      </div>

      {insight.status === "sumido" && insight.daysSinceLastVisit !== null && (
        <p className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200">
          Última visita {formatDaysAgo(insight.daysSinceLastVisit)}
          {insight.averageIntervalDays
            ? `, mas costuma vir a cada ${insight.averageIntervalDays} dias`
            : ""}
          . O botão acima abre o WhatsApp com uma mensagem pronta e o link para agendar.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Visitas" value={String(visits)} />
        <Stat
          label="Última visita"
          value={insight.daysSinceLastVisit === null ? "—" : formatDaysAgo(insight.daysSinceLastVisit)}
        />
        <Stat
          label="Costuma vir"
          value={insight.averageIntervalDays ? `a cada ${insight.averageIntervalDays} dias` : "—"}
        />
        <Stat
          label="Próximo horário"
          value={
            s?.next_appointment_at
              ? `${dateLabel(s.next_appointment_at)} ${formatTime(s.next_appointment_at, tz)}`
              : "—"
          }
        />
        <Stat label="Faltas" value={String(Number(s?.no_shows ?? 0))} />
        {isOwner && <Stat label="Total gasto" value={formatCurrency(Number(s?.total_spent ?? 0))} />}
      </div>

      {(subscription || owed > 0 || cashbackBalance > 0 || Number(barbershop.cashback_percent) > 0) && (
        <div className="grid gap-2 sm:grid-cols-3">
          {subscription && (
            <Link href="/admin/clube" className="rounded-xl border border-primary/40 bg-card px-3 py-2.5 transition hover:border-primary">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Crown className="size-3.5" /> Clube
              </p>
              <p className="truncate font-semibold">{planName}</p>
              <p className="text-xs text-muted-foreground">
                vence {subscription.next_due_on.split("-").reverse().slice(0, 2).join("/")}
              </p>
            </Link>
          )}
          {owed > 0 && (
            <Link href="/admin/fiado" className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2.5 text-amber-900 dark:text-amber-200">
              <p className="text-xs">Fiado em aberto</p>
              <p className="font-semibold">{formatCurrency(owed)}</p>
            </Link>
          )}
          {(cashbackBalance > 0 || Number(barbershop.cashback_percent) > 0) && (
            <div className="space-y-2 rounded-xl border bg-card px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Saldo de cashback</p>
              <p className="font-semibold">{formatCurrency(cashbackBalance)}</p>
              {cashbackBalance > 0 && (
                <ActionForm action={spendCashback} submitLabel="Usar" successMessage="Cashback descontado!" resetOnSuccess className="flex items-start gap-1.5 space-y-0" submitClassName="h-9" submitVariant="outline">
                  <input type="hidden" name="id" value={customer.id} />
                  <Input name="amount" inputMode="decimal" placeholder="Valor" aria-label="Valor a usar" className="h-9 w-24" />
                </ActionForm>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href={`/admin/horarios-fixos?cliente=${customer.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}>
          <Repeat className="size-4" />
          Horário fixo
        </Link>
        {barbershop.google_review_url && (
          <a
            href={whatsAppLink(customer.phone, reviewRequestMessage({ customerName: customer.name, barbershopName: barbershop.name, reviewUrl: barbershop.google_review_url }))}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <Star className="size-4" />
            Pedir avaliação no Google
          </a>
        )}
      </div>

      <CustomerForm customer={customer} />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Histórico</h2>
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum agendamento ainda.
          </p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {items.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <div className="w-20 shrink-0 tabular-nums">
                  <p className="font-medium">{dateLabel(a.scheduled_at)}</p>
                  <p className="text-xs text-muted-foreground">{formatTime(a.scheduled_at, tz)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.service?.name ?? "Serviço removido"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.barber?.full_name ?? "Sem barbeiro"}
                    {a.status === "finalizado" && a.payment_method
                      ? ` · ${PAYMENT_LABEL[a.payment_method]}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge className={cn("h-6", STATUS_STYLE[a.status])}>{STATUS_LABEL[a.status]}</Badge>
                  {isOwner && a.status === "finalizado" && (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatCurrency(paidAmount(a))}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {items.length === HISTORY_LIMIT && (
          <p className="text-xs text-muted-foreground">Mostrando os {HISTORY_LIMIT} mais recentes.</p>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-base font-semibold">{value}</p>
    </div>
  );
}
