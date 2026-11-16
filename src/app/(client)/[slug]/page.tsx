import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBookableBarbers } from "@/lib/availability";
import { hoursForDate, summarizeHours } from "@/lib/hours";
import { addDaysIso, todayIso } from "@/lib/time";
import { BookingFlow } from "./booking-flow";

/** Quantos dias à frente o cliente pode agendar. */
const BOOKING_WINDOW_DAYS = 21;

async function loadBarbershop(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("barbershops")
    .select("*")
    .eq("slug", slug)
    .single();
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const barbershop = await loadBarbershop((await params).slug);
  if (!barbershop) return {};
  return {
    title: `Agende seu horário — ${barbershop.name}`,
    description: `Escolha o serviço e o horário na ${barbershop.name}. Rápido, sem baixar app.`,
  };
}

export default async function BookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const barbershop = await loadBarbershop(slug);
  if (!barbershop) notFound();

  const supabase = await createClient();
  const [{ data: services }, barbers] = await Promise.all([
    supabase
      .from("services")
      .select("*")
      .eq("barbershop_id", barbershop.id)
      .eq("active", true)
      .order("price"),
    getBookableBarbers(barbershop.id),
  ]);

  const today = todayIso(barbershop.timezone);
  const days = Array.from({ length: BOOKING_WINDOW_DAYS }, (_, i) => {
    const iso = addDaysIso(today, i);
    return { iso, open: !!hoursForDate(barbershop.weekly_hours, iso) };
  });

  return (
    <BookingFlow
      barbershop={{
        id: barbershop.id,
        name: barbershop.name,
        phone: barbershop.phone,
        address: barbershop.address,
        active: barbershop.active,
        hoursSummary: summarizeHours(barbershop.weekly_hours),
      }}
      services={services ?? []}
      barbers={barbers}
      days={days}
      todayIso={today}
    />
  );
}
