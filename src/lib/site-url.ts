import { headers } from "next/headers";

/**
 * Endereço público do app, para montar o link de agendamento que o dono
 * compartilha. Defina NEXT_PUBLIC_SITE_URL em produção (ex.: domínio próprio);
 * sem ela, usamos o host da requisição atual.
 */
export async function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
