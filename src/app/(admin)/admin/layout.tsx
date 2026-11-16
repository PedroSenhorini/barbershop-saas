import { AlertTriangle, LogOut, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth";
import { signOut } from "./actions";
import { BottomNav, SideNav } from "./admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, barbershop } = await requireStaff();
  const isOwner = profile.role === "owner";

  return (
    <div className="flex min-h-dvh bg-muted/20">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-background p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <Scissors className="size-5 text-primary" />
          <span className="truncate font-semibold">{barbershop.name}</span>
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
        <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <Scissors className="size-5 shrink-0 text-primary" />
            <span className="truncate font-semibold">{barbershop.name}</span>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <LogOut className="size-4" />
              Sair
            </Button>
          </form>
        </header>

        {!barbershop.active && (
          <div className="flex items-start gap-2 border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              Sua assinatura está pendente e o agendamento online foi pausado.
              Fale com o suporte para reativar.
            </p>
          </div>
        )}

        <main className="flex-1 pb-24 md:pb-8">{children}</main>
      </div>

      <BottomNav isOwner={isOwner} />
    </div>
  );
}
