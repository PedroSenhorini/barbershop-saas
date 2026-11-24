import { requireOwnerPage } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site-url";
import { SettingsForm } from "./settings-form";
import { ShareLinkSection } from "./share-link-section";

export default async function SettingsPage() {
  const { barbershop } = await requireOwnerPage();
  const siteUrl = await getSiteUrl();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold">Ajustes</h1>
        <p className="text-sm text-muted-foreground">
          Dados da barbearia e horário de funcionamento.
        </p>
      </div>
      <ShareLinkSection bookingUrl={`${siteUrl}/${barbershop.slug}`} barbershopName={barbershop.name} />
      <SettingsForm barbershop={barbershop} siteUrl={siteUrl} />
    </div>
  );
}
