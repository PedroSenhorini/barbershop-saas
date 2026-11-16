import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireStaff } from "@/lib/auth";
import { getBookableBarbers } from "@/lib/availability";
import { getSiteUrl } from "@/lib/site-url";
import { addDaysIso, formatDayLong, isValidDateIso, todayIso, zonedDateTime } from "@/lib/time";
import type { AppointmentWithRelations } from "@/lib/supabase/types";
import { Agenda } from "./agenda";
import { ShareLinkCard, WelcomeCard } from "./onboarding-cards";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string; bemvindo?: string }>;
}) {
  const { supabase, profile, barbershop } = await requireStaff();
  const params = await searchParams;
  const tz = barbershop.timezone;
  const today = todayIso(tz);
  const day = isValidDateIso(params.dia) ? params.dia : today;

  const [{ data: appointments }, { count: totalEver }, { data: services }, barbers, siteUrl] =
    await Promise.all([
      supabase
        .from("appointments")
        .select(
          "*, service:services(id, name, duration_minutes, price), barber:users(id, full_name)",
        )
        .gte("scheduled_at", zonedDateTime(day, "00:00", tz).toISOString())
        .lt("scheduled_at", zonedDateTime(addDaysIso(day, 1), "00:00", tz).toISOString())
        .order("scheduled_at", { ascending: true }),
      supabase.from("appointments").select("id", { count: "exact", head: true }),
      supabase
        .from("services")
        .select("id, name, duration_minutes, price")
        .eq("active", true)
        .order("price"),
      getBookableBarbers(barbershop.id),
      getSiteUrl(),
    ]);

  const bookingUrl = `${siteUrl}/${barbershop.slug}`;
  const isOwner = profile.role === "owner";
  const showWelcome = isOwner && (params.bemvindo === "1" || totalEver === 0);

  const dayLabel =
    day === today
      ? "Hoje"
      : day === addDaysIso(today, 1)
        ? "Amanhã"
        : day === addDaysIso(today, -1)
          ? "Ontem"
          : null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 md:p-6">
      {showWelcome && <WelcomeCard bookingUrl={bookingUrl} barbershopName={barbershop.name} />}

      <div className="flex items-center gap-2">
        <Link
          href={`/admin?dia=${addDaysIso(day, -1)}`}
          aria-label="Dia anterior"
          className={buttonVariants({ variant: "outline", size: "icon-lg" })}
        >
          <ChevronLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="text-lg font-semibold leading-tight">{dayLabel ?? "Agenda"}</h1>
          <p className="text-sm capitalize text-muted-foreground">{formatDayLong(day)}</p>
        </div>
        <Link
          href={`/admin?dia=${addDaysIso(day, 1)}`}
          aria-label="Próximo dia"
          className={buttonVariants({ variant: "outline", size: "icon-lg" })}
        >
          <ChevronRight className="size-5" />
        </Link>
      </div>
      {day !== today && (
        <div className="text-center">
          <Link href="/admin" className={cn(buttonVariants({ variant: "link", size: "sm" }))}>
            Voltar para hoje
          </Link>
        </div>
      )}

      <Agenda
        key={day}
        dateIso={day}
        appointments={(appointments ?? []) as AppointmentWithRelations[]}
        barbershop={{ id: barbershop.id, name: barbershop.name, timezone: tz, siteUrl }}
        services={services ?? []}
        barbers={barbers}
        currentUserId={profile.id}
      />

      {!showWelcome && <ShareLinkCard bookingUrl={bookingUrl} barbershopName={barbershop.name} />}
    </div>
  );
}
