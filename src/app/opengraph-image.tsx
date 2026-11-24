import { ImageResponse } from "next/og";
import { OG_SIZE, OgCard } from "@/lib/og-card";

export const alt = "Barbearia — Agenda online";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <OgCard
        title="Agenda online para barbearias"
        subtitle="Seus clientes agendam pelo link. Você confirma pelo WhatsApp com um toque."
        badge="Barbearia"
      />
    ),
    size,
  );
}
