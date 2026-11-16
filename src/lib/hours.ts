import { z } from "zod";
import type { DayHours, WeeklyHours } from "@/lib/supabase/types";
import { fromMinutes, toMinutes, weekdayOf, zonedDateTime } from "@/lib/time";

export const DAY_NAMES = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

/** Intervalo entre um horário oferecido e o próximo, em minutos. */
export const SLOT_STEP_MINUTES = 30;

export const DEFAULT_WEEKLY_HOURS: WeeklyHours = [
  null,
  { open: "09:00", close: "19:00", breakStart: null, breakEnd: null },
  { open: "09:00", close: "19:00", breakStart: null, breakEnd: null },
  { open: "09:00", close: "19:00", breakStart: null, breakEnd: null },
  { open: "09:00", close: "19:00", breakStart: null, breakEnd: null },
  { open: "09:00", close: "19:00", breakStart: null, breakEnd: null },
  { open: "09:00", close: "17:00", breakStart: null, breakEnd: null },
];

const time = z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido.");

const dayHoursSchema = z
  .object({
    open: time,
    close: time,
    breakStart: time.nullable(),
    breakEnd: time.nullable(),
  })
  .refine((d) => toMinutes(d.open) < toMinutes(d.close), {
    message: "O horário de fechar precisa ser depois do de abrir.",
  })
  .refine(
    (d) =>
      (d.breakStart === null) === (d.breakEnd === null) &&
      (d.breakStart === null ||
        (toMinutes(d.open) < toMinutes(d.breakStart) &&
          toMinutes(d.breakStart) < toMinutes(d.breakEnd!) &&
          toMinutes(d.breakEnd!) < toMinutes(d.close))),
    { message: "O intervalo precisa estar dentro do expediente." },
  );

export const weeklyHoursSchema = z
  .array(dayHoursSchema.nullable())
  .length(7)
  .refine((days) => days.some(Boolean), {
    message: "Abra pelo menos um dia da semana.",
  });

export function hoursForDate(weeklyHours: WeeklyHours, dateIso: string) {
  return weeklyHours[weekdayOf(dateIso)] ?? null;
}

/**
 * Horários de início possíveis num dia, no fuso da barbearia, que cabem
 * inteiros no expediente e não atravessam o intervalo de almoço.
 */
export function generateDaySlots(
  dateIso: string,
  day: DayHours,
  durationMinutes: number,
  timeZone: string,
): Date[] {
  const open = toMinutes(day.open);
  const close = toMinutes(day.close);
  const breakStart = day.breakStart ? toMinutes(day.breakStart) : null;
  const breakEnd = day.breakEnd ? toMinutes(day.breakEnd) : null;

  const slots: Date[] = [];
  for (let start = open; start + durationMinutes <= close; start += SLOT_STEP_MINUTES) {
    const end = start + durationMinutes;
    const hitsBreak =
      breakStart !== null && breakEnd !== null && start < breakEnd && breakStart < end;
    if (hitsBreak) continue;
    slots.push(zonedDateTime(dateIso, fromMinutes(start), timeZone));
  }
  return slots;
}

/** "Seg a Sex 09:00–19:00 · Sáb 09:00–17:00" — resumo para a página pública. */
export function summarizeHours(weeklyHours: WeeklyHours) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const label = (d: DayHours | null) => (d ? `${d.open}–${d.close}` : null);
  const groups: { from: number; to: number; text: string }[] = [];

  for (const day of order) {
    const text = label(weeklyHours[day]);
    if (!text) continue;
    const last = groups[groups.length - 1];
    if (last && last.text === text && order.indexOf(last.to) === order.indexOf(day) - 1) {
      last.to = day;
    } else {
      groups.push({ from: day, to: day, text });
    }
  }

  const short = (d: number) => DAY_NAMES[d].slice(0, 3);
  return groups
    .map((g) =>
      g.from === g.to
        ? `${short(g.from)} ${g.text}`
        : `${short(g.from)} a ${short(g.to)} ${g.text}`,
    )
    .join(" · ");
}
