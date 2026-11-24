import Link from "next/link";
import {
  CalendarCheck,
  Link2,
  MessageCircle,
  Scissors,
  Smartphone,
  Users,
  Wallet,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    title: "Crie sua conta",
    description: "Nome da barbearia, seu WhatsApp e pronto. Já vem com serviços e horários prontos para ajustar.",
  },
  {
    title: "Divulgue seu link",
    description: "Coloque na bio do Instagram e no status do WhatsApp. O cliente agenda sozinho, a qualquer hora.",
  },
  {
    title: "Confirme com um toque",
    description: "Chegou agendamento? Toque em “Confirmar no WhatsApp” e a mensagem já vai pronta para o cliente.",
  },
];

const FEATURES = [
  {
    icon: Smartphone,
    title: "Feito para o celular",
    description: "Você gerencia a agenda inteira pelo celular, entre um corte e outro.",
  },
  {
    icon: CalendarCheck,
    title: "Sem horário duplicado",
    description: "O sistema só mostra horários livres e respeita seu intervalo de almoço.",
  },
  {
    icon: MessageCircle,
    title: "Confirmação pelo WhatsApp",
    description: "Mensagens prontas de confirmação e lembrete, enviadas do seu próprio número.",
  },
  {
    icon: Users,
    title: "Equipe",
    description: "O cliente escolhe o barbeiro e cada um vê a própria agenda.",
  },
  {
    icon: Wallet,
    title: "Faturamento do dia",
    description: "Veja quanto está previsto e quanto já entrou em cada dia.",
  },
  {
    icon: Link2,
    title: "Encaixes",
    description: "Cliente ligou ou chegou sem marcar? Lance o horário em segundos.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-5 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] sm:px-8">
        <div className="flex items-center gap-2">
          <Scissors className="size-5 text-primary" />
          <span className="font-semibold">Barbearia</span>
        </div>
        <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
          Entrar
        </Link>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-5 py-16 text-center sm:py-24">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Seus clientes agendam sozinhos. Você só corta.
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Agenda online para barbearias com confirmação pelo WhatsApp. Sem app
          para baixar, sem complicação: em 1 minuto você tem seu link.
        </p>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link href="/cadastro" className={cn(buttonVariants({ size: "lg" }), "h-12 px-6 text-base")}>
            Criar minha agenda
          </Link>
          <Link
            href="/demo-barbearia"
            className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-12 px-6 text-base")}
          >
            Ver como o cliente agenda
          </Link>
        </div>
      </section>

      <section className="border-y bg-muted/30 px-5 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-center text-2xl font-semibold">Como funciona</h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-xl border bg-card p-5">
                <span className="mb-3 flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <p className="font-medium">{step.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-4xl gap-6 px-5 py-16 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="space-y-2">
            <feature.icon className="size-6 text-primary" />
            <p className="font-medium">{feature.title}</p>
            <p className="text-sm text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </section>

      <section className="px-5 pb-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 rounded-2xl bg-primary px-6 py-12 text-center text-primary-foreground">
          <h2 className="text-2xl font-semibold">Pronto para encher a agenda?</h2>
          <p className="max-w-md opacity-80">
            Crie sua conta agora e mande o link para seus clientes ainda hoje.
          </p>
          <Link
            href="/cadastro"
            className={cn(buttonVariants({ size: "lg", variant: "secondary" }), "h-12 px-6 text-base")}
          >
            Criar minha agenda
          </Link>
        </div>
      </section>
    </div>
  );
}
