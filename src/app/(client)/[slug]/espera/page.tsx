import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicForm } from "@/components/public-form";
import { fieldClass } from "@/components/page-ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PERIOD_LABEL } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { loadPublicBarbershop } from "@/lib/public-barbershop";
import { todayIso } from "@/lib/time";
import { joinWaitlist } from "../public-actions";

async function load(slug: string) {
  const supabase = await createClient();
  const shop = await loadPublicBarbershop(slug);
  if (!shop) return null;
  const { data: services } = await supabase
    .from("services")
    .select("id, name")
    .eq("barbershop_id", shop.id)
    .eq("active", true)
    .order("price");
  return { shop, services: services ?? [] };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await load((await params).slug);
  return data ? { title: `Lista de espera — ${data.shop.name}` } : {};
}

export default async function WaitlistPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const data = await load((await params).slug);
  if (!data) notFound();
  const { shop, services } = data;

  return (
    <main className="flex-1 space-y-5 p-5">
      <div className="space-y-1">
        <Link href={`/${shop.slug}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← {shop.name}
        </Link>
        <h1 className="text-2xl font-semibold">Lista de espera</h1>
        <p className="text-sm text-muted-foreground">
          Não achou horário? Deixe seu contato: se vagar um horário, a barbearia te chama no WhatsApp.
        </p>
      </div>

      {!shop.active ? (
        <p className="rounded-xl border p-4 text-sm text-muted-foreground">
          Esta barbearia não está aceitando pedidos online no momento.
        </p>
      ) : (
        <PublicForm
          action={joinWaitlist}
          hidden={{ barbershopId: shop.id }}
          submitLabel="Entrar na lista"
          successTitle="Você está na lista!"
          successText="Se abrir uma vaga, a barbearia te avisa pelo WhatsApp."
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Seu nome</Label>
            <Input id="name" name="name" required autoComplete="name" className="h-12 text-base" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">WhatsApp</Label>
            <Input id="phone" name="phone" type="tel" inputMode="numeric" required autoComplete="tel" placeholder="(11) 91234-5678" className="h-12 text-base" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="serviceId">Serviço</Label>
            <select id="serviceId" name="serviceId" className={fieldClass} defaultValue="">
              <option value="">Qualquer</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">Dia (opcional)</Label>
              <Input id="date" name="date" type="date" min={todayIso(shop.timezone)} className="h-12 text-base" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="period">Período</Label>
              <select id="period" name="period" className={fieldClass} defaultValue="qualquer">
                {Object.entries(PERIOD_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Observação (opcional)</Label>
            <Input id="notes" name="notes" maxLength={500} className="h-12 text-base" />
          </div>
        </PublicForm>
      )}
    </main>
  );
}
