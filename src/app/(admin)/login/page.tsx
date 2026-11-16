"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "./actions";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(signIn, {
    error: null,
  });

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Scissors className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold">Entrar no painel</h1>
        </div>

        <form action={formAction} className="space-y-4 rounded-xl border bg-card p-5">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required autoFocus className="h-11 text-base" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-11 text-base" />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={isPending}>
            {isPending ? <Loader2 className="size-5 animate-spin" /> : "Entrar"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="font-medium text-primary hover:underline">
            Criar minha barbearia
          </Link>
        </p>
      </div>
    </div>
  );
}
