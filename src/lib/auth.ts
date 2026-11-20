import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Barbershop, StaffUser } from "@/lib/supabase/types";

/**
 * Sessão do painel: usuário logado + perfil de staff + barbearia. Cacheado por
 * request para o layout e a página não repetirem as mesmas consultas.
 */
export const getStaffContext = cache(async () => {
  const supabase = await createClient();
  // getClaims valida o JWT localmente (chaves assimétricas do projeto), sem a
  // ida ao servidor de auth que o getUser faz a cada chamada.
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return null;

  const { data } = await supabase
    .from("users")
    .select("*, barbershop:barbershops(*)")
    .eq("id", userId)
    .single();

  if (!data || !data.active) return null;

  const { barbershop, ...profile } = data as StaffUser & {
    barbershop: Barbershop;
  };
  return { supabase, profile: profile as StaffUser, barbershop };
});

export async function requireStaff() {
  const ctx = await getStaffContext();
  if (!ctx) redirect("/sair");
  return ctx;
}

export async function requireOwnerPage() {
  const ctx = await requireStaff();
  if (ctx.profile.role !== "owner") redirect("/admin");
  return ctx;
}
