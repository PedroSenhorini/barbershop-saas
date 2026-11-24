import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Dados públicos de uma barbearia pelo link /<slug>. A tabela barbershops não
 * tem leitura anônima (ver supabase/schema.sql): sem isso, qualquer um com a
 * anon key listaria telefone, plano, código de indicação e situação de
 * pagamento de todas as barbearias. Aqui buscamos pelo servidor (service role)
 * e devolvemos só o que as páginas públicas mostram. Cacheado por request:
 * metadata e página não repetem a consulta.
 */
export const loadPublicBarbershop = cache(async (slug: string) => {
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return null;
  const { data, error } = await createAdminClient()
    .from("barbershops")
    .select("id, name, slug, phone, address, timezone, weekly_hours, active, about, instagram, meta_pixel_id")
    .eq("slug", slug)
    .maybeSingle();
  // Sem isso, um erro do banco (ex.: coluna nova sem rodar o schema.sql, ou
  // SUPABASE_SERVICE_ROLE_KEY errada) aparece só como "Barbearia não encontrada".
  if (error) console.error(`[public-barbershop] erro ao buscar "${slug}": ${error.message}`);
  return data;
});
