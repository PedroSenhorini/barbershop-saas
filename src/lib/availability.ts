import { createAdminClient } from "@/lib/supabase/admin";
import { generateDaySlots, hoursForDate } from "@/lib/hours";
import type { AppointmentStatus, Barbershop, Service } from "@/lib/supabase/types";
import { addDaysIso, dateIsoInZone, formatTime, zonedDateTime } from "@/lib/time";

/**
 * Regra única de disponibilidade, usada pela página pública e pelo painel.
 * Roda só no servidor com a service role (appointments não tem policy pública
 * de RLS). A trava final contra corrida é a constraint appointments_no_overlap
 * do banco; esta checagem serve para mostrar só horários realmente livres.
 */

const INACTIVE_STATUSES: AppointmentStatus[] = ["cancelado", "faltou"];

export type BookableBarber = { id: string; full_name: string };

export type Slot = {
  iso: string;
  label: string;
  /** Barbeiros livres nesse horário (já filtrado pela preferência do cliente). */
  barberIds: string[];
};

export async function getBookableBarbers(barbershopId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("barbershop_id", barbershopId)
    .eq("active", true)
    .eq("takes_appointments", true)
    .order("created_at");
  return (data ?? []) as BookableBarber[];
}

export async function computeAvailability({
  barbershop,
  service,
  barberId,
  dateIso,
  includePast = false,
}: {
  barbershop: Pick<Barbershop, "id" | "timezone" | "weekly_hours">;
  service: Pick<Service, "duration_minutes">;
  barberId: string | null;
  dateIso: string;
  includePast?: boolean;
}): Promise<Slot[]> {
  const day = hoursForDate(barbershop.weekly_hours, dateIso);
  if (!day) return [];

  const allBarbers = await getBookableBarbers(barbershop.id);
  const candidates = barberId
    ? allBarbers.filter((b) => b.id === barberId)
    : allBarbers;
  if (candidates.length === 0) return [];

  const tz = barbershop.timezone;
  const dayStart = zonedDateTime(dateIso, "00:00", tz);
  const dayEnd = zonedDateTime(addDaysIso(dateIso, 1), "00:00", tz);

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("appointments")
    .select("scheduled_at, ends_at, barber_id")
    .eq("barbershop_id", barbershop.id)
    .not("status", "in", `(${INACTIVE_STATUSES.join(",")})`)
    .lt("scheduled_at", dayEnd.toISOString())
    .gt("ends_at", dayStart.toISOString());

  const busy = (existing ?? []).map((a) => ({
    start: new Date(a.scheduled_at).getTime(),
    end: new Date(a.ends_at).getTime(),
    barberId: a.barber_id,
  }));

  const now = Date.now();
  const durationMs = service.duration_minutes * 60_000;

  return generateDaySlots(dateIso, day, service.duration_minutes, tz)
    .filter((slot) => includePast || slot.getTime() > now)
    .flatMap((slot) => {
      const start = slot.getTime();
      const end = start + durationMs;
      const overlapping = busy.filter((b) => start < b.end && b.start < end);
      const isFree = (id: string) => !overlapping.some((b) => b.barberId === id);

      // Agendamentos antigos sem barbeiro definido ocupam "alguém" da equipe.
      const unassigned = overlapping.filter((b) => b.barberId === null).length;
      const totalFree = allBarbers.filter((b) => isFree(b.id)).length - unassigned;
      const freeCandidates = candidates.filter((b) => isFree(b.id));

      if (totalFree <= 0 || freeCandidates.length === 0) return [];
      return [
        {
          iso: slot.toISOString(),
          label: formatTime(slot, tz),
          barberIds: freeCandidates.map((b) => b.id),
        },
      ];
    });
}

export type BookingInput = {
  barbershopId: string;
  serviceId: string;
  barberId: string | null;
  scheduledAt: string;
  customerName: string;
  customerPhone: string;
  status: AppointmentStatus;
  /** Painel: permite lançar um encaixe num horário que já começou hoje. */
  fromPanel?: boolean;
};

export async function bookAppointment(
  input: BookingInput,
): Promise<{ id: string; barberId: string; publicToken: string } | { error: string }> {
  const supabase = createAdminClient();

  const [{ data: barbershop }, { data: service }] = await Promise.all([
    supabase
      .from("barbershops")
      .select("id, timezone, weekly_hours, active")
      .eq("id", input.barbershopId)
      .single(),
    supabase
      .from("services")
      .select("id, duration_minutes, active, barbershop_id")
      .eq("id", input.serviceId)
      .single(),
  ]);

  if (!barbershop || !service || service.barbershop_id !== barbershop.id) {
    return { error: "Barbearia ou serviço não encontrado." };
  }
  if (!input.fromPanel && (!barbershop.active || !service.active)) {
    return { error: "Esta barbearia não está aceitando agendamentos online no momento." };
  }

  const scheduledAt = new Date(input.scheduledAt);
  const slots = await computeAvailability({
    barbershop,
    service,
    barberId: input.barberId,
    dateIso: dateIsoInZone(scheduledAt, barbershop.timezone),
    includePast: input.fromPanel,
  });

  const slot = slots.find((s) => s.iso === scheduledAt.toISOString());
  if (!slot) {
    return { error: "Esse horário acabou de ser ocupado. Escolha outro, por favor." };
  }

  const barberId = input.barberId ?? slot.barberIds[0];
  const { data, error } = await supabase
    .from("appointments")
    .insert({
      barbershop_id: barbershop.id,
      service_id: service.id,
      barber_id: barberId,
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      scheduled_at: slot.iso,
      ends_at: new Date(
        scheduledAt.getTime() + service.duration_minutes * 60_000,
      ).toISOString(),
      status: input.status,
    })
    .select("id, public_token")
    .single();

  if (error) {
    // 23P01 = exclusion_violation: outra pessoa pegou o horário no mesmo instante.
    if (error.code === "23P01") {
      return { error: "Esse horário acabou de ser ocupado. Escolha outro, por favor." };
    }
    return { error: "Não foi possível salvar o agendamento. Tente novamente." };
  }

  return { id: data.id, barberId, publicToken: data.public_token };
}
