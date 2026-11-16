"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import { formatCurrency, formatDuration } from "@/lib/format";
import type { Service } from "@/lib/supabase/types";
import { deleteService, saveService } from "./actions";

const DURATIONS = [15, 20, 30, 40, 45, 60, 75, 90, 120, 150, 180];

export function ServiceList({ services }: { services: Service[] }) {
  // undefined = fechado, null = novo serviço
  const [editing, setEditing] = useState<Service | null | undefined>(undefined);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Serviços</h1>
          <p className="text-sm text-muted-foreground">
            O que seus clientes podem agendar, com preço e duração.
          </p>
        </div>
        <Button size="lg" className="h-10 gap-1.5" onClick={() => setEditing(null)}>
          <Plus className="size-4" />
          Novo
        </Button>
      </div>

      {services.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
          Nenhum serviço ainda. Toque em <b>Novo</b> para criar o primeiro.
        </div>
      ) : (
        <ul className="space-y-2">
          {services.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => setEditing(s)}
                className="flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left transition hover:border-primary"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">
                    <span className="truncate">{s.name}</span>
                    {!s.active && <Badge variant="secondary">Oculto</Badge>}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDuration(s.duration_minutes)}
                  </p>
                </div>
                <p className="font-semibold">{formatCurrency(Number(s.price))}</p>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing !== undefined && (
        <ServiceDialog
          key={editing?.id ?? "new"}
          service={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  );
}

function ServiceDialog({ service, onClose }: { service: Service | null; onClose: () => void }) {
  const [state, formAction, isPending] = useActionState(saveService, { error: null });
  const [deleting, startDeleting] = useTransition();

  useEffect(() => {
    if (state.ok) {
      toast.success("Serviço salvo!");
      onClose();
    }
  }, [state.ok, onClose]);

  const durations = service && !DURATIONS.includes(service.duration_minutes)
    ? [...DURATIONS, service.duration_minutes].sort((a, b) => a - b)
    : DURATIONS;

  function remove() {
    if (!service || !window.confirm(`Excluir "${service.name}"?`)) return;
    startDeleting(async () => {
      const result = await deleteService(service.id);
      if ("error" in result) toast.error(result.error);
      else if ("hidden" in result)
        toast.success("Esse serviço já tem agendamentos, então foi só ocultado da sua página.");
      else toast.success("Serviço excluído.");
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{service ? "Editar serviço" : "Novo serviço"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={service?.id ?? ""} />
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" required defaultValue={service?.name} placeholder="Ex.: Corte degradê" className="h-11 text-base" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="price">Preço (R$)</Label>
              <Input
                id="price"
                name="price"
                inputMode="decimal"
                required
                defaultValue={service ? String(service.price).replace(".", ",") : ""}
                placeholder="40,00"
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="durationMinutes">Duração</Label>
              <NativeSelect
                id="durationMinutes"
                name="durationMinutes"
                defaultValue={service?.duration_minutes ?? 30}
              >
                {durations.map((d) => (
                  <option key={d} value={d}>
                    {formatDuration(d)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Input
              id="description"
              name="description"
              defaultValue={service?.description ?? ""}
              placeholder="Ex.: Inclui lavagem e finalização"
              className="h-11 text-base"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked={service?.active ?? true}
              className="size-4 accent-primary"
            />
            Mostrar na minha página de agendamento
          </label>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <div className="flex gap-2">
            {service && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-11"
                aria-label="Excluir serviço"
                disabled={deleting}
                onClick={remove}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
            <Button type="submit" size="lg" className="h-11 flex-1 text-base" disabled={isPending}>
              {isPending ? <Loader2 className="size-5 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
