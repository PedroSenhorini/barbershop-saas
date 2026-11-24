import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Page, PageHeader } from "@/components/page-ui";
import { buttonVariants } from "@/components/ui/button";
import { STATUS_STYLE } from "@/lib/appointment-status";
import { requireStaff } from "@/lib/auth";
import { addDaysIso, formatDayShort, formatTime, isValidDateIso, todayIso, weekdayOf, zonedDateTime } from "@/lib/time";
import type { AppointmentStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  scheduled_at: string;
  status: AppointmentStatus;
  customer_name: string;
  barber_id: string | null;
  service: { name: string } | null;
};

function mondayOf(dateIso: string) {
  return addDaysIso(dateIso, -((weekdayOf(dateIso) + 6) % 7));
}

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ inicio?: string; barbeiro?: string }>;
}) {
  const { supabase, barbershop } = await requireStaff();
  const params = await searchParams;
  const tz = barbershop.timezone;
  const today = todayIso(tz);
  const start = mondayOf(isValidDateIso(params.inicio) ? params.inicio : today);
  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(start, i));
  const from = zonedDateTime(start, "00:00", tz).toISOString();
  const to = zonedDateTime(addDaysIso(start, 7), "00:00", tz).toISOString();

  const [{ data: appts }, { data: blocks }, { data: staff }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, scheduled_at, status, customer_name, barber_id, service:services(name)")
      .gte("scheduled_at", from)
      .lt("scheduled_at", to)
      .not("status", "in", "(cancelado)")
      .order("scheduled_at"),
    supabase.from("time_blocks").select("*").lt("starts_at", to).gt("ends_at", from),
    supabase.from("users").select("id, full_name").eq("active", true).order("full_name"),
  ]);

  const names = new Map((staff ?? []).map((s) => [s.id, s.full_name.split(" ")[0]]));
  const barberFilter = (staff ?? []).some((s) => s.id === params.barbeiro) ? params.barbeiro! : null;
  const items = ((appts ?? []) as unknown as Item[]).filter(
    (a) => !barberFilter || a.barber_id === barberFilter,
  );
  const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: tz });

  const href = (inicio: string, barbeiro: string | null) => {
    const p = new URLSearchParams({ inicio });
    if (barbeiro) p.set("barbeiro", barbeiro);
    return `/admin/semana?${p}`;
  };

  return (
    <Page wide>
      <PageHeader
        title="Semana"
        description={`${formatDayShort(days[0]).day}/${days[0].slice(5, 7)} a ${formatDayShort(days[6]).day}/${days[6].slice(5, 7)} · ${items.filter((a) => a.status !== "faltou").length} atendimentos`}
        action={
          <div className="flex gap-2">
            <Link href={href(addDaysIso(start, -7), barberFilter)} className={buttonVariants({ variant: "outline", size: "icon-lg" })} aria-label="Semana anterior">
              <ChevronLeft className="size-5" />
            </Link>
            <Link href={href(mondayOf(today), barberFilter)} className={cn(buttonVariants({ variant: "outline" }), "h-10")}>
              Hoje
            </Link>
            <Link href={href(addDaysIso(start, 7), barberFilter)} className={buttonVariants({ variant: "outline", size: "icon-lg" })} aria-label="Próxima semana">
              <ChevronRight className="size-5" />
            </Link>
          </div>
        }
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Link href={href(start, null)} className={cn(buttonVariants({ variant: barberFilter ? "outline" : "default", size: "sm" }), "shrink-0")}>
          Todos
        </Link>
        {(staff ?? []).map((s) => (
          <Link
            key={s.id}
            href={href(start, s.id)}
            className={cn(buttonVariants({ variant: barberFilter === s.id ? "default" : "outline", size: "sm" }), "shrink-0")}
          >
            {s.full_name.split(" ")[0]}
          </Link>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-7">
        {days.map((d) => {
          const label = formatDayShort(d);
          const dayItems = items.filter((a) => dayOf(a.scheduled_at) === d);
          const dayStart = zonedDateTime(d, "00:00", tz).getTime();
          const dayEnd = zonedDateTime(addDaysIso(d, 1), "00:00", tz).getTime();
          const dayBlocks = (blocks ?? []).filter(
            (b) =>
              new Date(b.starts_at).getTime() < dayEnd &&
              new Date(b.ends_at).getTime() > dayStart &&
              (!barberFilter || !b.barber_id || b.barber_id === barberFilter),
          );
          return (
            <div key={d} className={cn("min-w-0 rounded-xl border bg-card", d === today && "border-primary")}>
              <Link href={`/admin?dia=${d}`} className="flex items-baseline justify-between border-b px-3 py-2 hover:bg-muted/50">
                <span className="text-sm font-semibold capitalize">{label.weekday}</span>
                <span className="text-xs text-muted-foreground">
                  {label.day} {label.month}
                </span>
              </Link>
              <div className="space-y-1.5 p-2">
                {dayBlocks.map((b) => (
                  <p key={b.id} className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                    🚫 {b.barber_id ? names.get(b.barber_id) : "Fechado"}
                    {b.reason ? ` · ${b.reason}` : ""}
                  </p>
                ))}
                {dayItems.length === 0 && dayBlocks.length === 0 && (
                  <p className="px-1 py-2 text-xs text-muted-foreground">Livre</p>
                )}
                {dayItems.map((a) => (
                  <div key={a.id} className={cn("rounded-md px-2 py-1 text-xs", STATUS_STYLE[a.status])}>
                    <p className="font-semibold tabular-nums">
                      {formatTime(a.scheduled_at, tz)} · {a.customer_name.split(" ")[0]}
                    </p>
                    <p className="truncate opacity-80">
                      {a.service?.name ?? "Serviço"}
                      {a.barber_id && !barberFilter ? ` · ${names.get(a.barber_id) ?? ""}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Page>
  );
}
