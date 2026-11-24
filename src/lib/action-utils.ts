import { getStaffContext } from "@/lib/auth";
import { parseMoney } from "@/lib/finance";

/** Sessão para server actions do painel, ou a mensagem de erro pronta. */
export async function staffAction(ownerOnly = false) {
  const ctx = await getStaffContext();
  if (!ctx) return { error: "Sua sessão expirou. Entre de novo." as const, ctx: null };
  if (ownerOnly && ctx.profile.role !== "owner") {
    return { error: "Apenas o dono pode fazer isso." as const, ctx: null };
  }
  return { error: null, ctx };
}

export function text(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function optionalText(formData: FormData, key: string, max = 500) {
  const v = text(formData, key).slice(0, max);
  return v || null;
}

/** Valor em reais do formulário ("45,90"); null se vazio ou inválido. */
export function money(formData: FormData, key: string) {
  return parseMoney(text(formData, key));
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function uuidOrNull(formData: FormData, key: string) {
  const v = text(formData, key);
  return UUID_RE.test(v) ? v : null;
}
