import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Encerra a sessão e volta para o login. Usado quando há sessão válida mas sem
 * perfil de staff ativo (ex.: barbeiro removido da equipe) — sem isso, o proxy
 * mandaria /login → /admin → /login em loop.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}
