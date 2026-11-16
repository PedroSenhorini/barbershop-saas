"use client";

import {
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { CircleDot, List, SquareKanban } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import { dateIsoInZone, formatDayLong, formatTime } from "@/lib/time";
import type { BookableBarber } from "@/lib/availability";
import type {
  Appointment,
  AppointmentStatus,
  AppointmentWithRelations,
  Service,
} from "@/lib/supabase/types";
import { updateAppointmentStatus } from "./actions";
import {
  AppointmentMenu,
  CustomerSignal,
  INACTIVE,
  NextStepButton,
  STATUS_LABEL,
  STATUS_STYLE,
  type ChangeStatus,
  type ShopInfo,
} from "./appointment-parts";
import { Board } from "./board";
import { NewAppointmentDialog } from "./new-appointment-dialog";

type View = "lista" | "quadro";
const VIEW_KEY = "agenda-view";

// Preferência Lista/Quadro lembrada por aparelho. Sem localStorage (aba
// anônima), fica na lista e só não lembramos a escolha.
const viewListeners = new Set<() => void>();
let fallbackView: View = "lista";

function readView(): View {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "quadro" ? "quadro" : "lista";
  } catch {
    return fallbackView;
  }
}

function subscribeView(listener: () => void) {
  viewListeners.add(listener);
  return () => viewListeners.delete(listener);
}

function pickView(next: View) {
  fallbackView = next;
  try {
    window.localStorage.setItem(VIEW_KEY, next);
  } catch {
    // Segue com fallbackView.
  }
  viewListeners.forEach((l) => l());
}

