import { addDaysIso } from "@/lib/time";

export const MAX_OCCURRENCES = 26;
export const FREQUENCIES = [
  { weeks: 1, label: "Toda semana" },
  { weeks: 2, label: "A cada 15 dias" },
  { weeks: 3, label: "A cada 3 semanas" },
  { weeks: 4, label: "A cada 4 semanas" },
] as const;

/** Datas de uma série de horário fixo: a primeira e as seguintes a cada N semanas. */
export function seriesDates(firstDateIso: string, everyWeeks: number, count: number) {
  const weeks = Math.min(Math.max(Math.trunc(everyWeeks), 1), 8);
  const n = Math.min(Math.max(Math.trunc(count), 1), MAX_OCCURRENCES);
  return Array.from({ length: n }, (_, i) => addDaysIso(firstDateIso, i * weeks * 7));
}
