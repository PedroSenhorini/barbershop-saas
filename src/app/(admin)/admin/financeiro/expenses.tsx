"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import { formatCurrency } from "@/lib/format";
import { EXPENSE_CATEGORIES, EXPENSE_LABEL } from "@/lib/finance";
import type { Expense } from "@/lib/supabase/types";
import { addExpense, deleteExpense } from "./actions";

export function ExpenseList({ expenses, defaultDate }: { expenses: Expense[]; defaultDate: string }) {
  const [open, setOpen] = useState(false);
  const [deleting, startDeleting] = useTransition();

  function remove(e: Expense) {
    if (!window.confirm(`Excluir "${e.description}" (${formatCurrency(Number(e.amount))})?`)) return;
    startDeleting(async () => {
      const result = await deleteExpense(e.id);
      if ("error" in result) toast.error(result.error);
      else toast.success("Gasto excluído");
    });
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Gastos lançados</h2>
        <Button className="h-9 gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          Lançar gasto
        </Button>
      </div>

      {expenses.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhum gasto neste mês. Aluguel, luz, produtos, equipamentos: lance tudo aqui.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {expenses.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="w-12 shrink-0 tabular-nums text-muted-foreground">
                {`${e.spent_on.slice(8, 10)}/${e.spent_on.slice(5, 7)}`}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{e.description}</span>
                <span className="block text-muted-foreground">{EXPENSE_LABEL[e.category]}</span>
              </span>
              <span className="font-semibold">{formatCurrency(Number(e.amount))}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Excluir gasto"
                disabled={deleting}
                onClick={() => remove(e)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ExpenseDialog open={open} onOpenChange={setOpen} defaultDate={defaultDate} />
    </section>
  );
}

function ExpenseDialog({
  open,
  onOpenChange,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate: string;
}) {
  const [state, formAction, isPending] = useActionState(addExpense, { error: null });

  // Fecha só quando o servidor confirmou.
  const [handledOk, setHandledOk] = useState(state.ok);
  if (state.ok !== handledOk) {
    setHandledOk(state.ok);
    onOpenChange(false);
  }
  useEffect(() => {
    if (state.ok) toast.success("Gasto lançado");
  }, [state.ok]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lançar gasto</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="category">Categoria</Label>
            <NativeSelect id="category" name="category" defaultValue="outros">
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {EXPENSE_LABEL[c]}
                </option>
              ))}
            </NativeSelect>
            <p className="text-xs text-muted-foreground">
              Comprou produto para o estoque? Use a aba Estoque: ela soma a quantidade e lança o gasto junto.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              name="description"
              required
              placeholder="Ex.: Aluguel de novembro"
              className="h-11 text-base"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input id="amount" name="amount" required inputMode="decimal" placeholder="0,00" className="h-11 text-base" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spentOn">Data</Label>
              <Input id="spentOn" name="spentOn" type="date" required defaultValue={defaultDate} className="h-11 text-base" />
            </div>
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={isPending}>
            {isPending ? <Loader2 className="size-5 animate-spin" /> : "Lançar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
