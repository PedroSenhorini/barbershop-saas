import type { ExpenseCategory, PaymentMethod } from "@/lib/supabase/types";

export const PAYMENT_METHODS: PaymentMethod[] = ["dinheiro", "pix", "cartao"];

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao: "Cartão",
};

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "produtos",
  "equipamentos",
  "aluguel",
  "luz_agua",
  "internet",
  "salarios",
  "impostos",
  "outros",
];

export const EXPENSE_LABEL: Record<ExpenseCategory, string> = {
  produtos: "Produtos",
  equipamentos: "Equipamentos",
  aluguel: "Aluguel",
  luz_agua: "Luz e água",
  internet: "Internet e telefone",
  salarios: "Salários e comissões",
  impostos: "Impostos e taxas",
  outros: "Outros",
};

/**
 * Quanto um atendimento finalizado rendeu: o valor registrado ao finalizar,
 * ou o preço do serviço para atendimentos antigos (antes do registro existir).
 */
export function paidAmount(a: { amount_paid: number | null; service?: { price: number } | null }) {
  return Number(a.amount_paid ?? a.service?.price ?? 0);
}

/** "45,50" ou "45.50" → 45.5; vazio ou inválido → null. */
export function parseMoney(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/** Primeiro e último dia do mês de `dateIso`, e o mês anterior/seguinte. */
export function monthRange(monthIso: string) {
  const [y, m] = monthIso.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
  return { first: `${y}-${pad(m)}-01`, last: `${y}-${pad(m)}-${pad(last)}`, prev, next };
}

export function formatMonth(monthIso: string) {
  return new Date(`${monthIso}-15T12:00:00Z`).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

export function isValidMonthIso(value: string | undefined): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
