"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDuration, maskPhone } from "@/lib/format";
import type { BookableBarber, Slot } from "@/lib/availability";
import type { Service } from "@/lib/supabase/types";
import { createManualAppointment, getPanelSlots } from "./actions";

export function NewAppointmentDialog({
  dateIso,
  services,
  barbers,
  onCreated,
}: {
  dateIso: string;
  services: Pick<Service, "id" | "name" | "duration_minutes" | "price">[];
  barbers: BookableBarber[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [barberId, setBarberId] = useState<string | null>(
    barbers.length === 1 ? barbers[0].id : null,
  );
  const [date, setDate] = useState(dateIso);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();

  function refreshSlots(next: { serviceId?: string; barberId?: string | null; date?: string }) {
    const s = next.serviceId ?? serviceId;
    const b = next.barberId !== undefined ? next.barberId : barberId;
    const d = next.date ?? date;
    setSlot(null);
    if (!s || !d) return;
    startLoading(async () => {
      const result = await getPanelSlots(s, b, d);
      if ("error" in result) {
        toast.error(result.error);
        setSlots([]);
        return;
      }
      setSlots(result.slots);
    });
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setDate(dateIso);
      setName("");
      setPhone("");
      refreshSlots({ date: dateIso });
    }
  }

  function submit() {
    if (!slot) return;
    startSaving(async () => {
      const result = await createManualAppointment({
        serviceId,
        barberId,
        scheduledAt: slot,
        customerName: name,
        customerPhone: phone,
      });
      if ("error" in result) {
        toast.error(result.error);
        refreshSlots({});
        return;
      }
      toast.success("Agendamento criado!");
      setOpen(false);
      onCreated();
    });
  }

  const trigger = (
    <DialogTrigger
      render={
        <Button size="lg" className="h-10 gap-1.5">
          <Plus className="size-4" />
          Novo
          {/* Em telas estreitas o texto completo não cabe ao lado de Lista/Quadro. */}
          <span className="hidden min-[420px]:inline">agendamento</span>
        </Button>
      }
    />
  );

  if (services.length === 0) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {trigger}
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo agendamento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cadastre pelo menos um serviço ativo para criar agendamentos.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger}
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="na-service">Serviço</Label>
            <NativeSelect
              id="na-service"
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                refreshSlots({ serviceId: e.target.value });
              }}
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {formatDuration(s.duration_minutes)} — {formatCurrency(Number(s.price))}
                </option>
              ))}
            </NativeSelect>
          </div>

          {barbers.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="na-barber">Profissional</Label>
              <NativeSelect
                id="na-barber"
                value={barberId ?? ""}
                onChange={(e) => {
                  const value = e.target.value || null;
                  setBarberId(value);
                  refreshSlots({ barberId: value });
                }}
              >
                <option value="">Quem estiver livre</option>
                {barbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.full_name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="na-date">Dia</Label>
            <Input
              id="na-date"
              type="date"
              className="h-11 text-base"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                refreshSlots({ date: e.target.value });
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Horário</Label>
            {loading || slots === null ? (
              <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Buscando horários...
              </p>
            ) : slots.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                Nenhum horário livre nesse dia.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {slots.map((s) => (
                  <button
                    type="button"
                    key={s.iso}
                    onClick={() => setSlot(s.iso)}
                    className={cn(
                      "h-10 rounded-lg border text-sm font-medium",
                      slot === s.iso && "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="na-name">Nome do cliente</Label>
            <Input id="na-name" className="h-11 text-base" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="na-phone">WhatsApp (opcional)</Label>
            <Input
              id="na-phone"
              type="tel"
              inputMode="numeric"
              className="h-11 text-base"
              placeholder="(11) 91234-5678"
              value={maskPhone(phone)}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="h-11 w-full text-base"
            disabled={saving || !slot || name.trim().length < 2}
          >
            {saving ? <Loader2 className="size-5 animate-spin" /> : "Salvar agendamento"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
