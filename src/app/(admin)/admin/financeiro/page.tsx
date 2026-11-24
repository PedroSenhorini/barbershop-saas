import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireStaff } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import {
  EXPENSE_LABEL,
  PAYMENT_LABEL,
  PAYMENT_METHODS,
  formatMonth,
  isValidMonthIso,
  monthRange,
  paidAmount,
} from "@/lib/finance";
import {
  addDaysIso,
  dateIsoInZone,
  formatDayLong,
  formatTime,
  isValidDateIso,
  todayIso,
  zonedDateTime,
} from "@/lib/time";
import type { CashCount, CashMovement, Expense, PaymentMethod, Product } from "@/lib/supabase/types";
import { CashCountForm } from "./cash-count-form";
import { CashMovements } from "./cash-movements";
import { drawerAdjustment, extraIncome } from "./extra-income";
import { ExpenseList } from "./expenses";
import { StockList } from "./stock";

type Tab = "caixa" | "gastos" | "estoque";
const TABS: { key: Tab; label: string }[] = [
  { key: "caixa", label: "Caixa do dia" },
  { key: "gastos", label: "Gastos do mês" },
  { key: "estoque", label: "Estoque" },
];

type Finished = {
  id: string;
  scheduled_at: string;
  customer_name: string;
  barber_id: string | null;
  payment_method: PaymentMethod | null;
  amount_paid: number | null;
  service: { name: string; price: number } | null;
  barber: { full_name: string } | null;
};

type Supabase = Awaited<ReturnType<typeof requireStaff>>["supabase"];

/** Atendimentos finalizados entre dois dias (fim exclusivo), no fuso da barbearia. */
async function finishedBetween(
  supabase: Supabase,
  fromIso: string,
  toIsoExclusive: string,
  tz: string,
  barberId?: string,
) {
  let query = supabase
    .from("appointments")
    .select(
      "id, scheduled_at, customer_name, barber_id, payment_method, amount_paid, service:services(name, price), barber:users(full_name)",
    )
    .eq("status", "finalizado")
    .gte("scheduled_at", zonedDateTime(fromIso, "00:00", tz).toISOString())
    .lt("scheduled_at", zonedDateTime(toIsoExclusive, "00:00", tz).toISOString())
    .order("scheduled_at", { ascending: true });
  if (barberId) query = query.eq("barber_id", barberId);
  const { data } = await query;
  return (data ?? []) as unknown as Finished[];
}

/** Fiado e plano do Clube não são dinheiro que entrou no dia. */
function isCashIn(a: Finished) {
  return a.payment_method !== "fiado" && a.payment_method !== "plano";
}

