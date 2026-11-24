"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Loader2, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Honeypot, Turnstile } from "@/components/anti-spam";
import { maskPhone } from "@/lib/format";
import { signUp } from "./actions";

/** `referralCode`: código válido de quem indicou (/cadastro?ref=CODIGO), já conferido no servidor. */
export function SignUpForm({ referralCode, referrerName }: { referralCode: string | null; referrerName: string | null }) {
  const [state, formAction, isPending] = useActionState(signUp, { error: null });
  const [phone, setPhone] = useState("");

  return (
    <div className="flex min-h-dvh items-start justify-center bg-muted/30 px-4 py-10 sm:items-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Scissors className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold">Crie sua agenda online</h1>
          <p className="text-sm text-muted-foreground">
            Em 1 minuto você tem um link para seus clientes agendarem sozinhos.
          </p>
          {referrerName && (
            <p className="mx-auto w-fit rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-200">
              Indicação de {referrerName}
            </p>
          )}
        </div>

        <form action={formAction} className="relative space-y-4 rounded-xl border bg-card p-5">
          <Field label="Nome da barbearia" name="barbershopName" placeholder="Ex.: Barbearia do Zé" autoFocus defaultValue={state.values?.barbershopName} />
          <Field label="Seu nome" name="fullName" autoComplete="name" defaultValue={state.values?.fullName} />
          <div className="space-y-1.5">
            <Label htmlFor="phone">WhatsApp da barbearia</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              required
              className="h-11 text-base"
              placeholder="(11) 91234-5678"
              value={maskPhone(phone)}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <Field label="E-mail" name="email" type="email" autoComplete="email" defaultValue={state.values?.email} />
          <Field
            label="Crie uma senha"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={6}
            placeholder="Mínimo 6 caracteres"
          />

          <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
            <input
              type="checkbox"
              name="takesAppointments"
              defaultChecked
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              <span className="font-medium">Eu também atendo clientes</span>
              <span className="block text-muted-foreground">
                Desmarque se você só administra a barbearia.
              </span>
            </span>
          </label>

          {referralCode && <input type="hidden" name="ref" value={referralCode} />}
          <Honeypot />
          <Turnstile key={state.attempt ?? 0} />

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={isPending}>
            {isPending ? <Loader2 className="size-5 animate-spin" /> : "Criar minha barbearia"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link href="/login" className="inline-flex min-h-11 items-center px-1 font-medium text-primary hover:underline md:min-h-0">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.ComponentProps<"input">) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      {/* Base UI não aceita defaultValue mudando após montar: a key remonta o input
          quando a action devolve os valores após um erro. */}
      <Input
        key={String(props.defaultValue ?? "")}
        id={name}
        name={name}
        required
        className="h-11 text-base"
        {...props}
      />
    </div>
  );
}
