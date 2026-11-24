import { ActionButton, ActionForm } from "@/components/action-form";
import { Card, Empty, List, Page, PageHeader, Section, fieldClass } from "@/components/page-ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireStaff } from "@/lib/auth";
import { FREQUENCIES } from "@/lib/recurring";
import { formatTime, todayIso } from "@/lib/time";
import { cancelSeries, createSeries } from "./actions";

type Occurrence = {
  series_id: string;
  scheduled_at: string;
  customer_name: string;
  customer_id: string | null;
  service: { name: string } | null;
  barber: { full_name: string } | null;
};

export default async function RecurringPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const { supabase, barbershop } = await requireStaff();
  const { cliente } = await searchParams;
  const tz = barbershop.timezone;

  const [{ data: future }, { data: customers }, { data: services }, { data: barbers }] = await Promise.all([
    supabase
      .from("appointments")
      .select("series_id, scheduled_at, customer_name, customer_id, service:services(name), barber:users(full_name)")
      .not("series_id", "is", null)
      .gt("scheduled_at", new Date().toISOString())
      .in("status", ["solicitado", "confirmado"])
      .order("scheduled_at")
      .limit(1000),
    supabase.from("customers").select("id, name, phone").order("name").limit(1000),
    supabase.from("services").select("id, name").eq("barbershop_id", barbershop.id).eq("active", true).order("name"),
    supabase.from("users").select("id, full_name").eq("active", true).eq("takes_appointments", true).order("full_name"),
  ]);

  const series = new Map<string, { first: Occurrence; count: number }>();
  for (const o of (future ?? []) as unknown as Occurrence[]) {
    const s = series.get(o.series_id);
    if (s) s.count++;
    else series.set(o.series_id, { first: o, count: 1 });
  }

  const weekday = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { timeZone: tz, weekday: "long" });
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit" });

  return (
    <Page>
      <PageHeader
        title="Horários fixos"
        description="Para o cliente que vem sempre no mesmo dia e hora. Cada data vira um agendamento confirmado; as que já estiverem ocupadas ficam de fora."
      />

      <Card>
        <ActionForm action={createSeries} submitLabel="Marcar horário fixo" successMessage="Horários marcados!">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="customerId">Cliente</Label>
              <select id="customerId" name="customerId" required defaultValue={cliente ?? ""} className={fieldClass}>
                <option value="" disabled>
                  Escolha o cliente
                </option>
                {(customers ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">O cliente aparece aqui depois do primeiro agendamento.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="serviceId">Serviço</Label>
              <select id="serviceId" name="serviceId" required className={fieldClass} defaultValue="">
                <option value="" disabled>
                  Escolha
                </option>
                {(services ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="barberId">Barbeiro</Label>
              <select id="barberId" name="barberId" required className={fieldClass} defaultValue="">
                <option value="" disabled>
                  Escolha
                </option>
                {(barbers ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="firstDate">Primeira data</Label>
              <Input id="firstDate" name="firstDate" type="date" required min={todayIso(tz)} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="time">Horário</Label>
              <Input id="time" name="time" type="time" required step={300} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="everyWeeks">Frequência</Label>
              <select id="everyWeeks" name="everyWeeks" className={fieldClass} defaultValue="1">
                {FREQUENCIES.map((f) => (
                  <option key={f.weeks} value={f.weeks}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="count">Quantas vezes</Label>
              <Input id="count" name="count" type="number" min={2} max={26} defaultValue={8} required className="h-11" />
            </div>
          </div>
        </ActionForm>
      </Card>

      <Section title="Séries ativas">
        {series.size === 0 ? (
          <Empty>Nenhum horário fixo ainda.</Empty>
        ) : (
          <List>
            {[...series.entries()].map(([id, { first, count }]) => (
              <li key={id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{first.customer_name}</p>
                  <p className="truncate text-muted-foreground">
                    <span className="capitalize">{weekday(first.scheduled_at)}</span>, {formatTime(first.scheduled_at, tz)} ·{" "}
                    {first.service?.name ?? "Serviço"} · {first.barber?.full_name ?? "Sem barbeiro"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Próximo {date(first.scheduled_at)} · faltam {count}
                  </p>
                </div>
                <ActionButton
                  action={cancelSeries}
                  fields={{ seriesId: id }}
                  confirm="Cancelar todos os próximos horários desta série?"
                >
                  Cancelar série
                </ActionButton>
              </li>
            ))}
          </List>
        )}
      </Section>
    </Page>
  );
}
