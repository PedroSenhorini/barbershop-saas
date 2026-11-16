"use client";

import { Car, Check, MessageCircle, MoreVertical, Play } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { maskPhone } from "@/lib/format";
import { formatDayLong, formatTime } from "@/lib/time";
import {
  confirmationMessage,
  declineMessage,
  reminderMessage,
  whatsAppLink,
} from "@/lib/whatsapp";
import type { AppointmentStatus, AppointmentWithRelations } from "@/lib/supabase/types";

/**
 * Peças compartilhadas entre a lista e o quadro da agenda: rótulos de status,
 * selo de resposta do cliente, botão do próximo passo e menu de ações.
 */

export type ShopInfo = { id: string; name: string; timezone: string; siteUrl: string };

export type ChangeStatus = (
  a: AppointmentWithRelations,
  status: AppointmentStatus,
  options?: { silent?: boolean },
) => void;

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
  solicitado: "bg-amber-100 text-amber-900",
  confirmado: "bg-sky-100 text-sky-900",
  a_caminho: "bg-indigo-100 text-indigo-900",
  em_andamento: "bg-violet-100 text-violet-900",
  finalizado: "bg-emerald-100 text-emerald-900",
  cancelado: "bg-muted text-muted-foreground",
  faltou: "bg-red-100 text-red-900",
};

export const INACTIVE: AppointmentStatus[] = ["cancelado", "faltou"];

export function customerLink(a: AppointmentWithRelations, shop: ShopInfo) {
  return `${shop.siteUrl}/h/${a.public_token}`;
}

function messageFor(a: AppointmentWithRelations, shop: ShopInfo, dateIso: string) {
  return {
    customerName: a.customer_name,
    serviceName: a.service?.name ?? "seu atendimento",
    dayLabel: formatDayLong(dateIso),
    timeLabel: formatTime(a.scheduled_at, shop.timezone),
    barbershopName: shop.name,
    barberName: a.barber?.full_name,
    customerLink: customerLink(a, shop),
  };
}

function hasPhone(a: AppointmentWithRelations) {
  return a.customer_phone.length >= 10;
}

/** O que o cliente respondeu pelo link, enquanto isso importa. */
export function CustomerSignal({ a }: { a: AppointmentWithRelations }) {
  if (a.status === "a_caminho") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700">
        <Car className="size-3.5" /> Cliente a caminho
      </span>
    );
  }
  if (a.status !== "confirmado") return null;
  return a.customer_confirmed_at ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
      <Check className="size-3.5" /> Cliente confirmou presença
    </span>
  ) : (
    <span className="text-xs text-muted-foreground">Cliente ainda não confirmou</span>
  );
}

/** Botão principal: o próximo passo natural do atendimento. */
export function NextStepButton({
  a,
  shop,
  dateIso,
  onChangeStatus,
  className,
}: {
  a: AppointmentWithRelations;
  shop: ShopInfo;
  dateIso: string;
  onChangeStatus: ChangeStatus;
  className?: string;
}) {
  if (a.status === "solicitado") {
    return hasPhone(a) ? (
      <a
        href={whatsAppLink(a.customer_phone, confirmationMessage(messageFor(a, shop, dateIso)))}
        target="_blank"
        rel="noreferrer"
        onClick={() => onChangeStatus(a, "confirmado")}
        className={cn(buttonVariants(), "h-9 gap-1.5", className)}
      >
        <MessageCircle className="size-4" />
        Confirmar no WhatsApp
      </a>
    ) : (
      <Button className={cn("h-9 gap-1.5", className)} onClick={() => onChangeStatus(a, "confirmado")}>
        <Check className="size-4" />
        Confirmar
      </Button>
    );
  }
  if (a.status === "confirmado" || a.status === "a_caminho") {
    return (
      <Button
        variant={a.status === "a_caminho" ? "default" : "outline"}
        className={cn("h-9 gap-1.5", className)}
        onClick={() => onChangeStatus(a, "em_andamento")}
      >
        <Play className="size-4" />
        Começar atendimento
      </Button>
    );
  }
  if (a.status === "em_andamento") {
    return (
      <Button className={cn("h-9 gap-1.5", className)} onClick={() => onChangeStatus(a, "finalizado")}>
        <Check className="size-4" />
        Finalizar
      </Button>
    );
  }
  return null;
}

export function AppointmentMenu({
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
  const message = messageFor(a, shop, dateIso);
  const phone = hasPhone(a);
  const inactive = INACTIVE.includes(a.status);
  const open = (text: string) => window.open(whatsAppLink(a.customer_phone, text), "_blank");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(customerLink(a, shop));
      toast.success("Link do cliente copiado");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Mais opções" className="-mr-1 -mt-1">
            <MoreVertical className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-60">
        {phone && (
          <DropdownMenuItem onClick={() => open(`Olá, ${a.customer_name.split(" ")[0]}!`)}>
            Abrir conversa ({maskPhone(a.customer_phone)})
          </DropdownMenuItem>
        )}
        {phone && a.status === "confirmado" && (
          <DropdownMenuItem onClick={() => open(reminderMessage(message))}>
            Enviar lembrete com link
          </DropdownMenuItem>
        )}
        {!inactive && a.status !== "finalizado" && (
          <DropdownMenuItem onClick={copyLink}>Copiar link do cliente</DropdownMenuItem>
        )}
        {a.status === "solicitado" && (
          <DropdownMenuItem onClick={() => onChangeStatus(a, "confirmado")}>
            Confirmar sem enviar mensagem
          </DropdownMenuItem>
        )}
        {a.status === "confirmado" && (
          <DropdownMenuItem onClick={() => onChangeStatus(a, "a_caminho")}>
            Marcar como a caminho
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {a.status === "solicitado" && (
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              onChangeStatus(a, "cancelado");
              if (phone) open(declineMessage(message));
            }}
          >
            Recusar e avisar cliente
          </DropdownMenuItem>
        )}
        {(a.status === "confirmado" || a.status === "a_caminho" || a.status === "em_andamento") && (
          <>
            <DropdownMenuItem onClick={() => onChangeStatus(a, "faltou")}>
              Cliente faltou
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => onChangeStatus(a, "cancelado")}>
              Cancelar horário
            </DropdownMenuItem>
          </>
        )}
        {(a.status === "finalizado" || inactive) && (
          <DropdownMenuItem onClick={() => onChangeStatus(a, "confirmado")}>
            Voltar para confirmado
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
