import { ActionForm } from "@/components/action-form";
import { Card, Page, PageHeader, textareaClass } from "@/components/page-ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireOwnerPage } from "@/lib/auth";
import { saveLoyaltySettings } from "./actions";

export default async function LoyaltyPage() {
  const { barbershop: b } = await requireOwnerPage();

  return (
    <Page>
      <PageHeader title="Fidelidade e marketing" description="Cashback, avaliação no Google, pixel de anúncios e a vitrine da sua página." />
      <ActionForm action={saveLoyaltySettings} successMessage="Configurações salvas!" className="space-y-4">
        <Card className="space-y-3">
          <h2 className="font-semibold">Cashback</h2>
          <div className="space-y-1.5">
            <Label htmlFor="cashback">% do valor pago que volta como crédito</Label>
            <Input id="cashback" name="cashback" inputMode="decimal" defaultValue={String(Number(b.cashback_percent)).replace(".", ",")} className="h-11 w-32" />
            <p className="text-xs text-muted-foreground">
              Ao finalizar um atendimento pago (dinheiro, Pix ou cartão), o cliente ganha esse crédito. O saldo aparece na
              ficha e a equipe desconta quando ele usar. 0 = desligado.
            </p>
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-semibold">Avaliação no Google</h2>
          <div className="space-y-1.5">
            <Label htmlFor="google">Link para avaliar sua barbearia no Google</Label>
            <Input id="google" name="google" type="url" placeholder="https://g.page/r/…/review" defaultValue={b.google_review_url ?? ""} className="h-11" />
            <p className="text-xs text-muted-foreground">
              No Perfil da Empresa do Google, use “Pedir avaliações” e copie o link. Só quem dá nota 4 ou 5 recebe o convite.
            </p>
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-semibold">Pixel do Instagram/Facebook</h2>
          <div className="space-y-1.5">
            <Label htmlFor="pixel">ID do pixel (Meta)</Label>
            <Input id="pixel" name="pixel" inputMode="numeric" defaultValue={b.meta_pixel_id ?? ""} className="h-11" />
            <p className="text-xs text-muted-foreground">
              Com o pixel, o Gerenciador de Anúncios sabe quantos agendamentos vieram de cada anúncio (evento “Schedule”).
            </p>
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-semibold">Vitrine da página de agendamento</h2>
          <div className="space-y-1.5">
            <Label htmlFor="instagram">Instagram</Label>
            <Input id="instagram" name="instagram" placeholder="@suabarbearia" defaultValue={b.instagram ? `@${b.instagram}` : ""} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="about">Sobre a barbearia</Label>
            <textarea id="about" name="about" rows={3} maxLength={600} defaultValue={b.about ?? ""} placeholder="Estilo, diferenciais, estacionamento…" className={textareaClass} />
          </div>
        </Card>
      </ActionForm>
    </Page>
  );
}
