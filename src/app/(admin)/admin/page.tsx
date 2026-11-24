import { requireStaff } from "@/lib/auth";
import { getBookableBarbers } from "@/lib/availability";
import { getSiteUrl } from "@/lib/site-url";
import { addDaysIso, formatDayLong, isValidDateIso, todayIso, zonedDateTime } from "@/lib/time";
import type { AppointmentWithRelations } from "@/lib/supabase/types";
import { Agenda } from "./agenda";
import { DaySwitcher } from "./day-switcher";
import { InstallAppCard } from "./install-app-card";
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
        // A RLS deixa ler serviços ativos de qualquer barbearia (a página
        // pública precisa): aqui filtramos a da equipe logada.
        .eq("barbershop_id", barbershop.id)
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
      {showWelcome ? (
        <WelcomeCard bookingUrl={bookingUrl} barbershopName={barbershop.name} />
      ) : (
        <InstallAppCard />
      )}

      <DaySwitcher
        key={day}
        label={dayLabel ?? "Agenda"}
        sublabel={formatDayLong(day)}
        prevHref={`/admin?dia=${addDaysIso(day, -1)}`}
        nextHref={`/admin?dia=${addDaysIso(day, 1)}`}
        todayHref={day !== today ? "/admin" : null}
      >
        <Agenda
          dateIso={day}
          appointments={(appointments ?? []) as AppointmentWithRelations[]}
          barbershop={{ id: barbershop.id, name: barbershop.name, timezone: tz, siteUrl }}
          services={services ?? []}
          barbers={barbers}
          currentUserId={profile.id}
        />
      </DaySwitcher>

      {!showWelcome && <ShareLinkCard bookingUrl={bookingUrl} barbershopName={barbershop.name} />}
    </div>
  );
}
