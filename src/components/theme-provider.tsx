"use client";

import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";

/** Cor da barra do navegador/celular em cada tema (igual ao --background). */
const BAR_COLOR = { light: "#ffffff", dark: "#0a0a0a" } as const;

/**
 * Mantém a cor da barra do celular igual ao tema escolhido no app, mesmo
 * quando ele é diferente do tema do sistema (as metas do layout seguem só o
 * sistema).
 */
function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") return;
    document
      .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      .forEach((meta) => meta.setAttribute("content", BAR_COLOR[resolvedTheme]));
  }, [resolvedTheme]);
  return null;
}

/**
 * Tema claro (branco) / escuro (preto) / automático (segue o celular). A
 * escolha fica salva no navegador; a classe `dark` no <html> liga as cores do
 * .dark em globals.css.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="barbearia:tema"
    >
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  );
}
