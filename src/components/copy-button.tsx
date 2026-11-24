"use client";

import { Copy, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="gap-1.5"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast.success("Copiado!");
        } catch {
          toast.error("Não foi possível copiar. Selecione e copie manualmente.");
        }
      }}
    >
      <Copy className="size-3.5" />
      {label}
    </Button>
  );
}

export function PrintButton() {
  return (
    <Button type="button" className="h-11 gap-2 print:hidden" onClick={() => window.print()}>
      <Printer className="size-4" />
      Imprimir
    </Button>
  );
}
