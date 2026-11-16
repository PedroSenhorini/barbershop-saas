"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireOwner() {
  const ctx = await getStaffContext();
  if (!ctx || ctx.profile.role !== "owner") return null;
  return ctx;
}

const addStaffSchema = z.object({
  fullName: z.string().trim().min(2, "Informe o nome."),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres."),
  role: z.enum(["owner", "barber"]),
});

export type AddStaffState = { error: string | null; ok?: number };

/**
 * O dono cria o acesso do barbeiro com uma senha inicial e passa para ele
 * pessoalmente — sem depender de e-mail de convite, que costuma cair no spam.
 */
export async function addStaffMember(
  _prev: AddStaffState,
  formData: FormData,
): Promise<AddStaffState> {
  const ctx = await requireOwner();
  if (!ctx) return { error: "Apenas o dono pode adicionar pessoas à equipe." };

  const parsed = addStaffSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role") ?? "barber",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    return {
      error: createError?.message.toLowerCase().includes("already")
        ? "Esse e-mail já tem uma conta."
        : "Não foi possível criar o acesso.",
    };
  }

  const { error: insertError } = await admin.from("users").insert({
    id: created.user.id,
    barbershop_id: ctx.barbershop.id,
    full_name: parsed.data.fullName,
    role: parsed.data.role,
    takes_appointments: true,
  });
  if (insertError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "Não foi possível adicionar à equipe." };
  }

  revalidatePath("/admin/equipe");
  return { error: null, ok: Date.now() };
}

export async function setTakesAppointments(staffId: string, value: boolean) {
  const ctx = await requireOwner();
  if (!ctx) return { error: "Apenas o dono pode alterar a equipe." };

  const { data, error } = await ctx.supabase
    .from("users")
    .update({ takes_appointments: value })
    .eq("id", staffId)
    .select("id");
  if (error || !data?.length) return { error: "Não foi possível salvar." };

  revalidatePath("/admin/equipe");
  return { success: true as const };
}

export async function removeStaffMember(staffId: string) {
  const ctx = await requireOwner();
  if (!ctx) return { error: "Apenas o dono pode remover pessoas da equipe." };
  if (staffId === ctx.profile.id) return { error: "Você não pode remover a si mesmo." };

  // Confere pela sessão (RLS) que a pessoa é desta barbearia ANTES de usar a
  // service role: um delete bloqueado por RLS não retorna erro, só afeta 0
  // linhas, então não dá para confiar nele como checagem.
  const { data: member } = await ctx.supabase
    .from("users")
    .select("id")
    .eq("id", staffId)
    .eq("barbershop_id", ctx.barbershop.id)
    .maybeSingle();
  if (!member) return { error: "Pessoa não encontrada na sua equipe." };

  const admin = createAdminClient();
  // Apagar o usuário de auth remove o perfil em cascata; agendamentos antigos
  // ficam sem barbeiro (on delete set null), mas não somem.
  const { error } = await admin.auth.admin.deleteUser(staffId);
  if (error) return { error: "Não foi possível remover." };

  revalidatePath("/admin/equipe");
  return { success: true as const };
}
