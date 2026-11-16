"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DAY_NAMES } from "@/lib/hours";
import { maskPhone } from "@/lib/format";
import type { Barbershop, DayHours, WeeklyHours } from "@/lib/supabase/types";
import { saveSettings } from "./actions";

/** Segunda primeiro: é como o barbeiro pensa a semana. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DEFAULT_DAY: DayHours = { open: "09:00", close: "19:00", breakStart: null, breakEnd: null };

export function SettingsForm({ barbershop, siteUrl }: { barbershop: Barbershop; siteUrl: string }) {
  const [state, formAction, isPending] = useActionState(saveSettings, { error: null });
  const [name, setName] = useState(barbershop.name);
  const [address, setAddress] = useState(barbershop.address ?? "");
  const [phone, setPhone] = useState(barbershop.phone ?? "");
  const [slug, setSlug] = useState(barbershop.slug);
  const [hours, setHours] = useState<WeeklyHours>(barbershop.weekly_hours);

  useEffect(() => {
    if (state.ok) toast.success("Ajustes salvos!");
  }, [state.ok]);

  function updateDay(day: number, value: DayHours | null) {
    setHours((prev) => prev.map((d, i) => (i === day ? value : d)));
  }

  function copyToAllOpenDays(day: number) {
    const source = hours[day];
    if (!source) return;
    setHours((prev) => prev.map((d) => (d ? { ...source } : d)));
    toast.success("Horário copiado para todos os dias abertos.");
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="weeklyHours" value={JSON.stringify(hours)} />

      <section className="space-y-4 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Barbearia</h2>
        <div className="space-y-1.5">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" name="name" required value={name} onChange={(e) => setName(e.target.value)} className="h-11 text-base" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">WhatsApp</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            required
            className="h-11 text-base"
            value={maskPhone(phone)}
            onChange={(e) => setPhone(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            O cliente usa esse número para falar com você depois de agendar.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address">Endereço (opcional)</Label>
          <Input
            id="address"
            name="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Rua, número — bairro, cidade"
            className="h-11 text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="slug">Seu link</Label>
          <div className="flex h-11 items-center overflow-hidden rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
            <span className="shrink-0 border-r bg-muted px-3 py-2.5 text-sm text-muted-foreground">
              {siteUrl.replace(/^https?:\/\//, "")}/
            </span>
            <input
              id="slug"
              name="slug"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              className="h-full min-w-0 flex-1 bg-transparent px-2 text-base outline-none md:text-sm"
            />
          </div>
          {slug !== barbershop.slug && (
            <p className="text-xs text-amber-700">
              Atenção: o link antigo vai parar de funcionar. Atualize onde você já divulgou.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div>
          <h2 className="font-semibold">Horário de funcionamento</h2>
          <p className="text-sm text-muted-foreground">
            Os clientes só conseguem agendar dentro desses horários.
          </p>
        </div>
        <ul className="divide-y">
          {WEEK_ORDER.map((day) => (
            <DayRow
              key={day}
              label={DAY_NAMES[day]}
              value={hours[day]}
              onChange={(value) => updateDay(day, value)}
              onCopyToAll={() => copyToAllOpenDays(day)}
            />
          ))}
        </ul>
      </section>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="sticky bottom-20 md:bottom-4">
        <Button type="submit" size="lg" className="h-12 w-full text-base shadow-lg" disabled={isPending}>
          {isPending ? <Loader2 className="size-5 animate-spin" /> : "Salvar ajustes"}
        </Button>
      </div>
    </form>
  );
}

function DayRow({
  label,
  value,
  onChange,
  onCopyToAll,
}: {
  label: string;
  value: DayHours | null;
  onChange: (value: DayHours | null) => void;
  onCopyToAll: () => void;
}) {
  const hasBreak = !!value?.breakStart;

  return (
    <li className="space-y-2 py-3">
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 font-medium">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked ? { ...DEFAULT_DAY } : null)}
          />
          {label}
        </label>
        {value ? (
          <button type="button" onClick={onCopyToAll} className="text-xs text-primary hover:underline">
            Copiar para todos
          </button>
        ) : (
          <span className="text-sm text-muted-foreground">Fechado</span>
        )}
      </div>

      {value && (
        <div className="space-y-2 pl-6">
          <div className="flex items-center gap-2 text-sm">
            <TimeInput value={value.open} onChange={(open) => onChange({ ...value, open })} label={`${label}: abre`} />
            <span className="text-muted-foreground">até</span>
            <TimeInput value={value.close} onChange={(close) => onChange({ ...value, close })} label={`${label}: fecha`} />
          </div>
          {hasBreak ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Almoço</span>
              <TimeInput
                value={value.breakStart!}
                onChange={(breakStart) => onChange({ ...value, breakStart })}
                label={`${label}: início do intervalo`}
              />
              <span className="text-muted-foreground">até</span>
              <TimeInput
                value={value.breakEnd!}
                onChange={(breakEnd) => onChange({ ...value, breakEnd })}
                label={`${label}: fim do intervalo`}
              />
              <button
                type="button"
                className="text-xs text-muted-foreground hover:underline"
                onClick={() => onChange({ ...value, breakStart: null, breakEnd: null })}
              >
                remover
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => onChange({ ...value, breakStart: "12:00", breakEnd: "13:00" })}
            >
              + Adicionar intervalo de almoço
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function TimeInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <input
      type="time"
      step={1800}
      aria-label={label}
      value={value}
      onChange={(e) => e.target.value && onChange(e.target.value.slice(0, 5))}
      className="h-10 rounded-lg border border-input bg-background px-2 text-base md:text-sm"
    />
  );
}
