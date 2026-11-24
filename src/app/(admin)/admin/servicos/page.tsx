import { requireOwnerPage } from "@/lib/auth";
import type { Service } from "@/lib/supabase/types";
import { ServiceList } from "./service-list";

export default async function ServicesPage() {
  const { supabase, barbershop } = await requireOwnerPage();

  const { data: services } = await supabase
    .from("services")
    .select("*")
    // Sem este filtro, a RLS (serviço ativo é público) traria os de todas as barbearias.
    .eq("barbershop_id", barbershop.id)
    .order("active", { ascending: false })
    .order("price");

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4 md:p-6">
      <ServiceList services={(services ?? []) as Service[]} />
    </div>
  );
}
