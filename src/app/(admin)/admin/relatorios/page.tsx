import { BarRow } from "@/components/bar-row";
import { MonthSwitcher } from "@/components/month-switcher";
import { Empty, List, Page, PageHeader, Section, Stat } from "@/components/page-ui";
import { requireOwnerPage } from "@/lib/auth";
import { fetchAll } from "@/lib/customer-data";
import { formatMonth, isValidMonthIso, monthRange } from "@/lib/finance";
import { formatCurrency } from "@/lib/format";
import { sourceLabel } from "@/lib/labels";
import {
  capacityMinutes,
  countBySource,
  lastMonths,
  occupancyPercent,
  revenueByMonth,
  topServices,
  type FinishedRow,
} from "@/lib/reports";
import type { PaymentMethod } from "@/lib/supabase/types";
import { addDaysIso, dateIsoInZone, todayIso, zonedDateTime } from "@/lib/time";

type ApptRow = {
  scheduled_at: string;
  ends_at: string;
  status: string;
  source: string | null;
  payment_method: PaymentMethod | null;
  amount_paid: number | null;
  service: { id: string; name: string; price: number } | null;
};

/** Os números do negócio: faturamento, serviços, origem dos clientes e ocupação. */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { supabase, barbershop } = await requireOwnerPage();
  const tz = barbershop.timezone;
  const today = todayIso(tz);
  const current = today.slice(0, 7);
  const { mes } = await searchParams;
  const month = isValidMonthIso(mes) && mes <= current ? mes : current;

  const months = lastMonths(month, 6);
  const rangeFrom = `${months[0]}-01`;
  const { first, last } = monthRange(month);
  const fromTs = zonedDateTime(rangeFrom, "00:00", tz).toISOString();
  const toTs = zonedDateTime(addDaysIso(last, 1), "00:00", tz).toISOString();
  const monthFromMs = zonedDateTime(first, "00:00", tz).getTime();

  // O Supabase devolve no máximo 1000 linhas por consulta: fetchAll pagina.
  const [appts, sales, clubPayments, { count: barberCount }] = await Promise.all([
    fetchAll<ApptRow>((from, to) =>
      supabase
        .from("appointments")
        .select("scheduled_at, ends_at, status, source, payment_method, amount_paid, service:services(id, name, price)")
        .neq("status", "cancelado")
        .gte("scheduled_at", fromTs)
        .lt("scheduled_at", toTs)
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: ApptRow[] | null }>,
    ),
    fetchAll<{ created_at: string; total: number }>((from, to) =>
      supabase.from("sales").select("created_at, total").gte("created_at", fromTs).lt("created_at", toTs).order("id").range(from, to),
    ),
    fetchAll<{ paid_on: string; amount: number }>((from, to) =>
      supabase.from("club_payments").select("paid_on, amount").gte("paid_on", rangeFrom).lte("paid_on", last).order("id").range(from, to),
    ),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .eq("takes_appointments", true),
  ]);

  const monthOf = (iso: string) => dateIsoInZone(new Date(iso), tz).slice(0, 7);
  const rows = appts;
  const finished: FinishedRow[] = rows
    .filter((a) => a.status === "finalizado")
    .map((a) => ({ ...a, month: monthOf(a.scheduled_at) }));

  const revenue = revenueByMonth(
    months,
    finished,
    sales.map((s) => ({ month: monthOf(s.created_at), total: Number(s.total) })),
    clubPayments.map((p) => ({ month: p.paid_on.slice(0, 7), amount: Number(p.amount) })),
  );
  const thisMonth = revenue[revenue.length - 1];
  const previous = revenue[revenue.length - 2];
  const maxRevenue = Math.max(...revenue.map((r) => r.total));

  // Compara em ms: o banco devolve "+00:00" e o JS "Z"; como texto, a ordem erra.
  const monthRows = rows.filter((a) => Date.parse(a.scheduled_at) >= monthFromMs);
  const monthFinished = finished.filter((a) => a.month === month);
  const services = topServices(monthFinished);
  const sources = countBySource(monthRows.filter((a) => a.status !== "faltou"));
  const noShows = monthRows.filter((a) => a.status === "faltou").length;

  // Mês atual: ocupação só até hoje, para não comparar com dias que ainda vão vir.
  const capacityEnd = month === current ? today : last;
  const capacityEndMs = zonedDateTime(addDaysIso(capacityEnd, 1), "00:00", tz).getTime();
  const booked = monthRows
    .filter((a) => Date.parse(a.scheduled_at) < capacityEndMs)
    .reduce((s, a) => s + Math.max(0, (Date.parse(a.ends_at) - Date.parse(a.scheduled_at)) / 60_000), 0);
  const occupancy = occupancyPercent(booked, capacityMinutes(barbershop.weekly_hours, first, capacityEnd, barberCount ?? 0));

  const paidServices = monthFinished.filter((a) => a.payment_method !== "plano").length;
  const ticket = paidServices > 0 ? thisMonth.services / paidServices : 0;
  const growth = previous && previous.total > 0 ? Math.round(((thisMonth.total - previous.total) / previous.total) * 100) : null;

  return (
    <Page>
      <PageHeader
        title="Relatórios"
        description="Faturamento, serviços, de onde vêm os clientes e quanto da agenda está ocupada."
        action={<MonthSwitcher path="/admin/relatorios" month={month} current={current} />}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="Faturamento"
          value={formatCurrency(thisMonth.total)}
          hint={growth === null ? undefined : `${growth >= 0 ? "+" : ""}${growth}% vs. mês anterior`}
          tone={growth === null ? undefined : growth >= 0 ? "positive" : "negative"}
        />
        <Stat label="Atendimentos" value={String(monthFinished.length)} hint={noShows ? `${noShows} falta(s)` : undefined} />
        <Stat label="Ticket médio" value={formatCurrency(ticket)} hint="por serviço pago" />
        <Stat
          label="Ocupação"
          value={`${occupancy}%`}
          hint={month === current ? "até hoje" : "do mês"}
          tone={occupancy >= 70 ? "positive" : occupancy < 35 ? "warning" : undefined}
        />
      </div>

      <Section title="Faturamento dos últimos 6 meses">
        <List>
          {revenue.map((r) => (
            <BarRow
              key={r.month}
              label={formatMonth(r.month)}
              value={r.total}
              max={maxRevenue}
              display={formatCurrency(r.total)}
              highlight={r.month === month}
              hint={
                r.total > 0
                  ? [
                      `Serviços ${formatCurrency(r.services)}`,
                      r.products > 0 && `Produtos ${formatCurrency(r.products)}`,
                      r.club > 0 && `Clube ${formatCurrency(r.club)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : undefined
              }
            />
          ))}
        </List>
        <p className="text-xs text-muted-foreground">
          Serviços feitos (inclui o que ficou no fiado) + produtos vendidos + mensalidades do Clube recebidas.
          Atendimentos pelo plano do Clube não somam de novo.
        </p>
      </Section>

      <Section title="Serviços mais feitos">
        {services.length === 0 ? (
          <Empty>Nenhum atendimento finalizado neste mês.</Empty>
        ) : (
          <List>
            {services.map((s) => (
              <BarRow
                key={s.name}
                label={s.name}
                value={s.count}
                max={services[0].count}
                display={`${s.count}×`}
                hint={formatCurrency(s.revenue)}
              />
            ))}
          </List>
        )}
      </Section>

      <Section title="De onde vieram os agendamentos">
        {sources.length === 0 ? (
          <Empty>Nenhum agendamento neste mês.</Empty>
        ) : (
          <List>
            {sources.map((s) => (
              <BarRow
                key={s.source ?? "direto"}
                label={s.source ? sourceLabel(s.source) : "Painel ou link sem origem"}
                value={s.count}
                max={sources[0].count}
                display={String(s.count)}
              />
            ))}
          </List>
        )}
        <p className="text-xs text-muted-foreground">
          Use os links por canal da tela Divulgar (Instagram, WhatsApp, cartaz…) para saber o que mais traz cliente.
        </p>
      </Section>

      <p className="text-xs text-muted-foreground">
        Ocupação = tempo agendado ÷ horas abertas × barbeiros que atendem. Folgas e bloqueios não são descontados.
      </p>
    </Page>
  );
}
