import { Trash2 } from "lucide-react";
import { ActionButton, ActionForm } from "@/components/action-form";
import { fieldClass } from "@/components/page-ui";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import type { CashMovement } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { addCashMovement, deleteCashMovement } from "./movement-actions";

const LABEL = { abertura: "Troco inicial", suprimento: "Reforço (suprimento)", sangria: "Retirada (sangria)" } as const;

/** Abertura, sangria e suprimento da gaveta no dia. */
export function CashMovements({ day, movements }: { day: string; movements: CashMovement[] }) {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h3 className="font-semibold">Gaveta</h3>
        <p className="text-xs text-muted-foreground">
          Troco que começou na gaveta, dinheiro que entrou de fora e o que foi retirado. Entra na conta do “esperado”.
        </p>
      </div>
      {movements.length > 0 && (
        <ul className="divide-y text-sm">
          {movements.map((m) => (
            <li key={m.id} className="flex items-center gap-2 py-2">
              <span className="min-w-0 flex-1 truncate">
                {LABEL[m.kind]}
                {m.notes ? <span className="text-muted-foreground"> · {m.notes}</span> : null}
              </span>
              <span className={cn("font-medium tabular-nums", m.kind === "sangria" && "text-destructive")}>
                {m.kind === "sangria" ? "−" : "+"}
                {formatCurrency(Number(m.amount))}
              </span>
              <ActionButton action={deleteCashMovement} fields={{ id: m.id }} variant="ghost" confirm="Remover este lançamento?">
                <Trash2 className="size-4" />
              </ActionButton>
            </li>
          ))}
        </ul>
      )}
      <ActionForm action={addCashMovement} submitLabel="Lançar" successMessage="Lançado!" resetOnSuccess className="flex flex-wrap items-start gap-2 space-y-0" submitClassName="h-11">
        <input type="hidden" name="day" value={day} />
        <select name="kind" aria-label="Tipo" className={cn(fieldClass, "w-auto")} defaultValue={movements.some((m) => m.kind === "abertura") ? "sangria" : "abertura"}>
          {Object.entries(LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <Input name="amount" inputMode="decimal" required placeholder="Valor" aria-label="Valor" className="h-11 w-28" />
        <Input name="notes" maxLength={120} placeholder="Obs. (opcional)" aria-label="Observação" className="h-11 min-w-32 flex-1" />
      </ActionForm>
    </div>
  );
}
