import type { AppointmentStatus } from "@/lib/supabase/types";

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  solicitado: "Aguardando confirmação",
  confirmado: "Confirmado",
  a_caminho: "A caminho",
  em_andamento: "Atendendo",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
  faltou: "Faltou",
};

export const STATUS_STYLE: Record<AppointmentStatus, string> = {
  solicitado: "bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200",
  confirmado: "bg-sky-100 dark:bg-sky-900/40 text-sky-900 dark:text-sky-200",
  a_caminho: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-900 dark:text-indigo-200",
  em_andamento: "bg-violet-100 dark:bg-violet-900/40 text-violet-900 dark:text-violet-200",
  finalizado: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200",
  cancelado: "bg-muted text-muted-foreground",
  faltou: "bg-red-100 dark:bg-red-900/40 text-red-900 dark:text-red-200",
};
