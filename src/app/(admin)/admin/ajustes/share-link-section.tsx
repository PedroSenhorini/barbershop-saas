"use client";

import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error("Não foi possível copiar. Toque e segure no texto para copiar.");
  }
}

/**
 * Divulgação do link de agendamento: copiar, compartilhar pelo menu do
 * celular (WhatsApp, Instagram...) e um texto pronto para bio ou status.
 */
export function ShareLinkSection({ bookingUrl, barbershopName }: { bookingUrl: string; barbershopName: string }) {
  const bioText = `✂️ ${barbershopName}: agende seu horário pelo celular, em menos de 1 minuto 👉 ${bookingUrl}`;

  async function share() {
    // Web Share abre o menu nativo do celular. Sem suporte (computador), copia.
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: barbershopName,
          text: `Agende seu horário na ${barbershopName} pelo celular:`,
          url: bookingUrl,
        });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return; // a pessoa fechou o menu
      }
    }
    await copy(bookingUrl, "Link copiado! Cole onde quiser divulgar.");
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div>
        <h2 className="font-semibold">Divulgue seu link</h2>
        <p className="text-sm text-muted-foreground">Seus clientes agendam sozinhos por ele.</p>
      </div>

      <div className="space-y-2">
        <p className="truncate rounded-lg bg-muted px-3 py-2.5 text-sm font-medium">
          {bookingUrl.replace(/^https?:\/\//, "")}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11 gap-1.5" onClick={() => copy(bookingUrl, "Link copiado!")}>
            <Copy className="size-4" />
            Copiar link
          </Button>
          <Button className="h-11 gap-1.5" onClick={share}>
            <Share2 className="size-4" />
            Compartilhar
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Texto pronto para a bio do Instagram ou o status do WhatsApp</p>
        <p className="whitespace-pre-wrap break-words rounded-lg border border-dashed px-3 py-2.5 text-sm">{bioText}</p>
        <Button variant="outline" className="h-11 w-full gap-1.5" onClick={() => copy(bioText, "Texto copiado!")}>
          <Copy className="size-4" />
          Copiar texto
        </Button>
      </div>
    </section>
  );
}
