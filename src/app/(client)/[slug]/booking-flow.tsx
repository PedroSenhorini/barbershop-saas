"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  Clock,
  Loader2,
  MapPin,
  MessageCircle,
  Scissors,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDuration, initials, maskPhone } from "@/lib/format";
import { formatDayLong, formatDayShort } from "@/lib/time";
import { customerNoticeMessage, whatsAppLink } from "@/lib/whatsapp";
import type { BookableBarber, Slot } from "@/lib/availability";
import type { Service } from "@/lib/supabase/types";
import { createAppointment, getSlots } from "./actions";

type Step = "service" | "barber" | "datetime" | "details" | "success";

type PublicBarbershop = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  active: boolean;
  hoursSummary: string;
};

const SAVED_CUSTOMER_KEY = "cartola:cliente";

function readSavedCustomer(): { name: string; phone: string } {
  try {
    if (typeof window === "undefined") return { name: "", phone: "" };
    const raw = window.localStorage.getItem(SAVED_CUSTOMER_KEY);
    return raw ? JSON.parse(raw) : { name: "", phone: "" };
  } catch {
    return { name: "", phone: "" };
  }
}

export function BookingFlow({
  barbershop,
  services,
  barbers,
  days,
  todayIso,
}: {
  barbershop: PublicBarbershop;
  services: Service[];
  barbers: BookableBarber[];
  days: { iso: string; open: boolean }[];
  todayIso: string;
}) {
  const hasBarberChoice = barbers.length > 1;
  const steps: Step[] = hasBarberChoice
    ? ["service", "barber", "datetime", "details"]
    : ["service", "datetime", "details"];

  const [step, setStep] = useState<Step>("service");
  const [service, setService] = useState<Service | null>(null);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [dateIso, setDateIso] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [customer, setCustomer] = useState(readSavedCustomer);
  const [assignedBarberId, setAssignedBarberId] = useState<string | null>(null);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [loadingSlots, startLoadingSlots] = useTransition();
  const [saving, startSaving] = useTransition();

  const selectedBarber = barbers.find((b) => b.id === (barberId ?? assignedBarberId));

  function loadSlots(nextDate: string, forService: Service, forBarber: string | null) {
    setDateIso(nextDate);
    setSlot(null);
    setSlots([]);
    startLoadingSlots(async () => {
      const result = await getSlots(barbershop.id, forService.id, forBarber, nextDate);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setSlots(result.slots);
    });
  }

  function goToDatetime(forService: Service, forBarber: string | null) {
    setStep("datetime");
    const firstOpen = days.find((d) => d.open);
    if (firstOpen) loadSlots(dateIso ?? firstOpen.iso, forService, forBarber);
  }

  function pickService(next: Service) {
    setService(next);
    if (hasBarberChoice) setStep("barber");
    else goToDatetime(next, null);
  }

  function pickBarber(next: string | null) {
    setBarberId(next);
    if (service) goToDatetime(service, next);
  }

  function goBack() {
    const index = steps.indexOf(step);
    if (index > 0) setStep(steps[index - 1]);
  }

  function confirm() {
    if (!service || !slot) return;
    startSaving(async () => {
      const result = await createAppointment({
        barbershopId: barbershop.id,
        serviceId: service.id,
        barberId,
        scheduledAt: slot.iso,
        customerName: customer.name,
        customerPhone: customer.phone,
      });

      if ("error" in result) {
        toast.error(result.error);
        if (dateIso) loadSlots(dateIso, service, barberId);
        setStep("datetime");
        return;
      }

      try {
        window.localStorage.setItem(SAVED_CUSTOMER_KEY, JSON.stringify(customer));
      } catch {
        // Sem localStorage (aba anônima): só não lembramos os dados da próxima vez.
      }
      setAssignedBarberId(result.barberId);
      setPublicToken(result.publicToken);
      setStep("success");
    });
  }

  if (!barbershop.active) {
    return (
      <div className="flex flex-1 flex-col">
        <ShopHeader barbershop={barbershop} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-muted-foreground">
            O agendamento online está pausado no momento.
          </p>
          {barbershop.phone && (
            <a
              href={whatsAppLink(barbershop.phone, "Olá! Gostaria de agendar um horário.")}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ size: "lg" }), "h-12 gap-2 px-6")}
            >
              <MessageCircle className="size-5" />
              Chamar no WhatsApp
            </a>
          )}
        </div>
      </div>
    );
  }

  const stepIndex = steps.indexOf(step);
  const canSubmit =
    customer.name.trim().length >= 2 &&
    [10, 11].includes(customer.phone.replace(/\D/g, "").length);

  return (
    <div className="flex flex-1 flex-col">
      {step === "service" ? (
        <ShopHeader barbershop={barbershop} />
      ) : step !== "success" ? (
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 px-3 py-3 backdrop-blur">
          <Button variant="ghost" size="icon-lg" onClick={goBack} aria-label="Voltar">
            <ChevronLeft className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">{barbershop.name}</p>
            <p className="font-semibold leading-tight">{stepTitle(step)}</p>
          </div>
        </header>
      ) : null}

      {step !== "success" && (
        <div className="flex gap-1.5 px-5 pt-4" aria-hidden>
          {steps.map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-1 flex-1 rounded-full bg-muted",
                i <= stepIndex && "bg-primary",
              )}
            />
          ))}
        </div>
      )}

      <div className="flex-1 p-5">
        {step === "service" && (
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Escolha o serviço</h2>
            {services.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum serviço disponível no momento.
              </p>
            )}
            {services.map((s) => (
              <button
                key={s.id}
                onClick={() => pickService(s)}
                className="flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left transition hover:border-primary active:scale-[0.99]"
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Scissors className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{s.name}</p>
                  {s.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {s.description}
                    </p>
                  )}
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    {formatDuration(s.duration_minutes)}
                  </p>
                </div>
                <p className="font-semibold">{formatCurrency(s.price)}</p>
              </button>
            ))}
          </div>
        )}

        {step === "barber" && (
          <div className="flex flex-col gap-3">
            <ChoiceButton
              selected={barberId === null}
              onClick={() => pickBarber(null)}
              icon={<Users className="size-5" />}
              title="Qualquer profissional"
              subtitle="Mais horários disponíveis"
            />
            {barbers.map((b) => (
              <ChoiceButton
                key={b.id}
                selected={barberId === b.id}
                onClick={() => pickBarber(b.id)}
                icon={<span className="text-sm font-semibold">{initials(b.full_name)}</span>}
                title={b.full_name}
              />
            ))}
          </div>
        )}

        {step === "datetime" && service && (
          <div className="flex flex-col gap-5">
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
              {days.map((d) => {
                const label = formatDayShort(d.iso);
                const selected = d.iso === dateIso;
                return (
                  <button
                    key={d.iso}
                    disabled={!d.open}
                    onClick={() => loadSlots(d.iso, service, barberId)}
                    className={cn(
                      "flex w-16 shrink-0 flex-col items-center rounded-xl border py-2.5 transition",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card hover:border-primary",
                      !d.open && "cursor-not-allowed opacity-40",
                    )}
                  >
                    <span className="text-xs capitalize">
                      {d.iso === todayIso ? "hoje" : label.weekday}
                    </span>
                    <span className="text-xl font-semibold">{label.day}</span>
                    <span className="text-xs">{d.open ? label.month : "fechado"}</span>
                  </button>
                );
              })}
            </div>

            {dateIso && (
              <div>
                <p className="mb-3 text-sm font-medium capitalize text-muted-foreground">
                  {formatDayLong(dateIso)}
                </p>
                {loadingSlots ? (
                  <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Buscando horários...
                  </div>
                ) : slots.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Sem horários livres nesse dia. Tente outro dia.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map((s) => (
                      <button
                        key={s.iso}
                        onClick={() => {
                          setSlot(s);
                          setStep("details");
                        }}
                        className={cn(
                          "h-11 rounded-lg border text-sm font-medium transition hover:border-primary",
                          slot?.iso === s.iso && "border-primary bg-primary text-primary-foreground",
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === "details" && service && slot && dateIso && (
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              confirm();
            }}
          >
            <Summary
              service={service}
              dateIso={dateIso}
              timeLabel={slot.label}
              barberName={barbers.find((b) => b.id === barberId)?.full_name}
            />

            <div className="space-y-1.5">
              <Label htmlFor="name">Seu nome</Label>
              <Input
                id="name"
                autoComplete="name"
                className="h-12 text-base"
                value={customer.name}
                onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                placeholder="Como podemos te chamar?"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">WhatsApp</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                className="h-12 text-base"
                value={maskPhone(customer.phone)}
                onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                placeholder="(11) 91234-5678"
              />
              <p className="text-xs text-muted-foreground">
                A barbearia vai confirmar seu horário por aqui.
              </p>
            </div>

            <Button type="submit" size="lg" className="h-12 text-base" disabled={saving || !canSubmit}>
              {saving ? <Loader2 className="size-5 animate-spin" /> : "Confirmar agendamento"}
            </Button>
          </form>
        )}

        {step === "success" && service && slot && dateIso && (
          <div className="flex flex-col items-center gap-6 py-10 text-center">
            <CheckCircle2 className="size-16 text-primary" />
            <div className="space-y-1">
              <p className="text-xl font-semibold">Horário reservado!</p>
              <p className="text-sm text-muted-foreground">
                A {barbershop.name} vai confirmar pelo WhatsApp.
              </p>
            </div>
            <div className="w-full text-left">
              <Summary
                service={service}
                dateIso={dateIso}
                timeLabel={slot.label}
                barberName={selectedBarber?.full_name}
              />
            </div>
            {barbershop.phone && (
              <a
                href={whatsAppLink(
                  barbershop.phone,
                  customerNoticeMessage({
                    customerName: customer.name,
                    serviceName: service.name,
                    dayLabel: formatDayLong(dateIso),
                    timeLabel: slot.label,
                    barbershopName: barbershop.name,
                    barberName: selectedBarber?.full_name,
                  }),
                )}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ size: "lg" }), "h-12 w-full gap-2 text-base")}
              >
                <MessageCircle className="size-5" />
                Avisar a barbearia no WhatsApp
              </a>
            )}
            {publicToken && (
              <a
                href={`/h/${publicToken}`}
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 w-full text-base")}
              >
                Acompanhar meu horário
              </a>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                setSlot(null);
                setDateIso(null);
                setBarberId(null);
                setAssignedBarberId(null);
                setPublicToken(null);
                setStep("service");
              }}
            >
              Fazer outro agendamento
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ShopHeader({ barbershop }: { barbershop: PublicBarbershop }) {
  return (
    <header className="space-y-2 border-b bg-primary px-5 pb-5 pt-8 text-primary-foreground">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary-foreground/15">
        <Scissors className="size-6" />
      </div>
      <h1 className="text-2xl font-semibold">{barbershop.name}</h1>
      <div className="space-y-1 text-sm opacity-80">
        {barbershop.address && (
          <p className="flex items-start gap-1.5">
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            {barbershop.address}
          </p>
        )}
        {barbershop.hoursSummary && (
          <p className="flex items-start gap-1.5">
            <Clock className="mt-0.5 size-3.5 shrink-0" />
            {barbershop.hoursSummary}
          </p>
        )}
      </div>
    </header>
  );
}

function ChoiceButton({
  selected,
  onClick,
  icon,
  title,
  subtitle,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left transition hover:border-primary",
        selected && "border-primary",
      )}
    >
      <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <p className="font-medium">{title}</p>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </button>
  );
}

function Summary({
  service,
  dateIso,
  timeLabel,
  barberName,
}: {
  service: Service;
  dateIso: string;
  timeLabel: string;
  barberName?: string;
}) {
  return (
    <div className="space-y-2 rounded-xl border bg-muted/40 p-4 text-sm">
      <div className="flex justify-between gap-2">
        <p className="font-medium">{service.name}</p>
        <p className="font-semibold">{formatCurrency(service.price)}</p>
      </div>
      <p className="flex items-center gap-2 capitalize text-muted-foreground">
        <Clock className="size-4" />
        {formatDayLong(dateIso)}, às {timeLabel}
      </p>
      {barberName && (
        <p className="flex items-center gap-2 text-muted-foreground">
          <User className="size-4" />
          com {barberName}
        </p>
      )}
    </div>
  );
}

function stepTitle(step: Step) {
  switch (step) {
    case "service":
      return "Escolha o serviço";
    case "barber":
      return "Com quem?";
    case "datetime":
      return "Dia e horário";
    case "details":
      return "Seus dados";
    case "success":
      return "Tudo certo!";
  }
}
