import { PrintButton } from "@/components/copy-button";
import { requireStaff } from "@/lib/auth";
import { summarizeHours } from "@/lib/hours";
import { qrSvg } from "@/lib/qr";
import { getSiteUrl } from "@/lib/site-url";

export const metadata = { title: "Pôster para imprimir" };

/** Pôster A4 com o QR de agendamento. Fora do layout do painel para imprimir limpo. */
export default async function PosterPage() {
  const { barbershop } = await requireStaff();
  const bookingUrl = `${await getSiteUrl()}/${barbershop.slug}`;
  const svg = await qrSvg(`${bookingUrl}?origem=cartaz`);

  return (
    <div className="flex min-h-dvh flex-col items-center gap-4 bg-muted/30 p-4 print:block print:bg-white print:p-0">
      <div className="print:hidden">
        <PrintButton />
      </div>
      <div className="flex aspect-[1/1.414] w-full max-w-[600px] flex-col items-center justify-between bg-white p-10 text-center text-black shadow print:max-w-none print:shadow-none">
        <div className="space-y-2">
          <p className="text-sm font-semibold tracking-[0.3em] uppercase">Agende pelo celular</p>
          <h1 className="text-4xl leading-tight font-bold">{barbershop.name}</h1>
        </div>
        {/* SVG gerado por nós (lib/qr.ts). */}
        <div className="w-3/4 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="space-y-1">
          <p className="text-lg font-semibold">Aponte a câmera para o QR Code</p>
          <p className="text-sm">ou acesse {bookingUrl.replace(/^https?:\/\//, "")}</p>
          <p className="pt-2 text-xs text-neutral-600">{summarizeHours(barbershop.weekly_hours)}</p>
        </div>
      </div>
    </div>
  );
}
