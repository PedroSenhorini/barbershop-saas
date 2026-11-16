import { requireOwnerPage } from "@/lib/auth";
import type { Service } from "@/lib/supabase/types";
import { ServiceList } from "./service-list";

export default async function ServicesPage() {
  const { supabase } = await requireOwnerPage();

  const { data: services } = await supabase
    .from("services")
    .select("*")
    .order("active", { ascending: false })
    .order("price");

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4 md:p-6">
      <ServiceList services={(services ?? []) as Service[]} />
    </div>
  );
}
