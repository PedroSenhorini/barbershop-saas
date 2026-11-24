/** Regras puras do Clube (testadas em club.test.ts). Datas "AAAA-MM-DD". */

export type DueStatus = "em_dia" | "vence_logo" | "vencido";

/** Dias entre duas datas ISO (b − a). */
export function daysBetweenIso(a: string, b: string) {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

export function dueStatus(nextDueIso: string, todayIso: string, soonDays = 3): DueStatus {
  const d = daysBetweenIso(todayIso, nextDueIso);
  if (d < 0) return "vencido";
  if (d <= soonDays) return "vence_logo";
  return "em_dia";
}

/** Mesmo dia do mês anterior, sem estourar (31/03 → 28 ou 29/02), como o Postgres faz. */
export function minusOneMonth(dateIso: string) {
  const [y, m, d] = dateIso.split("-").map(Number);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  return `${py}-${String(pm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

/**
 * Pote por tempo: divide o que entrou de mensalidades entre os profissionais
 * na proporção dos minutos que cada um atendeu pelo plano. Arredonda a
 * centavos e joga a sobra do arredondamento em quem atendeu mais.
 */
export function splitPot(pot: number, minutesByBarber: Record<string, number>) {
  const entries = Object.entries(minutesByBarber).filter(([, m]) => m > 0);
  const totalMinutes = entries.reduce((s, [, m]) => s + m, 0);
  const result: Record<string, number> = {};
  if (pot <= 0 || totalMinutes === 0) return result;
  let distributed = 0;
  for (const [id, minutes] of entries) {
    const share = Math.floor((pot * minutes * 100) / totalMinutes) / 100;
    result[id] = share;
    distributed += share;
  }
  const top = entries.sort((a, b) => b[1] - a[1])[0][0];
  result[top] = Math.round((result[top] + (pot - distributed)) * 100) / 100;
  return result;
}
