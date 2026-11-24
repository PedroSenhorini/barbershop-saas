"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Navegação entre dias da agenda. Trocar de dia é uma navegação do servidor,
 * que mantém a tela antiga até a nova chegar; enquanto isso mostramos um
 * esqueleto no lugar da agenda, para o toque ter resposta imediata.
 */
export function DaySwitcher({
  label,
  sublabel,
  prevHref,
  nextHref,
  todayHref,
  children,
}: {
  label: string;
  sublabel: string;
  prevHref: string;
  nextHref: string;
  /** Link para voltar a hoje; null quando já é hoje. */
  todayHref: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const go = (href: string) => startTransition(() => router.push(href));

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon-lg" aria-label="Dia anterior" onClick={() => go(prevHref)}>
          <ChevronLeft className="size-5" />
        </Button>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="text-lg font-semibold leading-tight">{label}</h1>
          <p className="text-sm capitalize text-muted-foreground">{sublabel}</p>
        </div>
        <Button variant="outline" size="icon-lg" aria-label="Próximo dia" onClick={() => go(nextHref)}>
          <ChevronRight className="size-5" />
        </Button>
      </div>
      {todayHref && (
        <div className="text-center">
          <Button variant="link" size="sm" onClick={() => go(todayHref)}>
            Voltar para hoje
          </Button>
        </div>
      )}

      {pending ? <AgendaSkeleton /> : children}
    </>
  );
}

function AgendaSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando agenda">
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[62px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-11 w-48 rounded-lg" />
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[92px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
