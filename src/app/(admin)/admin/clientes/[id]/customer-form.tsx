"use client";

import { useActionState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveCustomer } from "../actions";

export function CustomerForm({
  customer,
}: {
  customer: { id: string; name: string; notes: string | null; tags: string[] };
}) {
  const [state, formAction, isPending] = useActionState(saveCustomer, { error: null });

  useEffect(() => {
    if (state.ok) toast.success("Cliente salvo!");
  }, [state.ok]);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border bg-card p-4">
      <input type="hidden" name="id" value={customer.id} />
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={120}
          defaultValue={customer.name}
          className="h-11 text-base"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tags">Etiquetas</Label>
        <Input
          id="tags"
          name="tags"
          defaultValue={(customer.tags ?? []).join(", ")}
          placeholder="vip, degradê, aniversário em março"
          className="h-11 text-base"
        />
        <p className="text-xs text-muted-foreground">Separe por vírgula. Dá para filtrar a lista de clientes por etiqueta.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Observações da equipe</Label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          maxLength={1000}
          defaultValue={customer.notes ?? ""}
          placeholder="Ex.: degradê na máquina 1, não gosta de conversa, alergia a pomada X"
          className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
        />
        <p className="text-xs text-muted-foreground">Só a equipe vê. O cliente não tem acesso.</p>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={isPending} className="h-11 w-full gap-2 sm:w-auto">
        {isPending && <Loader2 className="size-4 animate-spin" />}
        Salvar
      </Button>
    </form>
  );
}
