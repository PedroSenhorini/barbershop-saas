import { cn } from "@/lib/utils";

/**
 * <select> nativo estilizado. No celular abre o seletor do próprio sistema,
 * que é mais rápido de usar do que um dropdown customizado.
 */
export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}
