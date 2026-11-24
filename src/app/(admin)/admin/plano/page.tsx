import { MessageCircle, Rocket, Users } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { Card, Page, PageHeader, Section, Stat } from "@/components/page-ui";
import { buttonVariants } from "@/components/ui/button";
import { requireOwnerPage } from "@/lib/auth";
import { PLAN_LABEL, supportWhatsApp, trialDaysLeft, trialNotice } from "@/lib/plan";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { whatsAppLink, whatsAppShareLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

/**
 * Plano do sistema e indicação. A cobrança é manual (sem gateway): o dono vê
 * o plano e o teste, e fala com o suporte para contratar. O link de indicação
 * leva a /cadastro?ref=CODIGO, que grava quem indicou.
 */
export default async function PlanPage() {
  const { barbershop } = await requireOwnerPage();
  const siteUrl = await getSiteUrl();

  // Service role: contar barbearias de outros donos não passa pela RLS. Só a
  // contagem sai daqui, nada dos dados delas.
  const { count: referred } = await createAdminClient()
    .from("barbershops")
    .select("id", { count: "exact", head: true })
    .eq("referred_by", barbershop.id);

  const daysLeft = trialDaysLeft(barbershop);
  const notice = trialNotice(daysLeft);
  const referralUrl = `${siteUrl}/cadastro?ref=${barbershop.referral_code}`;
  const support = supportWhatsApp();
  const shareText = `Estou usando uma agenda online na minha barbearia: o cliente marca sozinho pelo link e eu confirmo pelo WhatsApp. Cria a sua por aqui: ${referralUrl}`;

  return (
    <Page>
      <PageHeader title="Plano e indicação" description="Seu plano do sistema e o link para indicar outras barbearias." />

      <div className="grid grid-cols-2 gap-2">
        <Stat
          label="Seu plano"
          value={PLAN_LABEL[barbershop.plan]}
          hint={barbershop.active ? "Agendamento online ligado" : "Agendamento online pausado"}
          tone={barbershop.active ? undefined : "negative"}
        />
        <Stat
          label="Teste"
          value={daysLeft === null ? "—" : daysLeft < 0 ? "Terminou" : `${daysLeft} dia(s)`}
          hint={daysLeft === null ? "Sem período de teste" : "restantes"}
          tone={daysLeft !== null && daysLeft <= 3 ? "warning" : undefined}
        />
      </div>

      <Card className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Rocket className="size-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="font-medium">Contratar ou mudar de plano</p>
            <p className="text-sm text-muted-foreground">
              {notice ? `${notice} ` : ""}
              {support
                ? "Fale com o suporte pelo WhatsApp e informe seu código."
                : "Fale com quem liberou o seu acesso ao sistema e informe seu código."}
            </p>
            <p className="text-sm">
              Seu código: <span className="font-mono font-semibold tracking-wider">{barbershop.referral_code}</span>
            </p>
          </div>
        </div>
        {support && (
          <a
            href={whatsAppLink(
              support,
              `Olá! Sou da ${barbershop.name} (código ${barbershop.referral_code}) e quero falar sobre o meu plano.`,
            )}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants(), "h-11 w-full gap-2")}
          >
            <MessageCircle className="size-4" />
            Falar com o suporte
          </a>
        )}
      </Card>

      <Section title="Indique outras barbearias">
        <Card className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Conhece outro barbeiro que ainda marca tudo no caderno? Mande seu link. Quem se cadastrar por ele fica
            registrado como sua indicação.
          </p>
          <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{referralUrl.replace(/^https?:\/\//, "")}</span>
            <CopyButton text={referralUrl} />
          </div>
          <a
            href={whatsAppShareLink(shareText)}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full gap-2")}
          >
            <MessageCircle className="size-4" />
            Enviar no WhatsApp
          </a>
          <p className="flex items-center gap-2 text-sm">
            <Users className="size-4 text-muted-foreground" />
            {referred
              ? `${referred} barbearia(s) já se cadastraram pelo seu link.`
              : "Nenhuma barbearia cadastrada pelo seu link ainda."}
          </p>
        </Card>
      </Section>
    </Page>
  );
}
