import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { formatMonth, monthRange } from "@/lib/finance";

/** Navegação de mês por ?mes=AAAA-MM, sem passar do mês atual. */
export function MonthSwitcher({ path, month, current }: { path: string; month: string; current: string }) {
  const { prev, next } = monthRange(month);
  return (
    <div className="flex items-center gap-2">
      <Link href={`${path}?mes=${prev}`} className={buttonVariants({ variant: "outline", size: "icon-lg" })} aria-label="Mês anterior">
        <ChevronLeft className="size-5" />
      </Link>
      <span className="min-w-32 text-center text-sm font-medium capitalize">{formatMonth(month)}</span>
      {next <= current ? (
        <Link href={`${path}?mes=${next}`} className={buttonVariants({ variant: "outline", size: "icon-lg" })} aria-label="Próximo mês">
          <ChevronRight className="size-5" />
        </Link>
      ) : (
        <span className={buttonVariants({ variant: "outline", size: "icon-lg", className: "pointer-events-none opacity-40" })}>
          <ChevronRight className="size-5" />
        </span>
      )}
    </div>
  );
}
