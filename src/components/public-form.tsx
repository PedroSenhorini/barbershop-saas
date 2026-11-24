"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Honeypot, Turnstile } from "@/components/anti-spam";
import type { FormState } from "@/components/action-form";
import { Button } from "@/components/ui/button";

/** Formulário público (sem login) com campo-isca e captcha opcional. */
export function PublicForm({
  action,
  hidden,
  children,
  submitLabel,
  successTitle,
  successText,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  hidden: Record<string, string>;
  children: React.ReactNode;
  submitLabel: string;
  successTitle: string;
  successText: string;
}) {
  const [state, formAction, isPending] = useActionState(action, { error: null });
  // Token do captcha vale uma vez: troca a key para pedir outro após erro.
  const [attempt, setAttempt] = useState(0);

  if (state.ok) {
    return (
      <div className="space-y-2 rounded-xl border bg-card p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-emerald-600 dark:text-emerald-400" />
        <p className="text-lg font-semibold">{successTitle}</p>
        <p className="text-sm text-muted-foreground">{successText}</p>
      </div>
    );
  }

  return (
    <form action={formAction} onSubmit={() => setAttempt((n) => n + 1)} className="relative space-y-4">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Honeypot />
      {children}
      <Turnstile key={attempt} />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" size="lg" disabled={isPending} className="h-12 w-full gap-2 text-base">
        {isPending && <Loader2 className="size-4 animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  );
}
