import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeReferralCode } from "@/lib/referral";
import { SignUpForm } from "./signup-form";

/**
 * Cadastro de barbearia. Com ?ref=CODIGO (link "indique e ganhe" da tela
 * Plano), confere o código e manda junto no formulário; a action grava quem
 * indicou em barbershops.referred_by.
 */
export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ ref?: string | string[] }> }) {
  const code = normalizeReferralCode((await searchParams).ref);
  let referrerName: string | null = null;
  if (code) {
    // Service role: a tabela barbershops não tem leitura anônima.
    const { data } = await createAdminClient()
      .from("barbershops")
      .select("name")
      .eq("referral_code", code)
      .maybeSingle();
    referrerName = data?.name ?? null;
  }
  return <SignUpForm referralCode={referrerName ? code : null} referrerName={referrerName} />;
}
