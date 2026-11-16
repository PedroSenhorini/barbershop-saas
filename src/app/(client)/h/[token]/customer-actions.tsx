"use client";

import { useState, useTransition } from "react";
import { Car, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { respondToAppointment, type CustomerAction } from "./actions";

export function CustomerActions({
  token,
  canConfirm,
  canGo,
  canCancel,
  goHint,
}: {
  token: string;
  canConfirm: boolean;
  canGo: boolean;
  canCancel: boolean;
  /** Confirmado, mas ainda não é o dia: explica quando o botão aparece. */
  goHint: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState<CustomerAction | null>(null);
  // Cancelar pede um segundo toque, para ninguém cancelar sem querer.
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  function run(action: CustomerAction, success: string) {
    setRunning(action);
    startTransition(async () => {
      const result = await respondToAppointment(token, action);
      setRunning(null);
      setConfirmingCancel(false);
      if ("error" in result) toast.error(result.error);
      else toast.success(success);
    });
  }

  if (!canConfirm && !canGo && !canCancel) return null;

  const spinner = (action: CustomerAction) =>
    running === action ? <Loader2 className="size-5 animate-spin" /> : null;

  return (
    <div className="space-y-3">
      {canConfirm && (
        <Button
          size="lg"
          className="h-14 w-full gap-2 text-base"
          disabled={pending}
          onClick={() => run("confirmar", "Presença confirmada!")}
        >
          {spinner("confirmar") ?? <CheckCircle2 className="size-5" />}
          Confirmo presença
        </Button>
      )}
      {canGo && (
        <Button
          size="lg"
          variant={canConfirm ? "outline" : "default"}
          className="h-14 w-full gap-2 text-base"
          disabled={pending}
          onClick={() => run("a_caminho", "Avisamos a barbearia!")}
        >
          {spinner("a_caminho") ?? <Car className="size-5" />}
          Estou a caminho
        </Button>
      )}
      {goHint && (
        <p className="text-center text-sm text-muted-foreground">
          No dia do horário, volte aqui para avisar que está a caminho.
        </p>
      )}
      {canCancel &&
        (confirmingCancel ? (
          <div className="space-y-2 rounded-xl border border-destructive/30 p-3">
            <p className="text-center text-sm font-medium">Cancelar este horário?</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-11" disabled={pending} onClick={() => setConfirmingCancel(false)}>
                Voltar
              </Button>
              <Button
                variant="destructive"
                className="h-11"
                disabled={pending}
                onClick={() => run("cancelar", "Horário cancelado.")}
              >
                {spinner("cancelar") ?? "Sim, cancelar"}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            className="h-11 w-full text-destructive"
            disabled={pending}
            onClick={() => setConfirmingCancel(true)}
          >
            Preciso cancelar
          </Button>
        ))}
    </div>
  );
}
