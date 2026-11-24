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

/** Mensagem curta para abrir conversa com um cliente pela ficha. */
export function helloMessage(customerName: string) {
  return `Olá, ${firstName(customerName)}!`;
}

/** Para chamar de volta um cliente que passou do tempo em que costuma vir. */
export function comeBackMessage(a: {
  customerName: string;
  barbershopName: string;
  bookingUrl: string;
}) {
  return `Olá, ${firstName(a.customerName)}! Tudo bem? Faz um tempinho que você não passa aqui na ${a.barbershopName} 💈\n\nQue tal já deixar o próximo corte marcado? É rapidinho pelo link:\n${a.bookingUrl}`;
}

/** Lista de espera: abriu vaga. */
export function vacancyMessage(a: { customerName: string; barbershopName: string; bookingUrl: string }) {
  return `Olá, ${firstName(a.customerName)}! Abriu uma vaga aqui na ${a.barbershopName} ✂️\n\nSe ainda quiser, garanta pelo link antes que alguém pegue:\n${a.bookingUrl}`;
}

/** Pedido de avaliação no Google, enviado pela ficha do cliente. */
export function reviewRequestMessage(a: { customerName: string; barbershopName: string; reviewUrl: string }) {
  return `Olá, ${firstName(a.customerName)}! Obrigado por vir na ${a.barbershopName} 💈\n\nSe curtiu o atendimento, deixa uma avaliação pra gente no Google? Ajuda demais:\n${a.reviewUrl}`;
}

/** Lembrete de fiado em aberto. */
export function debtMessage(a: { customerName: string; barbershopName: string; amount: string }) {
  return `Olá, ${firstName(a.customerName)}! Tudo bem? Passando para lembrar do valor de ${a.amount} em aberto aqui na ${a.barbershopName}. Pode acertar por Pix ou na próxima visita. Obrigado!`;
}

/** Mensalidade do Clube vencendo ou vencida. */
export function clubDueMessage(a: {
  customerName: string;
  barbershopName: string;
  planName: string;
  amount: string;
  dueLabel: string;
  overdue: boolean;
}) {
  const when = a.overdue ? `venceu em ${a.dueLabel}` : `vence em ${a.dueLabel}`;
  return `Olá, ${firstName(a.customerName)}! A mensalidade do seu plano ${a.planName} (${a.amount}) na ${a.barbershopName} ${when}. Pode pagar por Pix ou na sua próxima visita. Obrigado! 👑`;
}

/** Cadastro da porta / indicação: primeiro contato com o link de agendamento. */
export function leadWelcomeMessage(a: {
  customerName: string;
  barbershopName: string;
  bookingUrl: string;
  referred?: boolean;
}) {
  const intro = a.referred
    ? `Um amigo seu indicou a ${a.barbershopName} 💈`
    : `Aqui é da ${a.barbershopName}, obrigado pelo cadastro 💈`;
  return `Olá, ${firstName(a.customerName)}! ${intro}\n\nQuando quiser marcar seu horário, é rapidinho pelo link:\n${a.bookingUrl}`;
}
