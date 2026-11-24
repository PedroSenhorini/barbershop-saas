import { ActionForm } from "@/components/action-form";
import { Card, Empty, Page, PageHeader, Section, textareaClass } from "@/components/page-ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireOwnerPage } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import type { ClubPlan } from "@/lib/supabase/types";
import { savePlan } from "../actions";

function PlanFields({ plan }: { plan?: ClubPlan }) {
  const key = plan?.id ?? "novo";
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {plan && <input type="hidden" name="id" value={plan.id} />}
      <div className="space-y-1.5 sm:col-span-3">
        <Label htmlFor={`name-${key}`}>Nome</Label>
        <Input id={`name-${key}`} name="name" required maxLength={60} defaultValue={plan?.name} placeholder="Corte ilimitado" className="h-11" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`price-${key}`}>Preço por mês</Label>
        <Input id={`price-${key}`} name="price" required inputMode="decimal" defaultValue={plan ? String(plan.price).replace(".", ",") : ""} className="h-11" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`uses-${key}`}>Atendimentos/mês (vazio = ilimitado)</Label>
        <Input id={`uses-${key}`} name="uses" type="number" min={1} max={60} defaultValue={plan?.uses_per_month ?? ""} className="h-11" />
      </div>
      <label className="flex items-center gap-2 self-end pb-3 text-sm">
        <input type="checkbox" name="active" defaultChecked={plan?.active ?? true} className="size-4" />
        À venda
      </label>
      <div className="space-y-1.5 sm:col-span-3">
        <Label htmlFor={`desc-${key}`}>O que inclui</Label>
        <textarea id={`desc-${key}`} name="description" rows={2} maxLength={200} defaultValue={plan?.description ?? ""} placeholder="Cortes ilimitados de segunda a quinta" className={textareaClass} />
      </div>
    </div>
  );
}

export default async function PlansPage() {
  const { supabase } = await requireOwnerPage();
  const { data } = await supabase.from("club_plans").select("*").order("active", { ascending: false }).order("price");
  const plans = (data ?? []) as ClubPlan[];

  return (
    <Page>
      <PageHeader
        title="Planos do Clube"
        description="Planos mensais para o cliente. Quem já assina mantém o preço da época; mudar o preço vale para as próximas assinaturas."
        back={{ href: "/admin/clube", label: "Clube" }}
      />
      <Section title="Planos">
        {plans.length === 0 ? (
          <Empty>Nenhum plano ainda. Crie o primeiro abaixo.</Empty>
        ) : (
          plans.map((p) => (
            <Card key={p.id}>
              <details>
                <summary className="flex cursor-pointer items-center justify-between gap-2">
                  <span className="font-medium">
                    {p.name} {!p.active && <span className="text-xs text-muted-foreground">(fora de venda)</span>}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(Number(p.price))}/mês · {p.uses_per_month ? `${p.uses_per_month} atend.` : "ilimitado"}
                  </span>
                </summary>
                <ActionForm action={savePlan} successMessage="Plano salvo!" className="mt-3">
                  <PlanFields plan={p} />
                </ActionForm>
              </details>
            </Card>
          ))
        )}
      </Section>
      <Section title="Novo plano">
        <Card>
          <ActionForm action={savePlan} submitLabel="Criar plano" successMessage="Plano criado!" resetOnSuccess>
            <PlanFields />
          </ActionForm>
        </Card>
      </Section>
    </Page>
  );
}
