import { ActionForm } from "@/components/action-form";
import { MonthSwitcher } from "@/components/month-switcher";
import { Card, Page, PageHeader, Stat } from "@/components/page-ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireStaff } from "@/lib/auth";
import { isValidMonthIso } from "@/lib/finance";
import { formatCurrency } from "@/lib/format";
import { commissionFor, monthByBarber } from "@/lib/team-stats";
import { todayIso } from "@/lib/time";
import { cn } from "@/lib/utils";
import { saveCommission } from "./actions";

const pct = (n: number) => String(Number(n)).replace(".", ",");

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { supabase, profile, barbershop } = await requireStaff();
  const isOwner = profile.role === "owner";
  const current = todayIso(barbershop.timezone).slice(0, 7);
  const { mes } = await searchParams;
  const month = isValidMonthIso(mes) && mes <= current ? mes : current;

  const [{ data: staff }, stats] = await Promise.all([
    supabase
      .from("users")
      .select("id, full_name, commission_percent, product_commission_percent, monthly_goal")
      .eq("active", true)
      .order("full_name"),
    monthByBarber(supabase, month, barbershop.timezone),
  ]);
  const byId = new Map(stats.map((s) => [s.barberId, s]));
  const people = (staff ?? []).filter((s) => isOwner || s.id === profile.id);

  return (
    <Page>
      <PageHeader
        title="Comissões e metas"
        description={
          isOwner
            ? "Defina a % de cada profissional sobre serviços e produtos. Atendimentos do Clube entram no repasse do Clube, não aqui."
            : "Quanto você já fez no mês e a sua meta."
        }
        action={<MonthSwitcher path="/admin/comissoes" month={month} current={current} />}
      />

      {people.map((p) => {
        const m = byId.get(p.id);
        const serviceRevenue = m?.serviceRevenue ?? 0;
        const productRevenue = m?.productRevenue ?? 0;
        const commission = commissionFor(
          { serviceRevenue, productRevenue },
          Number(p.commission_percent),
          Number(p.product_commission_percent),
        );
        const goal = p.monthly_goal === null ? null : Number(p.monthly_goal);
        const produced = serviceRevenue + productRevenue;
        const progress = goal ? Math.min(produced / goal, 1) : null;

        return (
          <Card key={p.id} className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold">{p.full_name}</p>
              <p className="text-sm text-muted-foreground">
                {pct(p.commission_percent)}% serviços · {pct(p.product_commission_percent)}% produtos
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Serviços" value={formatCurrency(serviceRevenue)} hint={`${m?.services ?? 0} atendimentos`} />
              <Stat label="Produtos" value={formatCurrency(productRevenue)} />
              <Stat label="Comissão" value={formatCurrency(commission)} tone="positive" />
              <Stat label="Meta" value={goal === null ? "—" : formatCurrency(goal)} hint={goal ? `faltam ${formatCurrency(Math.max(goal - produced, 0))}` : undefined} />
            </div>
            {progress !== null && (
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-label={`${Math.round(progress * 100)}% da meta`}>
                <div className={cn("h-full rounded-full", progress >= 1 ? "bg-emerald-600" : "bg-primary")} style={{ width: `${progress * 100}%` }} />
              </div>
            )}
            {isOwner && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">Alterar % e meta</summary>
                <ActionForm action={saveCommission} successMessage="Comissão salva!" className="mt-3">
                  <input type="hidden" name="id" value={p.id} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`c-${p.id}`}>% sobre serviços</Label>
                      <Input id={`c-${p.id}`} name="commission" inputMode="decimal" defaultValue={pct(p.commission_percent)} className="h-11" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`pc-${p.id}`}>% sobre produtos</Label>
                      <Input id={`pc-${p.id}`} name="productCommission" inputMode="decimal" defaultValue={pct(p.product_commission_percent)} className="h-11" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`g-${p.id}`}>Meta do mês (R$)</Label>
                      <Input id={`g-${p.id}`} name="goal" inputMode="decimal" defaultValue={goal === null ? "" : String(goal).replace(".", ",")} className="h-11" />
                    </div>
                  </div>
                </ActionForm>
              </details>
            )}
          </Card>
        );
      })}
    </Page>
  );
}
