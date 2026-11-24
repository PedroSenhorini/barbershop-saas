"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { parseMoney } from "@/lib/finance";
import type { CashCount } from "@/lib/supabase/types";
import { saveCashCount } from "./actions";

/**
 * Conferência do fim do dia: o sistema sabe quanto entrou em dinheiro pelos
 * atendimentos; o dono conta a gaveta e vê na hora se sobrou ou faltou.
 */
export function CashCountForm({
  day,
  expected,
  saved,
}: {
  day: string;
  expected: number;
  saved: CashCount | null;
}) {
  const [counted, setCounted] = useState(saved ? Number(saved.counted).toFixed(2).replace(".", ",") : "");
  const [notes, setNotes] = useState(saved?.notes ?? "");
  const [pending, startTransition] = useTransition();

  const value = parseMoney(counted);
  const diff = value === null ? null : Math.round((value - expected) * 100) / 100;

  function save() {
    startTransition(async () => {
      const result = await saveCashCount(day, counted, notes);
      if ("error" in result) toast.error(result.error);
      else toast.success("Conferência salva");
    });
  }

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">Conferência do dinheiro</h2>
        <p className="text-sm text-muted-foreground">
          Esperado: <span className="font-semibold text-foreground">{formatCurrency(expected)}</span>
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="counted">Quanto tem na gaveta (R$)</Label>
        <Input
          id="counted"
          inputMode="decimal"
          placeholder="0,00"
          className="h-11 text-base"
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
        />
      </div>

      {diff !== null && (
        <p
          className={cn(
            "rounded-lg px-3 py-2 text-sm font-medium",
            diff === 0 && "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200",
            diff > 0 && "bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200",
            diff < 0 && "bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200",
          )}
        >
          {diff === 0
            ? "Bateu certinho ✓"
            : diff > 0
              ? `Sobrou ${formatCurrency(diff)}`
              : `Faltou ${formatCurrency(-diff)}`}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="notes">Observação (opcional)</Label>
        <Input
          id="notes"
          className="h-11 text-base"
          placeholder="Ex.: troco inicial de R$ 50"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <Button className="h-11 w-full" disabled={pending || value === null} onClick={save}>
        {pending ? <Loader2 className="size-5 animate-spin" /> : saved ? "Atualizar conferência" : "Salvar conferência"}
      </Button>
      {saved && (
        <p className="text-center text-xs text-muted-foreground">
          Conferência salva: {formatCurrency(Number(saved.counted))} contados.
        </p>
      )}
    </section>
  );
}
