"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_WEEKLY_HOURS } from "@/lib/hours";
import { onlyDigits, slugify } from "@/lib/format";
import { RESERVED_SLUGS } from "@/lib/slugs";
import { HONEYPOT_FIELD, TURNSTILE_FIELD, verifyTurnstile } from "@/lib/turnstile";

/** Serviços iniciais: o dono ajusta preços depois, mas a página já nasce pronta. */
const STARTER_SERVICES = [
  { name: "Corte", price: 40, duration_minutes: 30 },
  { name: "Barba", price: 30, duration_minutes: 30 },
  { name: "Corte + Barba", price: 60, duration_minutes: 60 },
];

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome."),
  barbershopName: z.string().trim().min(2, "Informe o nome da barbearia."),
  phone: z
    .string()
    .transform(onlyDigits)
    .refine((v) => v.length === 10 || v.length === 11, "Informe o WhatsApp com DDD."),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres."),
  takesAppointments: z.boolean(),
});

export type SignUpState = {
  error: string | null;
  // Devolvido para o form não se apagar quando há erro (React 19 reseta o form).
  values?: Record<string, string>;
  // Muda a cada tentativa com erro: remonta o Turnstile, cujo token vale uma vez.
  attempt?: number;
};

async function uniqueSlug(name: string) {
  const admin = createAdminClient();
  const base = slugify(name) || "barbearia";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    if (RESERVED_SLUGS.has(candidate)) continue;
    const { count } = await admin
      .from("barbershops")
      .select("id", { count: "exact", head: true })
      .eq("slug", candidate);
    if (!count) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

export async function signUp(
  _prev: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  // Robô preencheu o campo-isca: finge sucesso (mesmo redirect do caminho
  // normal, que sem sessão cai no login) e não grava nada.
  if (formData.get(HONEYPOT_FIELD)) redirect("/admin?bemvindo=1");

  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    barbershopName: formData.get("barbershopName"),
    phone: formData.get("phone") ?? "",
    email: formData.get("email"),
    password: formData.get("password"),
    takesAppointments: formData.get("takesAppointments") === "on",
  });
  const values = {
    fullName: String(formData.get("fullName") ?? ""),
    barbershopName: String(formData.get("barbershopName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
  const fail = (error: string): SignUpState => ({ error, values, attempt: Date.now() });

  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const input = parsed.data;

  if (!(await verifyTurnstile(formData.get(TURNSTILE_FIELD)))) {
    return fail("Não conseguimos confirmar que você não é um robô. Tente de novo.");
  }

  const admin = createAdminClient();

  // Conta já confirmada: o dono entra direto no painel, sem depender de abrir
  // e-mail de confirmação (maior causa de desistência no cadastro).
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    console.error("[cadastro] createUser falhou:", createError);
    const taken = createError?.message.toLowerCase().includes("already");
    return fail(
      taken
        ? "Já existe uma conta com esse e-mail. Faça login."
        : "Não foi possível criar a conta. Tente novamente.",
    );
  }
  const userId = created.user.id;

  const { data: barbershop, error: shopError } = await admin
    .from("barbershops")
    .insert({
      name: input.barbershopName,
      slug: await uniqueSlug(input.barbershopName),
      phone: input.phone,
      weekly_hours: DEFAULT_WEEKLY_HOURS,
    })
    .select("id")
    .single();

  const { error: profileError } = barbershop
    ? await admin.from("users").insert({
        id: userId,
        barbershop_id: barbershop.id,
        full_name: input.fullName,
        role: "owner",
        takes_appointments: input.takesAppointments,
      })
    : { error: shopError };

  if (shopError || profileError || !barbershop) {
    console.error("[cadastro] criar barbearia falhou:", shopError ?? profileError);
    // Desfaz tudo para o e-mail poder ser usado numa nova tentativa.
    if (barbershop) await admin.from("barbershops").delete().eq("id", barbershop.id);
    await admin.auth.admin.deleteUser(userId);
    return fail("Não foi possível criar a barbearia. Tente novamente.");
  }

  await admin
    .from("services")
    .insert(STARTER_SERVICES.map((s) => ({ ...s, barbershop_id: barbershop.id })));

  const supabase = await createClient();
  await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  redirect("/admin?bemvindo=1");
}
