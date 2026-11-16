"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import { addStaffMember } from "./actions";

export function AddStaffDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(addStaffMember, { error: null });

  // Fecha só quando o servidor confirmou (antes fechava mesmo com erro).
  const [handledOk, setHandledOk] = useState(state.ok);
  if (state.ok !== handledOk) {
    setHandledOk(state.ok);
    setOpen(false);
  }

  useEffect(() => {
    if (state.ok) {
      toast.success("Pronto! Passe o e-mail e a senha para a pessoa entrar no painel.");
    }
  }, [state.ok]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="lg" className="h-10 gap-1.5">
            <Plus className="size-4" />
            Adicionar
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar à equipe</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Nome</Label>
            <Input id="fullName" name="fullName" required className="h-11 text-base" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail (para entrar no painel)</Label>
            <Input id="email" name="email" type="email" required className="h-11 text-base" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha inicial</Label>
            <Input
              id="password"
              name="password"
              type="text"
              minLength={6}
              required
              autoComplete="off"
              className="h-11 text-base"
            />
            <p className="text-xs text-muted-foreground">Mínimo 6 caracteres.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Função</Label>
            <NativeSelect id="role" name="role" defaultValue="barber">
              <option value="barber">Barbeiro (só vê a agenda)</option>
              <option value="owner">Dono (acesso total)</option>
            </NativeSelect>
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={isPending}>
            {isPending ? <Loader2 className="size-5 animate-spin" /> : "Adicionar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
