import { Trophy } from "lucide-react";
import { BarRow } from "@/components/bar-row";
import { MonthSwitcher } from "@/components/month-switcher";
import { Empty, List, Page, PageHeader, Section, Stat } from "@/components/page-ui";
import { requireOwnerPage } from "@/lib/auth";
import { fetchAll } from "@/lib/customer-data";
import { isValidMonthIso, monthRange } from "@/lib/finance";
import { formatCurrency } from "@/lib/format";
import { averageTicket, monthByBarber, returningSplit } from "@/lib/team-stats";
import { todayIso, zonedDateTime } from "@/lib/time";

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

/**
 * Desempenho da equipe no mês: ranking por faturamento, ticket médio, quantos
 * clientes voltaram (já tinham vindo antes) e faltas. Comissões ficam em
 * /admin/comissoes; aqui é para comparar e conversar com a equipe.
 */
export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { supabase, barbershop } = await requireOwnerPage();
  const tz = barbershop.timezone;
  const current = todayIso(tz).slice(0, 7);
  const { mes } = await searchParams;
  const month = isValidMonthIso(mes) && mes <= current ? mes : current;
  const monthStartMs = zonedDateTime(monthRange(month).first, "00:00", tz).getTime();

  const [stats, { data: staff }, firstVisits] = await Promise.all([
    monthByBarber(supabase, month, tz),
    supabase.from("users").select("id, full_name, active").order("full_name"),
    fetchAll<{ customer_id: string; first_visit_at: string | null }>((from, to) =>
      supabase.from("customer_stats").select("customer_id, first_visit_at").order("customer_id").range(from, to),
    ),
  ]);

  const names = new Map((staff ?? []).map((u) => [u.id, u.full_name]));
  const firstVisitAt = new Map(firstVisits.map((f) => [f.customer_id, f.first_visit_at]));

  const ranking = stats
    .map((m) => ({
      ...m,
      name: names.get(m.barberId) ?? "Ex-integrante",
      revenue: Math.round((m.serviceRevenue + m.productRevenue) * 100) / 100,
      ticket: averageTicket(m),
      ...returningSplit(m.customerIds, firstVisitAt, monthStartMs),
    }))
    .sort((a, b) => b.revenue - a.revenue || b.services - a.services);

  const team = ranking.reduce(
    (t, m) => ({
      revenue: t.revenue + m.revenue,
      services: t.services + m.services,
      noShows: t.noShows + m.noShows,
      customers: t.customers + m.customers,
      returning: t.returning + m.returning,
    }),
    { revenue: 0, services: 0, noShows: 0, customers: 0, returning: 0 },
  );
  const best = ranking[0];

  return (
    <Page>
      <PageHeader
        title="Desempenho da equipe"
        description="Quem atendeu mais, ticket médio e quantos clientes voltaram."
        action={<MonthSwitcher path="/admin/desempenho" month={month} current={current} />}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Faturamento da equipe" value={formatCurrency(team.revenue)} hint="serviços + produtos" />
        <Stat label="Atendimentos" value={String(team.services)} />
        <Stat
          label="Clientes que voltaram"
          value={`${pct(team.returning, team.customers)}%`}
          hint={`${team.returning} de ${team.customers}`}
        />
        <Stat
          label="Faltas"
          value={String(team.noShows)}
          hint={`${pct(team.noShows, team.services + team.noShows)}% dos horários`}
          tone={team.noShows > 0 ? "warning" : undefined}
        />
      </div>

      {ranking.length === 0 ? (
        <Empty>Nenhum atendimento finalizado neste mês.</Empty>
      ) : (
        <>
          <Section title="Ranking do mês">
            <List>
              {ranking.map((m, i) => (
                <BarRow
                  key={m.barberId}
                  label={`${i + 1}º ${m.name}`}
                  value={m.revenue}
                  max={best.revenue}
                  display={formatCurrency(m.revenue)}
                  highlight={i === 0 && m.revenue > 0}
                  hint={`${m.services} atendimento(s) · ticket ${formatCurrency(m.ticket)}${
                    m.planServices ? ` · ${m.planServices} pelo Clube` : ""
                  }`}
                />
              ))}
            </List>
          </Section>

          <Section title="Retorno e faltas">
            <List>
              {ranking.map((m) => (
                <li key={m.barberId} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.customers} cliente(s): {m.returning} voltaram · {m.newcomers} novo(s)
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold tabular-nums">{pct(m.returning, m.customers)}%</p>
                    <p className="text-xs text-muted-foreground">
                      {m.noShows} falta{m.noShows === 1 ? "" : "s"}
                    </p>
                  </div>
                </li>
              ))}
            </List>
            <p className="text-xs text-muted-foreground">
              &quot;Voltaram&quot; = clientes atendidos no mês que já tinham vindo antes. Cliente novo bem atendido vira
              recorrente no mês seguinte.
            </p>
          </Section>
        </>
      )}

      {best && best.revenue > 0 && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Trophy className="size-4 text-amber-600 dark:text-amber-400" />
          Destaque do mês: <span className="font-medium text-foreground">{best.name}</span>
        </p>
      )}
    </Page>
  );
}
