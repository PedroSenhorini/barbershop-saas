import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

/**
 * Client autenticado via cookies de sessão — use em Server Components,
 * Server Actions e Route Handlers que agem em nome do usuário logado
 * (respeita RLS normalmente).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado de um Server Component sem permissão de escrita de
            // cookies — inofensivo, o middleware já cuida do refresh de sessão.
          }
        },
      },
    },
  );
}
