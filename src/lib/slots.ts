import { generateDaySlots } from "@/lib/hours";
import type { DayHours } from "@/lib/supabase/types";
import { formatTime } from "@/lib/time";

/**
 * Cálculo puro de horários livres: sem Supabase, sem relógio implícito.
 * `computeAvailability` (lib/availability.ts) busca os dados e chama isto;
 * os testes chamam direto.
 */

export type Slot = {
  iso: string;
  label: string;
  /** Barbeiros livres nesse horário (já filtrado pela preferência do cliente). */
  barberIds: string[];
};

/** Um agendamento ativo que ocupa a agenda. Horários em ms desde a época. */
export type BusyInterval = { start: number; end: number; barberId: string | null };

export function computeFreeSlots({
  dateIso,
  day,
  durationMinutes,
  timeZone,
  busy,
  barberIds,
  barberId,
  now,
  includePast = false,
}: {
  dateIso: string;
  /** Expediente do dia; null = fechado. */
  day: DayHours | null;
  durationMinutes: number;
  timeZone: string;
  busy: BusyInterval[];
  /** Todos os barbeiros que atendem na barbearia. */
  barberIds: string[];
  /** Barbeiro escolhido pelo cliente; null = qualquer um. */
  barberId: string | null;
  /** Instante atual em ms (injetado para os testes). */
  now: number;
  includePast?: boolean;
}): Slot[] {
  if (!day) return [];
  const candidates = barberId ? barberIds.filter((id) => id === barberId) : barberIds;
  if (candidates.length === 0) return [];

  const durationMs = durationMinutes * 60_000;

  return generateDaySlots(dateIso, day, durationMinutes, timeZone)
    .filter((slot) => includePast || slot.getTime() > now)
    .flatMap((slot) => {
      const start = slot.getTime();
      const end = start + durationMs;
      const overlapping = busy.filter((b) => start < b.end && b.start < end);
      const isFree = (id: string) => !overlapping.some((b) => b.barberId === id);

      // Agendamentos antigos sem barbeiro definido ocupam "alguém" da equipe.
      const unassigned = overlapping.filter((b) => b.barberId === null).length;
      const totalFree = barberIds.filter(isFree).length - unassigned;
      const freeCandidates = candidates.filter(isFree);

      if (totalFree <= 0 || freeCandidates.length === 0) return [];
      return [{ iso: slot.toISOString(), label: formatTime(slot, timeZone), barberIds: freeCandidates }];
    });
}
