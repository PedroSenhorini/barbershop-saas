"use client";

import { useState } from "react";
import { Banknote, Car, Check, CreditCard, MessageCircle, MoreVertical, Play, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatCurrency, maskPhone } from "@/lib/format";
import { formatDayLong, formatTime } from "@/lib/time";
import {
  confirmationMessage,
  declineMessage,
  reminderMessage,
  whatsAppLink,
} from "@/lib/whatsapp";
import { PAYMENT_LABEL, PAYMENT_METHODS, paidAmount, parseMoney } from "@/lib/finance";
import type {
  AppointmentStatus,
  AppointmentWithRelations,
  PaymentMethod,
} from "@/lib/supabase/types";

/**
 * Peças compartilhadas entre a lista e o quadro da agenda: rótulos de status,
 * selo de resposta do cliente, botão do próximo passo e menu de ações.
 */

export type ShopInfo = { id: string; name: string; timezone: string; siteUrl: string };

export type Payment = { method: PaymentMethod; amount: number };

export type ChangeStatus = (
  a: AppointmentWithRelations,
  status: AppointmentStatus,
  options?: { silent?: boolean; payment?: Payment },
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
    return <FinishButton a={a} onChangeStatus={onChangeStatus} className={className} />;
  }
  return null;
}

const PAYMENT_ICON: Record<PaymentMethod, React.ReactNode> = {
  dinheiro: <Banknote className="size-5" />,
  pix: <QrCode className="size-5" />,
  cartao: <CreditCard className="size-5" />,
};

/** Finalizar pergunta como o cliente pagou: é o que alimenta o caixa do dia. */
function FinishButton({
  a,
  onChangeStatus,
  className,
}: {
  a: AppointmentWithRelations;
  onChangeStatus: ChangeStatus;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const price = Number(a.service?.price ?? 0);
  const [amount, setAmount] = useState(price.toFixed(2).replace(".", ","));
  const parsed = parseMoney(amount);

  function finish() {
    if (!method || parsed === null) return;
    setOpen(false);
    onChangeStatus(a, "finalizado", { payment: { method, amount: parsed } });
  }

  return (
    <>
      <Button className={cn("h-9 gap-1.5", className)} onClick={() => setOpen(true)}>
        <Check className="size-4" />
        Finalizar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Como {a.customer_name.split(" ")[0]} pagou?</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={cn(
                  "flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border text-sm font-medium transition",
                  method === m ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary",
                )}
              >
                {PAYMENT_ICON[m]}
                {PAYMENT_LABEL[m]}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`amount-${a.id}`}>Valor recebido (R$)</Label>
            <Input
              id={`amount-${a.id}`}
              inputMode="decimal"
              className="h-11 text-base"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {a.service ? `Preço do serviço: ${formatCurrency(price)}. ` : ""}
              Ajuste se teve desconto ou gorjeta.
            </p>
          </div>
          <Button size="lg" className="h-12 text-base" disabled={!method || parsed === null} onClick={finish}>
            {method ? "Finalizar atendimento" : "Escolha a forma de pagamento"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Forma e valor do pagamento de um atendimento finalizado. */
export function PaymentTag({ a }: { a: AppointmentWithRelations }) {
  if (a.status !== "finalizado" || !a.payment_method) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
      {PAYMENT_LABEL[a.payment_method]} · {formatCurrency(paidAmount(a))}
    </span>
  );
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
