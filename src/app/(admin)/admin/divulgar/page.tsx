import Link from "next/link";
import { Download, MessageCircle, Printer } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { Card, List, Page, PageHeader, Section } from "@/components/page-ui";
import { buttonVariants } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth";
import { SOURCES } from "@/lib/labels";
import { qrSvg } from "@/lib/qr";
import { getSiteUrl } from "@/lib/site-url";
import { whatsAppShareLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

export default async function SharePage() {
  const { barbershop } = await requireStaff();
  const siteUrl = await getSiteUrl();
  const bookingUrl = `${siteUrl}/${barbershop.slug}`;
  const qrUrl = `${bookingUrl}?origem=cartaz`;
  const svg = await qrSvg(qrUrl);
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  return (
    <Page>
      <PageHeader title="Divulgar" description="Seu link de agendamento, QR Code, pôster e um link para cada canal." />

      <Card className="space-y-4">
        <div className="grid items-center gap-4 sm:grid-cols-[180px_1fr]">
          {/* SVG gerado por nós (lib/qr.ts), não por quem usa o painel. */}
          <div
            className="mx-auto w-44 rounded-lg border bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Aponte a câmera do celular para o QR e o cliente cai direto na sua agenda. Coloque no espelho, no balcão
              ou no cartão de visita.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/poster" target="_blank" className={cn(buttonVariants(), "h-10 gap-2")}>
                <Printer className="size-4" />
                Pôster para imprimir
              </Link>
              <a
                href={svgDataUrl}
                download={`qr-${barbershop.slug}.svg`}
                className={cn(buttonVariants({ variant: "outline" }), "h-10 gap-2")}
              >
                <Download className="size-4" />
                Baixar QR
              </a>
              <a
                href={whatsAppShareLink(`Agende seu horário na ${barbershop.name} pelo celular: ${bookingUrl}?origem=whatsapp`)}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "outline" }), "h-10 gap-2")}
              >
                <MessageCircle className="size-4" />
                Enviar no WhatsApp
              </a>
            </div>
          </div>
        </div>
      </Card>

      <Section title="Um link para cada canal">
        <p className="text-sm text-muted-foreground">
          Use o link certo em cada lugar. Em Relatórios você vê quantos agendamentos vieram de cada um.
        </p>
        <List>
          {SOURCES.map((s) => {
            const url = `${bookingUrl}?origem=${s.key}`;
            return (
              <li key={s.key} className="flex items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{s.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{url.replace(/^https?:\/\//, "")}</p>
                </div>
                <CopyButton text={url} />
              </li>
            );
          })}
        </List>
      </Section>

      <Section title="Outras páginas públicas">
        <List>
          {[
            { label: "Lista de espera", url: `${bookingUrl}/espera`, hint: "Quem não achou horário deixa o contato." },
            { label: "Cadastro na porta / indicação", url: `${bookingUrl}/cadastro`, hint: "Para sorteios e ações no balcão." },
          ].map((p) => (
            <li key={p.url} className="flex items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.label}</p>
                <p className="truncate text-xs text-muted-foreground">{p.hint}</p>
              </div>
              <CopyButton text={p.url} />
            </li>
          ))}
        </List>
      </Section>
    </Page>
  );
}
