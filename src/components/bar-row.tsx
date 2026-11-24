import { cn } from "@/lib/utils";

/**
 * Linha de gráfico de barras horizontal, só com CSS: rótulo, barra
 * proporcional ao maior valor e o número. Lê bem no celular e não precisa de
 * biblioteca de gráfico.
 */
export function BarRow({
  label,
  value,
  max,
  display,
  hint,
  highlight,
}: {
  label: string;
  value: number;
  max: number;
  display: string;
  hint?: string;
  highlight?: boolean;
}) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <li className="space-y-1 px-4 py-2.5 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <span className={cn("min-w-0 truncate", highlight && "font-semibold")}>{label}</span>
        <span className="shrink-0 font-medium tabular-nums">{display}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className={cn("h-full rounded-full", highlight ? "bg-primary" : "bg-primary/50")}
          style={{ width: `${value > 0 ? width : 0}%` }}
        />
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </li>
  );
}
