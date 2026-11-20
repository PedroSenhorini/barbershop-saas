/**
 * Cloudflare Turnstile (captcha invisível) — opcional. Só verifica quando
 * TURNSTILE_SECRET_KEY existe; sem ela, todo pedido passa e o fluxo segue
 * normal. Ative junto com NEXT_PUBLIC_TURNSTILE_SITE_KEY (o widget no form).
 */

export const TURNSTILE_FIELD = "cf-turnstile-response";

export async function verifyTurnstile(token: unknown): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (typeof token !== "string" || !token) return false;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    // Cloudflare fora do ar não pode derrubar o agendamento de ninguém.
    return true;
  }
}

/** Campo-isca: invisível para pessoas, preenchido por robôs que enchem tudo. */
export const HONEYPOT_FIELD = "website";
