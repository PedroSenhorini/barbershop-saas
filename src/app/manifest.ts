import type { MetadataRoute } from "next";

/**
 * Permite instalar o painel na tela inicial do celular ("Adicionar à tela de
 * início"): abre direto na agenda, sem barra do navegador.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Barbearia — Agenda online",
    short_name: "Barbearia",
    description: "Agenda da barbearia: confirme clientes pelo WhatsApp com um toque.",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // O app só tem tema claro: o fundo da tela de abertura é o mesmo da página.
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
