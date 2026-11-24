"use client";

import { useSyncExternalStore } from "react";
import { Share, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Card que ensina a instalar o painel na tela inicial do celular. Some de vez
 * quando dispensado (lembrado neste aparelho) e não aparece quando o painel
 * já está aberto como app instalado.
 */

const DISMISS_KEY = "painel:instalar-dispensado";
type Platform = "ios" | "android" | null;

const listeners = new Set<() => void>();
let dismissedFallback = false;

function isDismissed() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return dismissedFallback;
  }
}

function readPlatform(): Platform {
  if (isDismissed()) return null;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return null;

  const ua = navigator.userAgent;
  // iPadOS se apresenta como Mac; o toque denuncia.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return null; // computador: não faz sentido
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function dismiss() {
  dismissedFallback = true;
  try {
    window.localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Sem localStorage: some só nesta visita.
  }
  listeners.forEach((l) => l());
}

export function InstallAppCard() {
  // No servidor e na primeira pintura não sabemos o aparelho: nada aparece.
  const platform = useSyncExternalStore(subscribe, readPlatform, () => null);
  if (!platform) return null;

  return (
    <aside className="relative flex gap-3 rounded-xl border bg-card p-4 pr-12">
      <Smartphone className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 space-y-1 text-sm">
        <p className="font-medium">Use a agenda como um app</p>
        {platform === "ios" ? (
          <p className="text-muted-foreground">
            No Safari, toque em <Share className="inline size-4 align-text-bottom" aria-label="Compartilhar" />{" "}
            <b className="font-medium text-foreground">Compartilhar</b> e depois em{" "}
            <b className="font-medium text-foreground">Adicionar à Tela de Início</b>.
          </p>
        ) : (
          <p className="text-muted-foreground">
            No Chrome, toque no menu <b className="font-medium text-foreground">⋮</b> e depois em{" "}
            <b className="font-medium text-foreground">Adicionar à tela inicial</b> (ou{" "}
            <b className="font-medium text-foreground">Instalar app</b>).
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Dispensar"
        className="absolute right-1 top-1"
        onClick={dismiss}
      >
        <X className="size-4" />
      </Button>
    </aside>
  );
}
