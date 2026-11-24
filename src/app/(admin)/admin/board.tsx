"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/time";
import type { AppointmentStatus, AppointmentWithRelations } from "@/lib/supabase/types";
import {
  AppointmentMenu,
  CustomerSignal,
  NextStepButton,
  PaymentTag,
  type ChangeStatus,
  type ShopInfo,
} from "./appointment-parts";

const COLUMNS: { key: string; title: string; statuses: AppointmentStatus[]; dot: string }[] = [
  { key: "novos", title: "Novos", statuses: ["solicitado"], dot: "bg-amber-500" },
  { key: "confirmados", title: "Confirmados", statuses: ["confirmado"], dot: "bg-sky-500" },
  { key: "a_caminho", title: "A caminho", statuses: ["a_caminho"], dot: "bg-indigo-500" },
  { key: "atendendo", title: "Atendendo", statuses: ["em_andamento"], dot: "bg-violet-500" },
  { key: "finalizados", title: "Finalizados", statuses: ["finalizado"], dot: "bg-emerald-500" },
  { key: "nao_vieram", title: "Cancelados / faltas", statuses: ["cancelado", "faltou"], dot: "bg-muted-foreground" },
];

/**
 * Quadro do dia: uma coluna por etapa do atendimento. No celular, uma coluna
 * por vez (abas com contagem); a partir de md, todas lado a lado com rolagem.
 */
export function Board({
  appointments,
  shop,
  dateIso,
  onChangeStatus,
}: {
  appointments: AppointmentWithRelations[];
  shop: ShopInfo;
  dateIso: string;
  onChangeStatus: ChangeStatus;
}) {
  const columns = COLUMNS.map((col) => ({
    ...col,
    items: appointments.filter((a) => col.statuses.includes(a.status)),
  }));
  // Abre na primeira etapa com algo a fazer.
  const [selected, setSelected] = useState(
    () => columns.find((c) => c.items.length > 0)?.key ?? "confirmados",
  );

  return (
    <div className="space-y-3">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:hidden">
        {columns.map((col) => (
          <button
            key={col.key}
            onClick={() => setSelected(col.key)}
            className={cn(
              "flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition active:opacity-80",
              selected === col.key ? "border-primary bg-primary text-primary-foreground" : "bg-card",
            )}
          >
            <span className={cn("size-2 rounded-full", col.dot)} />
            {col.title}
            <span className="tabular-nums opacity-70">{col.items.length}</span>
          </button>
        ))}
      </div>

      <div className="md:-mx-6 md:flex md:gap-3 md:overflow-x-auto md:px-6 md:pb-2">
        {columns.map((col) => (
          <section
            key={col.key}
            className={cn(
              "md:w-64 md:shrink-0 md:rounded-xl md:bg-muted/40 md:p-2",
              selected !== col.key && "hidden md:block",
            )}
          >
            <h3 className="mb-2 hidden items-center gap-2 px-1 text-sm font-semibold md:flex">
              <span className={cn("size-2 rounded-full", col.dot)} />
              {col.title}
              <span className="ml-auto tabular-nums text-muted-foreground">{col.items.length}</span>
            </h3>
            {col.items.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Ninguém aqui.
              </p>
            ) : (
              <ul className="space-y-2">
                {col.items.map((a) => (
                  <BoardCard
                    key={a.id}
                    a={a}
                    shop={shop}
                    dateIso={dateIso}
                    onChangeStatus={onChangeStatus}
                  />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function BoardCard({
  a,
  shop,
  dateIso,
  onChangeStatus,
}: {
  a: AppointmentWithRelations;
  shop: ShopInfo;
  dateIso: string;
  onChangeStatus: ChangeStatus;
}) {
  const inactive = a.status === "cancelado" || a.status === "faltou";
  return (
    <li className={cn("space-y-2 rounded-xl border bg-card p-3", inactive && "opacity-60")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold tabular-nums">
            {formatTime(a.scheduled_at, shop.timezone)}
            <span className="font-normal text-muted-foreground">
              {" – "}
              {formatTime(a.ends_at, shop.timezone)}
            </span>
          </p>
          <p className={cn("truncate font-medium", inactive && "line-through")}>{a.customer_name}</p>
          <p className="truncate text-sm text-muted-foreground">
            {a.service?.name ?? "Serviço"}
            {a.barber?.full_name && ` · ${a.barber.full_name.split(" ")[0]}`}
          </p>
        </div>
        <AppointmentMenu a={a} shop={shop} dateIso={dateIso} onChangeStatus={onChangeStatus} />
      </div>
      <CustomerSignal a={a} />
      <PaymentTag a={a} />
      <NextStepButton
        a={a}
        shop={shop}
        dateIso={dateIso}
        onChangeStatus={onChangeStatus}
        className="w-full"
      />
    </li>
  );
}
