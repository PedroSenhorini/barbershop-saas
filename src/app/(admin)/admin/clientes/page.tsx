import Link from "next/link";
import { ChevronRight, MessageCircle, Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireStaff } from "@/lib/auth";
import { loadCustomerRows } from "@/lib/customer-data";
import {
  formatDaysAgo,
  matchesCustomerSearch,
  type CustomerInsight,
  type CustomerStatus,
} from "@/lib/customers";
import { formatCurrency, maskPhone } from "@/lib/format";
import { formatTime } from "@/lib/time";
import type { CustomerStats } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { CustomerStatusBadge } from "./status-badge";

type Filter = "todos" | CustomerStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "sumido", label: "Sumidos" },
  { key: "novo", label: "Novos" },
  { key: "ativo", label: "Ativos" },
  { key: "sem_visita", label: "Sem visita" },
];

function filterHref(filter: Filter, q: string, tag?: string | null) {
  const params = new URLSearchParams();
  if (filter !== "todos") params.set("filtro", filter);
  if (q) params.set("q", q);
  if (tag) params.set("etiqueta", tag);
  const s = params.toString();
  return s ? `/admin/clientes?${s}` : "/admin/clientes";
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; q?: string; etiqueta?: string }>;
}) {
  const { supabase, profile, barbershop } = await requireStaff();
  const params = await searchParams;
  const isOwner = profile.role === "owner";
  const q = (params.q ?? "").slice(0, 60);
  const filter: Filter = FILTERS.some((f) => f.key === params.filtro)
    ? (params.filtro as Filter)
    : "todos";

  const all = await loadCustomerRows(supabase);
  const allTags = [...new Set(all.flatMap((r) => r.customer.tags ?? []))].sort((x, y) => x.localeCompare(y, "pt-BR"));
  const tag = params.etiqueta && allTags.includes(params.etiqueta) ? params.etiqueta : null;

  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, 0])) as Record<Filter, number>;
  for (const r of all) {
    counts.todos++;
    counts[r.insight.status]++;
  }

  const rows = all
    .filter((r) => filter === "todos" || r.insight.status === filter)
    .filter((r) => matchesCustomerSearch(r.customer, q))
    .filter((r) => !tag || (r.customer.tags ?? []).includes(tag))
    // Quem veio por último primeiro; quem nunca veio vai para o fim.
    .sort((a, b) => {
      const da = a.insight.daysSinceLastVisit ?? Infinity;
      const db = b.insight.daysSinceLastVisit ?? Infinity;
      return da - db || a.customer.name.localeCompare(b.customer.name, "pt-BR");
    });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold">Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Todo mundo que já agendou, com o histórico de cada um. O cadastro é criado sozinho a
          cada agendamento.
        </p>
      </div>

      {counts.sumido > 0 && filter !== "sumido" && (
        <Link
          href={filterHref("sumido", "")}
          className="flex items-center gap-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200 transition hover:bg-amber-100 dark:hover:bg-amber-900/40"
        >
          <MessageCircle className="size-5 shrink-0" />
          <span className="flex-1">
            <strong>
              {counts.sumido} {counts.sumido === 1 ? "cliente sumiu" : "clientes sumiram"}
            </strong>{" "}
            — passaram do tempo em que costumam voltar. Chame de volta pelo WhatsApp.
          </span>
          <ChevronRight className="size-4 shrink-0" />
        </Link>
      )}

      <form action="/admin/clientes" className="relative">
        {filter !== "todos" && <input type="hidden" name="filtro" value={filter} />}
        {tag && <input type="hidden" name="etiqueta" value={tag} />}
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Buscar por nome ou telefone"
          className="h-11 pl-9 text-base"
        />
      </form>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={filterHref(f.key, q, tag)}
            className={cn(
              buttonVariants({ variant: filter === f.key ? "default" : "outline", size: "sm" }),
              "shrink-0 gap-1.5",
            )}
          >
            {f.label}
            <span className="opacity-70">{counts[f.key]}</span>
          </Link>
        ))}
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allTags.map((t) => (
            <Link
              key={t}
              href={filterHref(filter, q, tag === t ? null : t)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                tag === t ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
              )}
            >
              #{t}
            </Link>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {counts.todos === 0
            ? "Nenhum cliente ainda. Assim que alguém agendar, ele aparece aqui."
            : "Nenhum cliente encontrado com esse filtro."}
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {rows.map(({ customer, stats: s, insight }) => (
            <li key={customer.id}>
              <Link
                href={`/admin/clientes/${customer.id}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{customer.name}</span>
                    <CustomerStatusBadge status={insight.status} />
                    {(customer.tags ?? []).slice(0, 2).map((t) => (
                      <span key={t} className="hidden text-xs text-muted-foreground sm:inline">
                        #{t}
                      </span>
                    ))}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {maskPhone(customer.phone)} · {summaryLine(s, insight, barbershop.timezone)}
                  </p>
                </div>
                {isOwner && s && Number(s.total_spent) > 0 && (
                  <span className="shrink-0 text-sm font-medium tabular-nums">
                    {formatCurrency(Number(s.total_spent))}
                  </span>
                )}
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function summaryLine(s: CustomerStats | null, insight: CustomerInsight, tz: string) {
  const visits = Number(s?.visits ?? 0);
  if (s?.next_appointment_at && visits === 0) {
    const day = new Date(s.next_appointment_at).toLocaleDateString("pt-BR", {
      timeZone: tz,
      day: "2-digit",
      month: "2-digit",
    });
    return `primeiro horário em ${day} às ${formatTime(s.next_appointment_at, tz)}`;
  }
  if (insight.daysSinceLastVisit === null) return "ainda não veio";
  const last = `última visita ${formatDaysAgo(insight.daysSinceLastVisit)}`;
  return `${last} · ${visits} ${visits === 1 ? "visita" : "visitas"}`;
}
