import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Client com a service role key — ignora RLS. Uso exclusivo em código de
 * servidor: agendamento público do cliente, cadastro de barbearia e ações que
 * a sessão não cobre (criar/remover contas). Confira a permissão pela sessão
 * ANTES de usar este client.
 * Nunca importe este arquivo em Client Components.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