function totalsByMethod(items: Finished[]) {
  const totals: Record<PaymentMethod | "sem", number> = { dinheiro: 0, pix: 0, cartao: 0, fiado: 0, plano: 0, sem: 0 };
  for (const a of items) totals[a.payment_method ?? "sem"] += paidAmount(a);
  return totals;
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; dia?: string; mes?: string }>;
}) {
  const { supabase, profile, barbershop } = await requireStaff();
  const params = await searchParams;
  const tz = barbershop.timezone;
  const today = todayIso(tz);
  const day = isValidDateIso(params.dia) ? params.dia : today;
  const month = isValidMonthIso(params.mes) ? params.mes : today.slice(0, 7);
  const isOwner = profile.role === "owner";

  if (!isOwner) {
    return <BarberEarnings supabase={supabase} barberId={profile.id} month={month} tz={tz} />;
  }

  const tab: Tab = TABS.some((t) => t.key === params.aba) ? (params.aba as Tab) : "caixa";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold">Financeiro</h1>
        <p className="text-sm text-muted-foreground">Entradas, gastos e estoque da barbearia.</p>
      </div>

      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/financeiro?aba=${t.key}`}
            className={cn(
              "flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition active:opacity-80 md:h-9",
              tab === t.key ? "border-primary bg-primary text-primary-foreground" : "bg-card",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "caixa" && <CashTab supabase={supabase} shopId={barbershop.id} day={day} today={today} tz={tz} />}
      {tab === "gastos" && <ExpensesTab supabase={supabase} month={month} today={today} tz={tz} />}
      {tab === "estoque" && <StockTab supabase={supabase} today={today} />}
    </div>
  );
}

// ---------------------------------------------------------------------------

async function CashTab({
  supabase,
  shopId,
  day,
  today,
  tz,
}: {
  supabase: Supabase;
  shopId: string;
  day: string;
  today: string;
  tz: string;
}) {
  const [items, { data: count }, extra, { data: movements }] = await Promise.all([
    finishedBetween(supabase, day, addDaysIso(day, 1), tz),
    supabase.from("cash_counts").select("*").eq("barbershop_id", shopId).eq("day", day).maybeSingle(),
    extraIncome(supabase, day, addDaysIso(day, 1), tz),
    supabase.from("cash_movements").select("*").eq("day", day).order("created_at"),
  ]);
  const totals = totalsByMethod(items);
  // Vendas, fiado recebido e mensalidades do Clube entram por forma de pagamento.
  for (const m of PAYMENT_METHODS) totals[m] += extra.byMethod[m];
  const total = items.filter(isCashIn).reduce((s, a) => s + paidAmount(a), 0) + extra.total;
  const drawer = (movements ?? []) as CashMovement[];

  const byBarber = new Map<string, { name: string; count: number; total: number }>();
  for (const a of items) {
    const key = a.barber_id ?? "sem";
    const row = byBarber.get(key) ?? { name: a.barber?.full_name ?? "Sem barbeiro", count: 0, total: 0 };
    row.count += 1;
    row.total += paidAmount(a);
    byBarber.set(key, row);
  }

  return (
    <div className="space-y-4">
      <PeriodNav
        label={day === today ? "Hoje" : formatDayLong(day)}
        sub={day === today ? formatDayLong(day) : undefined}
        prevHref={`/admin/financeiro?aba=caixa&dia=${addDaysIso(day, -1)}`}
        nextHref={day < today ? `/admin/financeiro?aba=caixa&dia=${addDaysIso(day, 1)}` : null}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PAYMENT_METHODS.map((m) => (
          <Stat key={m} label={PAYMENT_LABEL[m]} value={formatCurrency(totals[m])} />
        ))}
        <Stat label="Total do dia" value={formatCurrency(total)} strong />
      </div>
      {(extra.total > 0 || totals.fiado > 0 || extra.salesOnCredit > 0) && (
        <p className="text-xs text-muted-foreground">
          {[
            extra.sales > 0 && `Vendas: ${formatCurrency(extra.sales)}`,
            extra.debtsReceived > 0 && `Fiado recebido: ${formatCurrency(extra.debtsReceived)}`,
            extra.club > 0 && `Mensalidades do Clube: ${formatCurrency(extra.club)}`,
            totals.fiado + extra.salesOnCredit > 0 && `Ficou no fiado: ${formatCurrency(totals.fiado + extra.salesOnCredit)}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      {totals.sem > 0 && (
        <p className="rounded-lg bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          {formatCurrency(totals.sem)} em atendimentos finalizados sem forma de pagamento registrada.
        </p>
      )}

      <CashMovements day={day} movements={drawer} />

      <CashCountForm
        day={day}
        expected={totals.dinheiro + drawerAdjustment(drawer)}
        saved={(count as CashCount | null) ?? null}
      />

      {byBarber.size > 1 && (
        <Section title="Por barbeiro">
          <ul className="divide-y rounded-xl border bg-card">
            {[...byBarber.values()].map((b) => (
              <li key={b.name} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  {b.name}
                  <span className="text-muted-foreground"> · {b.count} atend.</span>
                </span>
                <span className="font-semibold">{formatCurrency(b.total)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Atendimentos finalizados">
        <FinishedList items={items} tz={tz} />
      </Section>
    </div>
  );
}

async function ExpensesTab({
  supabase,
  month,
  today,
  tz,
}: {
  supabase: Supabase;
  month: string;
  today: string;
  tz: string;
}) {
  const range = monthRange(month);
  const [items, { data: expenses }, extra] = await Promise.all([
    finishedBetween(supabase, range.first, `${range.next}-01`, tz),
    supabase
      .from("expenses")
      .select("*")
      .gte("spent_on", range.first)
      .lte("spent_on", range.last)
      .order("spent_on", { ascending: false })
      .order("created_at", { ascending: false }),
    extraIncome(supabase, range.first, `${range.next}-01`, tz),
  ]);
  const list = (expenses ?? []) as Expense[];
  const income = items.filter(isCashIn).reduce((s, a) => s + paidAmount(a), 0) + extra.total;
  const spent = list.reduce((s, e) => s + Number(e.amount), 0);
  const result = income - spent;

  const byCategory = new Map<string, number>();
  for (const e of list) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + Number(e.amount));
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <PeriodNav
        label={formatMonth(month)}
        prevHref={`/admin/financeiro?aba=gastos&mes=${range.prev}`}
        nextHref={month < today.slice(0, 7) ? `/admin/financeiro?aba=gastos&mes=${range.next}` : null}
      />

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Entradas" value={formatCurrency(income)} />
        <Stat label="Gastos" value={formatCurrency(spent)} />
        <Stat
          label="Resultado"
          value={formatCurrency(result)}
          strong
          tone={result < 0 ? "negative" : "positive"}
        />
      </div>

      {categories.length > 0 && (
        <Section title="Para onde foi o dinheiro">
          <ul className="space-y-2 rounded-xl border bg-card p-4">
            {categories.map(([cat, value]) => (
              <li key={cat} className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>{EXPENSE_LABEL[cat as Expense["category"]]}</span>
                  <span className="font-medium">{formatCurrency(value)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-primary"
                    style={{ width: `${Math.max(4, (value / spent) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <ExpenseList expenses={list} defaultDate={month === today.slice(0, 7) ? today : range.first} />
    </div>
  );
}

async function StockTab({ supabase, today }: { supabase: Supabase; today: string }) {
  const { data } = await supabase.from("products").select("*").order("name");
  return <StockList products={(data ?? []) as Product[]} today={today} />;
}

async function BarberEarnings({
  supabase,
  barberId,
  month,
  tz,
}: {
  supabase: Supabase;
  barberId: string;
  month: string;
  tz: string;
}) {
  const range = monthRange(month);
  const today = todayIso(tz);
  const items = await finishedBetween(supabase, range.first, `${range.next}-01`, tz, barberId);
  const totals = totalsByMethod(items);
  const total = items.reduce((s, a) => s + paidAmount(a), 0);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold">Meu faturamento</h1>
        <p className="text-sm text-muted-foreground">Seus atendimentos finalizados no mês.</p>
      </div>
      <PeriodNav
        label={formatMonth(month)}
        prevHref={`/admin/financeiro?mes=${range.prev}`}
        nextHref={month < today.slice(0, 7) ? `/admin/financeiro?mes=${range.next}` : null}
      />
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Atendimentos" value={String(items.length)} />
        <Stat label="Total" value={formatCurrency(total)} strong />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {PAYMENT_METHODS.map((m) => (
          <Stat key={m} label={PAYMENT_LABEL[m]} value={formatCurrency(totals[m])} />
        ))}
      </div>
      <Section title="Atendimentos">
        <FinishedList items={[...items].reverse()} tz={tz} showDay />
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** "2026-11-19" → "19/11". */
function dayMonth(dateIso: string) {
  return `${dateIso.slice(8, 10)}/${dateIso.slice(5, 7)}`;
}

function FinishedList({ items, tz, showDay }: { items: Finished[]; tz: string; showDay?: boolean }) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
        Nenhum atendimento finalizado.
      </p>
    );
  }
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {items.map((a) => (
        <li key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm">
          <span className="w-12 shrink-0 font-medium tabular-nums">
            {showDay ? dayMonth(dateIsoInZone(new Date(a.scheduled_at), tz)) : formatTime(a.scheduled_at, tz)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{a.customer_name}</span>
            <span className="block truncate text-muted-foreground">
              {a.service?.name ?? "Serviço"}
              {!showDay && a.barber && ` · ${a.barber.full_name.split(" ")[0]}`}
            </span>
          </span>
          <span className="text-right">
            <span className="block font-semibold">{formatCurrency(paidAmount(a))}</span>
            <span className={cn("block text-xs", a.payment_method ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400")}>
              {a.payment_method ? PAYMENT_LABEL[a.payment_method] : "Sem registro"}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function PeriodNav({
  label,
  sub,
  prevHref,
  nextHref,
}: {
  label: string;
  sub?: string;
  prevHref: string;
  nextHref: string | null;
}) {
  return (
    <div className="flex items-center gap-2">
      <Link href={prevHref} aria-label="Anterior" className={buttonVariants({ variant: "outline", size: "icon-lg" })}>
        <ChevronLeft className="size-5" />
      </Link>
      <div className="min-w-0 flex-1 text-center">
        <p className="font-semibold capitalize leading-tight">{label}</p>
        {sub && <p className="text-sm capitalize text-muted-foreground">{sub}</p>}
      </div>
      {nextHref ? (
        <Link href={nextHref} aria-label="Próximo" className={buttonVariants({ variant: "outline", size: "icon-lg" })}>
          <ChevronRight className="size-5" />
        </Link>
      ) : (
        <span className={cn(buttonVariants({ variant: "outline", size: "icon-lg" }), "pointer-events-none opacity-40")}>
          <ChevronRight className="size-5" />
        </span>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "positive" | "negative";
}) {
  return (
    <div className={cn("rounded-xl border bg-card px-3 py-2.5", strong && "border-primary/40")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "truncate text-base font-semibold",
          tone === "negative" && "text-destructive",
          tone === "positive" && "text-emerald-700 dark:text-emerald-400",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}
