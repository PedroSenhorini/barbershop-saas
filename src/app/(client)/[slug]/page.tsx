import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";
import { createClient } from "@/lib/supabase/server";
import { getBookableBarbers } from "@/lib/availability";
import { normalizeSource } from "@/lib/labels";
import { loadPublicBarbershop } from "@/lib/public-barbershop";
import { hoursForDate, summarizeHours } from "@/lib/hours";
import { addDaysIso, todayIso } from "@/lib/time";
import { BookingFlow } from "./booking-flow";

/** Quantos dias à frente o cliente pode agendar. */
const BOOKING_WINDOW_DAYS = 21;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const barbershop = await loadPublicBarbershop((await params).slug);
  if (!barbershop) return {};
  const title = `Agende seu horário — ${barbershop.name}`;
  const description = `Agende seu horário na ${barbershop.name} pelo celular, em menos de 1 minuto.`;
  // A imagem da prévia vem de ./opengraph-image.tsx (o Next liga sozinho).
  return {
    title,
    description,
    openGraph: { title, description, type: "website", locale: "pt_BR", siteName: barbershop.name },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ origem?: string | string[] }>;
}) {
  const { slug } = await params;
  // ?origem=instagram (links da tela Divulgar) vai junto no agendamento, para
  // o relatório de canais. Valor inválido vira null.
  const source = normalizeSource((await searchParams).origem);
  const barbershop = await loadPublicBarbershop(slug);
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

  // O banco só aceita dígitos (barbershops_settings_check); conferimos de novo
  // antes de colocar no script.
  const pixelId = barbershop.meta_pixel_id && /^[0-9]{5,20}$/.test(barbershop.meta_pixel_id)
    ? barbershop.meta_pixel_id
    : null;

  return (
    <>
      {pixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`}
        </Script>
      )}
      <BookingFlow
        barbershop={{
          id: barbershop.id,
          slug: barbershop.slug,
          name: barbershop.name,
          phone: barbershop.phone,
          address: barbershop.address,
          active: barbershop.active,
          hoursSummary: summarizeHours(barbershop.weekly_hours),
          about: barbershop.about,
          instagram: barbershop.instagram,
        }}
        services={services ?? []}
        barbers={barbers}
        days={days}
        todayIso={today}
        source={source}
      />
    </>
  );
}
