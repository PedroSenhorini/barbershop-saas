import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Peças repetidas das telas do painel (servidor ou cliente, sem estado). */

export function Page({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn("mx-auto w-full space-y-4 p-4 md:p-6", wide ? "max-w-5xl" : "max-w-3xl")}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  back,
  action,
}: {
  title: string;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      {back && (
        <Link
          href={back.href}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "positive" | "negative" | "warning";
}) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "truncate text-base font-semibold",
          tone === "positive" && "text-emerald-700 dark:text-emerald-400",
          tone === "negative" && "text-destructive",
          tone === "warning" && "text-amber-700 dark:text-amber-400",
        )}
      >
        {value}
      </p>
      {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border bg-card p-4", className)}>{children}</div>;
}

/** Lista com divisórias, no estilo das outras telas. */
export function List({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y overflow-hidden rounded-xl border bg-card">{children}</ul>;
}

export const fieldClass =
  "h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

export const textareaClass =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";
