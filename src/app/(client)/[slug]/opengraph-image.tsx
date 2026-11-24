import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { OG_SIZE, OgCard } from "@/lib/og-card";

export const alt = "Agende seu horário online";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Service role com só as colunas da imagem: a prévia não depende da policy
  // de leitura de barbershops.
  const { data } = await createAdminClient()
    .from("barbershops")
    .select("name, address")
    .eq("slug", slug)
    .maybeSingle();

  return new ImageResponse(
    (
      <OgCard
        title={data?.name ?? "Agende seu horário"}
        subtitle={data?.address}
        badge="Agende online"
      />
    ),
    size,
  );
}
