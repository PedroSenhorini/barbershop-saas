"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** `notice` substitui a mensagem de sucesso padrão (ex.: "8 criados, 2 pulados"). */
export type FormState = { error: string | null; ok?: number; notice?: string };

/**
 * Formulário ligado a uma server action no formato (prev, formData) → FormState.
 * Mostra o erro, avisa o sucesso e, se `resetOnSuccess`, limpa os campos.
 */
export function ActionForm({
  action,
  children,
  submitLabel = "Salvar",
  successMessage = "Salvo!",
  resetOnSuccess,
  className,
  submitClassName,
  submitVariant,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submitLabel?: string;
  successMessage?: string;
  resetOnSuccess?: boolean;
  className?: string;
  submitClassName?: string;
  submitVariant?: "default" | "outline" | "secondary" | "destructive" | "ghost";
}) {
  const [state, formAction, isPending] = useActionState(action, { error: null });
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.ok) return;
    toast.success(state.notice ?? successMessage);
    if (resetOnSuccess) ref.current?.reset();
  }, [state.ok, state.notice, successMessage, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={cn("space-y-3", className)}>
      {children}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button
        type="submit"
        variant={submitVariant}
        disabled={isPending}
        className={cn("h-11 gap-2", submitClassName)}
      >
        {isPending && <Loader2 className="size-4 animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  );
}

/** Botão de uma ação só (excluir, marcar como feito) com os dados em campos ocultos. */
export function ActionButton({
  action,
  fields,
  children,
  variant = "outline",
  size = "sm",
  className,
  confirm,
  successMessage,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  fields: Record<string, string>;
  children: React.ReactNode;
  variant?: "default" | "outline" | "secondary" | "destructive" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
  /** Pergunta de confirmação antes de enviar. */
  confirm?: string;
  successMessage?: string;
}) {
  const [state, formAction, isPending] = useActionState(action, { error: null });

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);
  useEffect(() => {
    if (state.ok && (state.notice ?? successMessage)) toast.success(state.notice ?? successMessage);
  }, [state.ok, state.notice, successMessage]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Button type="submit" variant={variant} size={size} disabled={isPending} className={className}>
        {isPending ? <Loader2 className="size-4 animate-spin" /> : children}
      </Button>
    </form>
  );
}
