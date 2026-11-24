"use server";

import type { FormState } from "@/components/action-form";
import { normalizeSource } from "@/lib/labels";
import { onlyDigits } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidDateIso } from "@/lib/time";
import { HONEYPOT_FIELD, TURNSTILE_FIELD, verifyTurnstile } from "@/lib/turnstile";
import type { WaitlistPeriod } from "@/lib/supabase/types";

/**
 * Formulários públicos sem login (lista de espera e cadastro na porta). Como
 * em actions.ts, gravam pela service role depois de validar; as tabelas não
 * têm policy para anônimos.
 */

function field(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

async function activeShop(barbershopId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(barbershopId)) return null;
  const { data } = await createAdminClient()
    .from("barbershops")
    .select("id, active")
    .eq("id", barbershopId)
    .maybeSingle();
  return data?.active ? data : null;
}

async function guard(formData: FormData): Promise<FormState | "bot" | null> {
  // Robô preencheu o campo-isca: finge sucesso.
  if (field(formData, HONEYPOT_FIELD)) return "bot";
  if (!(await verifyTurnstile(formData.get(TURNSTILE_FIELD)))) {
    return { error: "Não conseguimos confirmar que você não é um robô. Tente de novo." };
  }
  return null;
}

const PERIODS: WaitlistPeriod[] = ["qualquer", "manha", "tarde", "noite"];

export async function joinWaitlist(_prev: FormState, formData: FormData): Promise<FormState> {
  const g = await guard(formData);
  if (g === "bot") return { error: null, ok: Date.now() };
  if (g) return g;

  const shop = await activeShop(field(formData, "barbershopId"));
  if (!shop) return { error: "Esta barbearia não está aceitando pedidos agora." };

  const name = field(formData, "name");
  const phone = onlyDigits(field(formData, "phone"));
  const date = field(formData, "date");
  const period = field(formData, "period") as WaitlistPeriod;
  const serviceId = field(formData, "serviceId");
  if (name.length < 2) return { error: "Informe seu nome." };
  if (phone.length < 10 || phone.length > 11) return { error: "Informe um WhatsApp com DDD." };

  const supabase = createAdminClient();
  // Anti-spam: no máximo 2 pedidos em aberto por telefone.
  const { count } = await supabase
    .from("waitlist_entries")
    .select("id", { count: "exact", head: true })
    .eq("barbershop_id", shop.id)
    .eq("customer_phone", phone)
    .in("status", ["aguardando", "avisado"]);
  if ((count ?? 0) >= 2) return { error: "Você já está na lista de espera. Avisaremos pelo WhatsApp." };

  let validService: string | null = null;
  if (/^[0-9a-f-]{36}$/i.test(serviceId)) {
    const { data } = await supabase.from("services").select("id").eq("id", serviceId).eq("barbershop_id", shop.id).maybeSingle();
    validService = data?.id ?? null;
  }

  const { error } = await supabase.from("waitlist_entries").insert({
    barbershop_id: shop.id,
    customer_name: name.slice(0, 120),
    customer_phone: phone,
    service_id: validService,
    preferred_date: isValidDateIso(date) ? date : null,
    preferred_period: PERIODS.includes(period) ? period : "qualquer",
    notes: field(formData, "notes").slice(0, 500) || null,
  });
  if (error) return { error: "Não foi possível salvar. Tente de novo." };
  return { error: null, ok: Date.now() };
}

export async function registerLead(_prev: FormState, formData: FormData): Promise<FormState> {
  const g = await guard(formData);
  if (g === "bot") return { error: null, ok: Date.now() };
  if (g) return g;

  const shop = await activeShop(field(formData, "barbershopId"));
  if (!shop) return { error: "Cadastro indisponível no momento." };

  const name = field(formData, "name");
  const phone = onlyDigits(field(formData, "phone"));
  const referred = onlyDigits(field(formData, "referredBy"));
  if (name.length < 2) return { error: "Informe seu nome." };
  if (phone.length < 10 || phone.length > 11) return { error: "Informe um WhatsApp com DDD." };
  if (referred && (referred.length < 10 || referred.length > 11)) {
    return { error: "O WhatsApp de quem indicou precisa ter DDD." };
  }
  if (referred && referred === phone) return { error: "Você não pode indicar a si mesmo." };

  // Mesmo telefone de novo: atualiza o nome, sem duplicar.
  const { error } = await createAdminClient()
    .from("leads")
    .upsert(
      {
        barbershop_id: shop.id,
        name: name.slice(0, 120),
        phone,
        referred_by_phone: referred || null,
        source: normalizeSource(field(formData, "source")),
      },
      { onConflict: "barbershop_id,phone", ignoreDuplicates: true },
    );
  if (error) return { error: "Não foi possível salvar. Tente de novo." };
  return { error: null, ok: Date.now() };
}
