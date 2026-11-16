import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarClock, Car, CheckCircle2, Clock, MessageCircle, Scissors, XCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { dateIsoInZone, formatDayLong, formatTime } from "@/lib/time";
import { whatsAppLink } from "@/lib/whatsapp";
import type { AppointmentStatus } from "@/lib/supabase/types";
import { CustomerActions } from "./customer-actions";

// Link pessoal: nunca deve aparecer em buscadores.
export const metadata: Metadata = {
  title: "Seu horário",
  robots: { index: false, follow: false },
};

type Shop = { name: string; phone: string | null; address: string | null; timezone: string; slug: string };

async function loadAppointment(token: string) {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  // Service role: appointments não tem leitura pública; o token é a credencial.
  const { data } = await createAdminClient()
    .from("appointments")
    .select(
      "status, scheduled_at, ends_at, customer_name, customer_confirmed_at, service:services(name), barber:users(full_name), barbershop:barbershops(name, phone, address, timezone, slug)",
    )
    .eq("public_token", token)
    .single();
  return data;
}

const STATUS_COPY: Record<AppointmentStatus, { icon: React.ReactNode; title: string; text: string }> = {
  solicitado: {
    icon: <Clock className="size-6 text-amber-600" />,
    title: "Aguardando a barbearia",
    text: "Seu pedido chegou. Você recebe a confirmação pelo WhatsApp.",
  },
  confirmado: {
    icon: <CalendarClock className="size-6 text-sky-600" />,
    title: "Horário confirmado",
    text: "Te esperamos lá!",
  },
  a_caminho: {
    icon: <Car className="size-6 text-indigo-600" />,
    title: "Você está a caminho",
    text: "A barbearia já sabe. Até já!",
  },
  em_andamento: {
    icon: <Scissors className="size-6 text-violet-600" />,
    title: "Atendimento em andamento",
    text: "Bom corte!",
  },
  finalizado: {
    icon: <CheckCircle2 className="size-6 text-emerald-600" />,
    title: "Atendimento finalizado",
    text: "Obrigado pela visita!",
  },
  cancelado: {
    icon: <XCircle className="size-6 text-muted-foreground" />,
    title: "Horário cancelado",
    text: "Se quiser, escolha outro horário.",
  },
  faltou: {
    icon: <XCircle className="size-6 text-muted-foreground" />,
    title: "Horário encerrado",
    text: "Se quiser, escolha outro horário.",
  },
};

export default async function CustomerAppointmentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const appt = await loadAppointment(token);
  if (!appt) notFound();

  const shop = appt.barbershop as Shop | null;
  if (!shop) notFound();
  const service = appt.service as { name: string } | null;
  const barber = appt.barber as { full_name: string } | null;

  const now = new Date();
  const startsAt = new Date(appt.scheduled_at);
  const endsAt = new Date(appt.ends_at);
  const dayIso = dateIsoInZone(startsAt, shop.timezone);
  const isToday = dateIsoInZone(now, shop.timezone) === dayIso;
  const beforeStart = now < startsAt;

  // Mesmas regras de respondToAppointment, para só mostrar o que vai funcionar.
  const canConfirm = appt.status === "confirmado" && beforeStart && !appt.customer_confirmed_at;
  const canGo = appt.status === "confirmado" && isToday && now < endsAt;
  const canCancel =
    ["solicitado", "confirmado", "a_caminho"].includes(appt.status) && beforeStart;
  const ended = appt.status === "cancelado" || appt.status === "faltou" || appt.status === "finalizado";

  const copy = STATUS_COPY[appt.status];
  const firstName = appt.customer_name.trim().split(/\s+/)[0];

  return (
    <div className="flex flex-1 flex-col">
      <header className="space-y-1 border-b bg-primary px-5 pb-5 pt-8 text-primary-foreground">
        <p className="text-sm opacity-80">Olá, {firstName}!</p>
        <h1 className="text-2xl font-semibold">{shop.name}</h1>
        {shop.address && <p className="text-sm opacity-80">{shop.address}</p>}
      </header>

      <div className="flex flex-1 flex-col gap-5 p-5">
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <p className="text-lg font-semibold">{service?.name ?? "Atendimento"}</p>
          <p className="capitalize text-muted-foreground">
            {formatDayLong(dayIso)}, às {formatTime(startsAt, shop.timezone)}
          </p>
          {barber && <p className="text-sm text-muted-foreground">Com {barber.full_name}</p>}
        </div>

        <div className="flex items-start gap-3 rounded-xl bg-muted/60 p-4">
          {copy.icon}
          <div>
            <p className="font-medium">{copy.title}</p>
            <p className="text-sm text-muted-foreground">
              {appt.status === "confirmado" && appt.customer_confirmed_at
                ? "Presença confirmada. Te esperamos lá!"
                : copy.text}
            </p>
          </div>
        </div>

        <CustomerActions
          token={token}
          canConfirm={canConfirm}
          canGo={canGo}
          canCancel={canCancel}
          goHint={appt.status === "confirmado" && !isToday && beforeStart}
        />

        <div className="mt-auto space-y-2">
          {ended && (
            <a
              href={`/${shop.slug}`}
              className={cn(buttonVariants({ size: "lg" }), "h-12 w-full text-base")}
            >
              Agendar outro horário
            </a>
          )}
          {shop.phone && (
            <a
              href={whatsAppLink(shop.phone, `Olá! Sou ${appt.customer_name}, tenho horário ${formatDayLong(dayIso)} às ${formatTime(startsAt, shop.timezone)}.`)}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-12 w-full gap-2 text-base")}
            >
              <MessageCircle className="size-5" />
              Falar com a barbearia
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
