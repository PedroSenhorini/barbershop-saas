import { Trash2 } from "lucide-react";
import { ActionButton } from "@/components/action-form";
import { Empty, List, Page, PageHeader, Section } from "@/components/page-ui";
import { requireStaff } from "@/lib/auth";
import { PAYMENT_LABEL } from "@/lib/finance";
import { formatCurrency } from "@/lib/format";
import { addDaysIso, formatTime, todayIso, zonedDateTime } from "@/lib/time";
import type { Sale } from "@/lib/supabase/types";
import { deleteSale } from "./actions";
import { SaleForm } from "./sale-form";

export default async function SellPage() {
  const { supabase, profile, barbershop } = await requireStaff();
  const isOwner = profile.role === "owner";
  const tz = barbershop.timezone;
  const today = todayIso(tz);
  const from = zonedDateTime(today, "00:00", tz).toISOString();
  const to = zonedDateTime(addDaysIso(today, 1), "00:00", tz).toISOString();

  const [{ data: products }, { data: customers }, { data: appts }, { data: staff }, { data: sales }] = await Promise.all([
    supabase.from("products").select("id, name, sale_price, quantity").not("sale_price", "is", null).order("name"),
    supabase.from("customers").select("id, name").order("name").limit(1000),
    supabase
      .from("appointments")
      .select("id, scheduled_at, customer_name, customer_id")
      .gte("scheduled_at", from)
      .lt("scheduled_at", to)
      .in("status", ["confirmado", "a_caminho", "em_andamento", "finalizado"])
      .order("scheduled_at"),
    supabase.from("users").select("id, full_name").eq("active", true).order("full_name"),
    supabase.from("sales").select("*").gte("created_at", from).lt("created_at", to).order("created_at", { ascending: false }),
  ]);

  const names = new Map((staff ?? []).map((s) => [s.id, s.full_name]));
  const customerNames = new Map((customers ?? []).map((c) => [c.id, c.name]));
  const todaySales = (sales ?? []) as Sale[];
  const totalToday = todaySales.reduce((s, x) => s + Number(x.total), 0);

  return (
    <Page wide>
      <PageHeader
        title="Vender"
        description="Venda de balcão ou extras de um atendimento (comanda). O estoque baixa sozinho."
      />

      <SaleForm
        products={(products ?? []).map((p) => ({ ...p, sale_price: Number(p.sale_price), quantity: Number(p.quantity) }))}
        customers={(customers ?? []).map((c) => ({ id: c.id, label: c.name }))}
        appointments={(appts ?? []).map((a) => ({
          id: a.id,
          label: `${formatTime(a.scheduled_at, tz)} · ${a.customer_name}`,
          customerId: a.customer_id,
        }))}
        sellers={(staff ?? []).map((s) => ({ id: s.id, label: s.full_name }))}
        defaultSellerId={profile.id}
        canChooseSeller={isOwner}
      />

      <Section title={`Vendas de hoje · ${formatCurrency(totalToday)}`}>
        {todaySales.length === 0 ? (
          <Empty>Nenhuma venda hoje.</Empty>
        ) : (
          <List>
            {todaySales.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="w-12 shrink-0 tabular-nums text-muted-foreground">{formatTime(s.created_at, tz)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {s.customer_id ? (customerNames.get(s.customer_id) ?? "Cliente") : "Consumidor final"}
                    {s.appointment_id ? " · comanda" : ""}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {PAYMENT_LABEL[s.payment_method]} · {s.seller_id ? names.get(s.seller_id) : "—"}
                    {Number(s.discount) > 0 ? ` · desconto ${formatCurrency(Number(s.discount))}` : ""}
                  </p>
                </div>
                <span className="font-medium tabular-nums">{formatCurrency(Number(s.total))}</span>
                {isOwner && (
                  <ActionButton action={deleteSale} fields={{ id: s.id }} variant="ghost" confirm="Excluir esta venda? O estoque não volta sozinho.">
                    <Trash2 className="size-4" />
                  </ActionButton>
                )}
              </li>
            ))}
          </List>
        )}
      </Section>
    </Page>
  );
}
