"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Automático", icon: Monitor },
] as const;

/** false no servidor e na hidratação: o tema salvo só existe no navegador. */
function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/** Botão compacto para cabeçalhos: alterna claro ↔ escuro. */
export function ThemeToggleButton({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === "dark";
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("text-muted-foreground", className)}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Usar tema claro" : "Usar tema escuro"}
      title={isDark ? "Tema claro" : "Tema escuro"}
    >
      {/* Antes de montar mostra a lua: evita trocar o ícone na hidratação. */}
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

/** Seletor completo (Claro / Escuro / Automático), para a tela Mais. */
export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  return (
    <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const selected = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(value)}
            className={cn(
              "flex h-16 flex-col items-center justify-center gap-1 rounded-xl border bg-card text-sm font-medium transition active:scale-[0.98]",
              selected ? "border-primary ring-2 ring-primary/30" : "text-muted-foreground hover:border-primary/50",
            )}
          >
            <Icon className="size-5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
