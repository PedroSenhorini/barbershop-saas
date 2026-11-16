/**
 * Datas sempre no fuso da barbearia. O servidor (Vercel) roda em UTC e o
 * navegador do cliente pode estar em qualquer fuso, então nada aqui usa o fuso
 * local do processo: um "dia" é uma string "YYYY-MM-DD" e um horário é
 * "HH:mm", ambos interpretados no `timeZone` informado.
 */

function partsInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function offsetMs(date: Date, timeZone: string) {
  const p = partsInZone(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-10-22" + "09:30" no fuso → instante absoluto (Date). */
export function zonedDateTime(dateIso: string, time: string, timeZone: string) {
  const [y, m, d] = dateIso.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const firstOffset = offsetMs(new Date(guess), timeZone);
  let result = guess - firstOffset;
  // Segunda passada cobre o caso de o palpite cair do outro lado de uma
  // mudança de horário de verão.
  const secondOffset = offsetMs(new Date(result), timeZone);
  if (secondOffset !== firstOffset) result = guess - secondOffset;
  return new Date(result);
}

/** Dia ("YYYY-MM-DD") de um instante, no fuso. */
export function dateIsoInZone(date: Date, timeZone: string) {
  const p = partsInZone(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function todayIso(timeZone: string) {
  return dateIsoInZone(new Date(), timeZone);
}

export function addDaysIso(dateIso: string, days: number) {
  const [y, m, d] = dateIso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** 0 = domingo ... 6 = sábado. */
export function weekdayOf(dateIso: string) {
  const [y, m, d] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isValidDateIso(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/** "HH:mm" → minutos desde a meia-noite. */
export function toMinutes(time: string) {
  const [hh, mm] = time.split(":").map(Number);
  return hh * 60 + mm;
}

export function fromMinutes(minutes: number) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function formatTime(date: Date | string, timeZone: string) {
  return new Date(date).toLocaleTimeString("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Rótulo de um dia sem depender de fuso: "quarta-feira, 22 de outubro". */
export function formatDayLong(dateIso: string) {
  return new Date(`${dateIso}T12:00:00Z`).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function formatDayShort(dateIso: string) {
  const date = new Date(`${dateIso}T12:00:00Z`);
  return {
    weekday: date
      .toLocaleDateString("pt-BR", { timeZone: "UTC", weekday: "short" })
      .replace(".", ""),
    day: date.getUTCDate(),
    month: date
      .toLocaleDateString("pt-BR", { timeZone: "UTC", month: "short" })
      .replace(".", ""),
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
