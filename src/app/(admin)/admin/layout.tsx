import Link from "next/link";
import { AlertTriangle, Clock, LogOut, Scissors } from "lucide-react";
import { ThemeToggleButton } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth";
import { trialDaysLeft, trialNotice } from "@/lib/plan";
import { signOut } from "./actions";
import { BottomNav, SideNav } from "./admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, barbershop } = await requireStaff();
  const isOwner = profile.role === "owner";
  // Aviso de teste só para o dono, e só na última semana (antes disso, só na tela Plano).
  const daysLeft = trialDaysLeft(barbershop);
  const trial = isOwner && daysLeft !== null && daysLeft <= 7 ? trialNotice(daysLeft) : null;

  return (
    <div className="flex min-h-dvh bg-muted/20">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-background p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 pl-2">
          <Scissors className="size-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate font-semibold">{barbershop.name}</span>
          <ThemeToggleButton />
        </div>
        <SideNav isOwner={isOwner} />
        <div className="border-t pt-3">
          <p className="truncate px-2 text-sm font-medium">{profile.full_name}</p>
          <p className="px-2 text-xs text-muted-foreground">
            {isOwner ? "Dono" : "Barbeiro"}
          </p>
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              className="mt-2 w-full justify-start gap-2 text-muted-foreground"
            >
              <LogOut className="size-4" />
              Sair
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <Scissors className="size-5 shrink-0 text-primary" />
            <span className="truncate font-semibold">{barbershop.name}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggleButton />
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                <LogOut className="size-4" />
                Sair
              </Button>
            </form>
          </div>
        </header>

        {!barbershop.active && (
          <div className="flex items-start gap-2 border-b border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              Sua assinatura está pendente e o agendamento online foi pausado.
              Fale com o suporte para reativar.
            </p>
          </div>
        )}

        {trial && barbershop.active && (
          <Link
            href="/admin/plano"
            className="flex items-center gap-2 border-b border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 px-4 py-2.5 text-sm text-sky-900 dark:text-sky-200 transition hover:bg-sky-100 dark:hover:bg-sky-900/40"
          >
            <Clock className="size-4 shrink-0" />
            <span className="min-w-0 flex-1">{trial}</span>
            <span className="shrink-0 font-medium underline underline-offset-2">Ver plano</span>
          </Link>
        )}

        {/* Espaço para a barra de baixo (56px + área segura do iPhone). */}
        <main className="flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8">{children}</main>
      </div>

      <BottomNav isOwner={isOwner} />
    </div>
  );
}
