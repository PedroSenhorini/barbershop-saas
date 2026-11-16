import { onlyDigits } from "@/lib/format";

/**
 * Confirmação pelo WhatsApp sem API paga: geramos links wa.me com a mensagem
 * pronta, e quem toca no botão envia pelo próprio WhatsApp.
 */

/** Número no formato internacional que o wa.me espera (Brasil por padrão). */
export function toWhatsAppNumber(phone: string) {
  const digits = onlyDigits(phone);
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function whatsAppLink(phone: string, message: string) {
  return `https://wa.me/${toWhatsAppNumber(phone)}?text=${encodeURIComponent(message)}`;
}

/** Link de compartilhamento sem destinatário (a pessoa escolhe o contato). */
export function whatsAppShareLink(message: string) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

type AppointmentMessage = {
  customerName: string;
  serviceName: string;
  dayLabel: string;
  timeLabel: string;
  barbershopName: string;
  barberName?: string | null;
  /** Link pessoal do cliente (/h/<token>) para confirmar, avisar ou cancelar. */
  customerLink?: string;
};

function firstName(name: string) {
  return name.trim().split(/\s+/)[0];
}

export function confirmationMessage(a: AppointmentMessage) {
  const barber = a.barberName ? ` com ${firstName(a.barberName)}` : "";
  const action = a.customerLink
    ? `Confirme sua presença (ou cancele, se não puder vir) por aqui:\n${a.customerLink}`
    : "Se não puder vir, é só avisar por aqui.";
  return `Olá, ${firstName(a.customerName)}! Seu horário na ${a.barbershopName} está confirmado ✅\n\n✂️ ${a.serviceName}${barber}\n📅 ${a.dayLabel}, às ${a.timeLabel}\n\n${action}\n\nAté lá!`;
}

export function reminderMessage(a: AppointmentMessage) {
  const action = a.customerLink
    ? `Toque no link para confirmar ou avisar que está a caminho:\n${a.customerLink}`
    : "Podemos confirmar?";
  return `Olá, ${firstName(a.customerName)}! Passando para lembrar do seu horário na ${a.barbershopName}: ${a.serviceName}, ${a.dayLabel} às ${a.timeLabel}.\n\n${action}`;
}

export function declineMessage(a: AppointmentMessage) {
  return `Olá, ${firstName(a.customerName)}! Infelizmente não conseguimos atender ${a.dayLabel} às ${a.timeLabel}. Quer escolher outro horário?`;
}

export function customerNoticeMessage(a: AppointmentMessage) {
  const barber = a.barberName ? ` com ${firstName(a.barberName)}` : "";
  return `Olá! Acabei de agendar pelo site: ${a.serviceName}${barber}, ${a.dayLabel} às ${a.timeLabel}. Meu nome é ${a.customerName}.`;
}