export function Agenda({
  dateIso,
  appointments,
  barbershop,
  services,
  barbers,
  currentUserId,
}: {
  dateIso: string;
  appointments: AppointmentWithRelations[];
  barbershop: ShopInfo;
  services: Pick<Service, "id" | "name" | "duration_minutes" | "price">[];
  barbers: BookableBarber[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [optimistic, setOptimisticStatus] = useOptimistic(
    appointments,
    (state, change: { id: string; status: AppointmentStatus }) =>
      state.map((a) => (a.id === change.id ? { ...a, status: change.status } : a)),
  );
  const [barberFilter, setBarberFilter] = useState<string | null>(null);
  const view = useSyncExternalStore(subscribeView, readView, () => "lista" as View);
  // Mudanças feitas neste aparelho: o Realtime ecoa de volta e não queremos
  // anunciar como se fosse resposta do cliente.
  const localChanges = useRef(new Set<string>());

  // Agendamento novo pelo site e respostas do cliente pelo link aparecem
  // sozinhos, sem recarregar a página.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`agenda-${barbershop.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `barbershop_id=eq.${barbershop.id}`,
        },
        (payload) => {
          const row = payload.new as Appointment;
          if (payload.eventType === "INSERT") {
            toast.info("Novo agendamento!", {
              description: `${row.customer_name} — ${formatDayLong(
                dateIsoInZone(new Date(row.scheduled_at), barbershop.timezone),
              )} às ${formatTime(row.scheduled_at, barbershop.timezone)}`,
            });
          } else if (payload.eventType === "UPDATE" && !localChanges.current.has(row.id)) {
            const time = formatTime(row.scheduled_at, barbershop.timezone);
            if (row.status === "a_caminho") {
              toast.info(`${row.customer_name} está a caminho 🚗`, { description: `Horário das ${time}` });
            } else if (row.status === "cancelado") {
              toast.warning(`Horário das ${time} cancelado`, { description: row.customer_name });
            } else if (
              row.status === "confirmado" &&
              row.customer_confirmed_at &&
              Date.now() - new Date(row.customer_confirmed_at).getTime() < 60_000
            ) {
              toast.success(`${row.customer_name} confirmou presença`, { description: `Horário das ${time}` });
            }
          }
          router.refresh();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [barbershop.id, barbershop.timezone, router]);

  const changeStatus: ChangeStatus = (appointment, status, options = {}) => {
    const previous = appointment.status;
    localChanges.current.add(appointment.id);
    setTimeout(() => localChanges.current.delete(appointment.id), 10_000);
    startTransition(async () => {
      setOptimisticStatus({ id: appointment.id, status });
      const result = await updateAppointmentStatus(appointment.id, status);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      router.refresh();
      if (!options.silent) {
        toast.success(`${appointment.customer_name}: ${STATUS_LABEL[status].toLowerCase()}`, {
          action: {
            label: "Desfazer",
            onClick: () => changeStatus(appointment, previous, { silent: true }),
          },
        });
      }
    });
  };

  const visible = useMemo(
    () =>
      barberFilter
        ? optimistic.filter((a) => a.barber_id === barberFilter)
        : optimistic,
    [optimistic, barberFilter],
  );

  const stats = useMemo(() => {
    const active = visible.filter((a) => !INACTIVE.includes(a.status));
    const price = (a: AppointmentWithRelations) => Number(a.service?.price ?? 0);
    return {
      count: active.length,
      pending: visible.filter((a) => a.status === "solicitado").length,
      expected: active.reduce((sum, a) => sum + price(a), 0),
      done: visible
        .filter((a) => a.status === "finalizado")
        .reduce((sum, a) => sum + price(a), 0),
    };
  }, [visible]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Agendados" value={String(stats.count)} />
        <Stat label="Previsto" value={formatCurrency(stats.expected)} />
        <Stat label="Recebido" value={formatCurrency(stats.done)} />
      </div>

      {barbers.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          <FilterChip active={barberFilter === null} onClick={() => setBarberFilter(null)}>
            Todos
          </FilterChip>
          {barbers.map((b) => (
            <FilterChip
              key={b.id}
              active={barberFilter === b.id}
              onClick={() => setBarberFilter(b.id)}
            >
              {b.id === currentUserId ? "Eu" : b.full_name.split(" ")[0]}
            </FilterChip>
          ))}
        </div>
      )}

      {stats.pending > 0 && (
        <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <CircleDot className="size-4" />
          {stats.pending === 1
            ? "1 cliente aguardando sua confirmação"
            : `${stats.pending} clientes aguardando sua confirmação`}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex rounded-lg border bg-card p-0.5" role="tablist" aria-label="Visualização">
          <ViewButton active={view === "lista"} onClick={() => pickView("lista")} icon={<List className="size-4" />}>
            Lista
          </ViewButton>
          <ViewButton active={view === "quadro"} onClick={() => pickView("quadro")} icon={<SquareKanban className="size-4" />}>
            Quadro
          </ViewButton>
        </div>
        <NewAppointmentDialog
          dateIso={dateIso}
          services={services}
          barbers={barbers}
          onCreated={() => router.refresh()}
        />
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
          Nenhum agendamento neste dia.
        </div>
      ) : view === "quadro" ? (
        <Board
          appointments={visible}
          shop={barbershop}
          dateIso={dateIso}
          onChangeStatus={changeStatus}
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((a) => (
            <AppointmentItem
              key={a.id}
              appointment={a}
              barbershop={barbershop}
              dateIso={dateIso}
              onChangeStatus={changeStatus}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AppointmentItem({
  appointment: a,
  barbershop,
  dateIso,
  onChangeStatus,
}: {
  appointment: AppointmentWithRelations;
  barbershop: ShopInfo;
  dateIso: string;
  onChangeStatus: ChangeStatus;
}) {
  const inactive = INACTIVE.includes(a.status);

  return (
    <li
      className={cn(
        "flex gap-3 rounded-xl border bg-card p-3",
        a.status === "solicitado" && "border-amber-300",
        a.status === "a_caminho" && "border-indigo-300",
        inactive && "opacity-60",
      )}
    >
      <div className="w-12 shrink-0 pt-0.5 text-center">
        <p className="font-semibold">{formatTime(a.scheduled_at, barbershop.timezone)}</p>
        <p className="text-xs text-muted-foreground">{formatTime(a.ends_at, barbershop.timezone)}</p>
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={cn("truncate font-medium", inactive && "line-through")}>
              {a.customer_name}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {a.service?.name ?? "Serviço"}
              {a.barber?.full_name && ` · ${a.barber.full_name.split(" ")[0]}`}
              {a.service && ` · ${formatCurrency(Number(a.service.price))}`}
            </p>
            <CustomerSignal a={a} />
          </div>
          <AppointmentMenu a={a} shop={barbershop} dateIso={dateIso} onChangeStatus={onChangeStatus} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <NextStepButton a={a} shop={barbershop} dateIso={dateIso} onChangeStatus={onChangeStatus} />
          <Badge className={cn("h-6", STATUS_STYLE[a.status])}>{STATUS_LABEL[a.status]}</Badge>
        </div>
      </div>
    </li>
  );
}

function ViewButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-base font-semibold">{value}</p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-8 shrink-0 rounded-full border px-3.5 text-sm font-medium transition",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card",
      )}
    >
      {children}
    </button>
  );
}
