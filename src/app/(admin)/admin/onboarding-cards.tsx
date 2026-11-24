"use client";

import Link from "next/link";
import { Check, Clock, Copy, ExternalLink, MessageCircle, Scissors } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { whatsAppShareLink } from "@/lib/whatsapp";

function shareMessage(barbershopName: string, url: string) {
  return `Agora você pode agendar seu horário na ${barbershopName} pelo celular, a qualquer hora: ${url}`;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Link copiado!");
  } catch {
    toast.error("Não foi possível copiar. Selecione o link e copie manualmente.");
  }
}

function LinkActions({ bookingUrl, barbershopName }: { bookingUrl: string; barbershopName: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {bookingUrl.replace(/^https?:\/\//, "")}
        </span>
        <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => copy(bookingUrl)}>
          <Copy className="size-3.5" />
          Copiar
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
        <a
          href={whatsAppShareLink(shareMessage(barbershopName, bookingUrl))}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants(), "h-10 gap-2")}
        >
          <MessageCircle className="size-4" />
          Enviar no WhatsApp
        </a>
        <a
          href={bookingUrl}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: "outline" }), "h-10 gap-2")}
        >
          <ExternalLink className="size-4" />
          Ver minha página
        </a>
      </div>
    </div>
  );
}

export function WelcomeCard({
  bookingUrl,
  barbershopName,
}: {
  bookingUrl: string;
  barbershopName: string;
}) {
  return (
    <section className="space-y-4 rounded-xl border-2 border-primary/20 bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">Sua agenda online está no ar! 🎉</h2>
        <p className="text-sm text-muted-foreground">
          Três passos rápidos e seus clientes já podem agendar sozinhos.
        </p>
      </div>
      <ol className="space-y-2">
        <Step n={1} icon={Scissors} href="/admin/servicos" title="Confira seus serviços e preços" hint="Já criamos Corte, Barba e Corte + Barba. É só ajustar." />
        <Step n={2} icon={Clock} href="/admin/ajustes" title="Ajuste seus horários" hint="Dias de funcionamento e intervalo de almoço." />
      </ol>
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">3</span>
          Divulgue seu link
        </p>
        <LinkActions bookingUrl={bookingUrl} barbershopName={barbershopName} />
        <p className="text-xs text-muted-foreground">
          Dica: coloque o link na bio do Instagram e no status do WhatsApp.
        </p>
      </div>
    </section>
  );
}

function Step({
  n,
  icon: Icon,
  href,
  title,
  hint,
}: {
  n: number;
  icon: typeof Check;
  href: string;
  title: string;
  hint: string;
}) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 rounded-lg border p-3 transition hover:border-primary">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
          {n}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <Icon className="size-4 text-muted-foreground" />
      </Link>
    </li>
  );
}

export function ShareLinkCard({
  bookingUrl,
  barbershopName,
}: {
  bookingUrl: string;
  barbershopName: string;
}) {
  return (
    <section className="space-y-2 rounded-xl border bg-card p-4">
      <p className="text-sm font-medium">Seu link de agendamento</p>
      <LinkActions bookingUrl={bookingUrl} barbershopName={barbershopName} />
    </section>
  );
}
