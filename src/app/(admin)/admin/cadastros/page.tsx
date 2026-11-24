import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { ActionButton } from "@/components/action-form";
import { Empty, List, Page, PageHeader, Section, Stat } from "@/components/page-ui";
import { buttonVariants } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth";
import { maskPhone } from "@/lib/format";
import { LEAD_STATUS_LABEL, sourceLabel } from "@/lib/labels";
import { getSiteUrl } from "@/lib/site-url";
import { leadWelcomeMessage, whatsAppLink } from "@/lib/whatsapp";
import type { Lead } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { setLeadStatus } from "./actions";

type Filter = "abertos" | "todos";

/**
 * Contatos captados pela página /<slug>/cadastro (QR na porta, cartaz,
 * indicação). O objetivo é transformar cada um em cliente: chamar no WhatsApp
 * com o link de agendamento e marcar o que aconteceu.
 */
export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  const { supabase, barbershop } = await requireStaff();
  const filter: Filter = (await searchParams).ver === "todos" ? "todos" : "abertos";

  let query = supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(300);
  if (filter === "abertos") query = query.in("status", ["novo", "contatado"]);
  const [{ data }, { count: converted }, siteUrl] = await Promise.all([
    query,
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "virou_cliente"),
    getSiteUrl(),
  ]);
  const leads = (data ?? []) as Lead[];
  const bookingUrl = `${siteUrl}/${barbershop.slug}?origem=indicacao`;
  const signupUrl = `${siteUrl}/${barbershop.slug}/cadastro`;
  const newCount = leads.filter((l) => l.status === "novo").length;

  const date = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { timeZone: barbershop.timezone, day: "2-digit", month: "2-digit" });

  return (
    <Page>
      <PageHeader
        title="Cadastros da porta"
        description={
          <>
            Quem deixou o contato em{" "}
            <span className="font-medium">{signupUrl.replace(/^https?:\/\//, "")}</span>. Chame no WhatsApp com o
            link de agendamento e marque o que aconteceu.
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Novos para chamar" value={String(newCount)} tone={newCount > 0 ? "warning" : undefined} />
        <Stat label="Viraram clientes" value={String(converted ?? 0)} tone="positive" />
      </div>

      <div className="flex gap-2">
        {(["abertos", "todos"] as const).map((f) => (
          <Link
            key={f}
            href={f === "abertos" ? "/admin/cadastros" : "/admin/cadastros?ver=todos"}
            className={cn(
              "flex h-9 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition pointer-coarse:h-10",
              filter === f ? "border-primary bg-primary text-primary-foreground" : "bg-card",
            )}
          >
            {f === "abertos" ? "Para chamar" : "Todos"}
          </Link>
        ))}
      </div>

      <Section title={filter === "abertos" ? `Para chamar (${leads.length})` : `Todos (${leads.length})`}>
        {leads.length === 0 ? (
          <Empty>
            {filter === "abertos"
              ? "Nenhum cadastro esperando contato. Divulgue o QR Code da tela Divulgar na porta da barbearia."
              : "Ainda não há cadastros."}
          </Empty>
        ) : (
          <List>
            {leads.map((l) => (
              <li key={l.id} className="space-y-2 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {l.name}{" "}
                    <span className="text-xs font-normal text-muted-foreground">· {LEAD_STATUS_LABEL[l.status]}</span>
                  </p>
                  <p className="text-muted-foreground">
                    {maskPhone(l.phone)} · {date(l.created_at)}
                    {l.source ? ` · ${sourceLabel(l.source)}` : ""}
                  </p>
                  {l.referred_by_phone && (
                    <p className="text-xs text-muted-foreground">Indicado por {maskPhone(l.referred_by_phone)}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={whatsAppLink(
                      l.phone,
                      leadWelcomeMessage({
                        customerName: l.name,
                        barbershopName: barbershop.name,
                        bookingUrl,
                        referred: !!l.referred_by_phone,
                      }),
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
                  >
                    <MessageCircle className="size-4" />
                    Chamar no WhatsApp
                  </a>
                  {l.status === "novo" && (
                    <ActionButton action={setLeadStatus} fields={{ id: l.id, status: "contatado" }}>
                      Marcar contatado
                    </ActionButton>
                  )}
                  {l.status !== "virou_cliente" && (
                    <ActionButton
                      action={setLeadStatus}
                      fields={{ id: l.id, status: "virou_cliente" }}
                      successMessage="Boa! Virou cliente."
                    >
                      Virou cliente
                    </ActionButton>
                  )}
                  {l.status !== "novo" && (
                    <ActionButton action={setLeadStatus} fields={{ id: l.id, status: "novo" }} variant="ghost">
                      Voltar para novo
                    </ActionButton>
                  )}
                </div>
              </li>
            ))}
          </List>
        )}
      </Section>
    </Page>
  );
}
