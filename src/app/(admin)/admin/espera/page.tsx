import { MessageCircle } from "lucide-react";
import { ActionButton, ActionForm } from "@/components/action-form";
import { Card, Empty, List, Page, PageHeader, Section, fieldClass } from "@/components/page-ui";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireStaff } from "@/lib/auth";
import { maskPhone } from "@/lib/format";
import { PERIOD_LABEL, WAITLIST_STATUS_LABEL } from "@/lib/labels";
import { getSiteUrl } from "@/lib/site-url";
import { vacancyMessage, whatsAppLink } from "@/lib/whatsapp";
import type { WaitlistEntry } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { addToWaitlist, setWaitlistStatus } from "./actions";

export default async function WaitlistPage() {
  const { supabase, barbershop } = await requireStaff();
  const [{ data: entries }, { data: services }, { data: barbers }, siteUrl] = await Promise.all([
    supabase
      .from("waitlist_entries")
      .select("*")
      .in("status", ["aguardando", "avisado"])
      .order("created_at")
      .limit(300),
    supabase.from("services").select("id, name").eq("barbershop_id", barbershop.id).eq("active", true).order("name"),
    supabase.from("users").select("id, full_name").eq("active", true).eq("takes_appointments", true).order("full_name"),
    getSiteUrl(),
  ]);
  const serviceName = new Map((services ?? []).map((s) => [s.id, s.name]));
  const barberName = new Map((barbers ?? []).map((b) => [b.id, b.full_name]));
  const bookingUrl = `${siteUrl}/${barbershop.slug}`;

  return (
    <Page>
      <PageHeader
        title="Lista de espera"
        description={
          <>
            Quem quer um encaixe. Quando um horário vagar, avise pelo WhatsApp. Os clientes também entram pelo site em{" "}
            <span className="font-medium">{bookingUrl.replace(/^https?:\/\//, "")}/espera</span>.
          </>
        }
      />

      <Section title={`Na fila (${entries?.length ?? 0})`}>
        {(entries ?? []).length === 0 ? (
          <Empty>Ninguém esperando vaga.</Empty>
        ) : (
          <List>
            {(entries as WaitlistEntry[]).map((e) => (
              <li key={e.id} className="space-y-2 px-4 py-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {e.customer_name}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        · {WAITLIST_STATUS_LABEL[e.status]}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      {maskPhone(e.customer_phone)} · {PERIOD_LABEL[e.preferred_period]}
                      {e.preferred_date ? ` · ${e.preferred_date.split("-").reverse().slice(0, 2).join("/")}` : ""}
                      {e.service_id ? ` · ${serviceName.get(e.service_id) ?? ""}` : ""}
                      {e.barber_id ? ` · com ${barberName.get(e.barber_id) ?? ""}` : ""}
                    </p>
                    {e.notes && <p className="text-xs text-muted-foreground">“{e.notes}”</p>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={whatsAppLink(
                      e.customer_phone,
                      vacancyMessage({ customerName: e.customer_name, barbershopName: barbershop.name, bookingUrl }),
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
                  >
                    <MessageCircle className="size-4" />
                    Avisar vaga
                  </a>
                  {e.status === "aguardando" && (
                    <ActionButton action={setWaitlistStatus} fields={{ id: e.id, status: "avisado" }}>
                      Marcar avisado
                    </ActionButton>
                  )}
                  <ActionButton action={setWaitlistStatus} fields={{ id: e.id, status: "agendado" }} successMessage="Saiu da fila: agendou.">
                    Agendou
                  </ActionButton>
                  <ActionButton action={setWaitlistStatus} fields={{ id: e.id, status: "desistiu" }} variant="ghost">
                    Desistiu
                  </ActionButton>
                </div>
              </li>
            ))}
          </List>
        )}
      </Section>

      <Section title="Colocar alguém na fila">
        <Card>
          <ActionForm action={addToWaitlist} submitLabel="Adicionar" successMessage="Na lista de espera!" resetOnSuccess>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" name="name" required className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">WhatsApp</Label>
                <Input id="phone" name="phone" type="tel" inputMode="numeric" required placeholder="(11) 91234-5678" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="serviceId">Serviço (opcional)</Label>
                <select id="serviceId" name="serviceId" className={fieldClass} defaultValue="">
                  <option value="">Qualquer</option>
                  {(services ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="barberId">Barbeiro (opcional)</Label>
                <select id="barberId" name="barberId" className={fieldClass} defaultValue="">
                  <option value="">Qualquer</option>
                  {(barbers ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date">Dia preferido (opcional)</Label>
                <Input id="date" name="date" type="date" className="h-11" />
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
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="notes">Observação (opcional)</Label>
                <Input id="notes" name="notes" maxLength={500} className="h-11" />
              </div>
            </div>
          </ActionForm>
        </Card>
      </Section>
    </Page>
  );
}
