import { Trash2 } from "lucide-react";
import { ActionButton, ActionForm } from "@/components/action-form";
import { Card, Empty, List, Page, PageHeader, Section, fieldClass } from "@/components/page-ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireStaff } from "@/lib/auth";
import { formatTime, todayIso } from "@/lib/time";
import type { TimeBlock } from "@/lib/supabase/types";
import { createBlock, deleteBlock } from "./actions";

export default async function BlocksPage() {
  const { supabase, profile, barbershop } = await requireStaff();
  const isOwner = profile.role === "owner";
  const tz = barbershop.timezone;
  const today = todayIso(tz);

  const [{ data: blocks }, { data: staff }] = await Promise.all([
    supabase
      .from("time_blocks")
      .select("*")
      .gt("ends_at", new Date().toISOString())
      .order("starts_at")
      .limit(200),
    supabase.from("users").select("id, full_name").eq("active", true).order("full_name"),
  ]);
  const names = new Map((staff ?? []).map((s) => [s.id, s.full_name]));

  const fmt = (iso: string) =>
    `${new Date(iso).toLocaleDateString("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit" })} ${formatTime(iso, tz)}`;

  return (
    <Page>
      <PageHeader
        title="Bloqueios"
        description="Folga, férias, médico ou intervalo. O horário bloqueado some da agenda online e do encaixe."
      />

      <Card>
        <ActionForm action={createBlock} submitLabel="Bloquear" successMessage="Horário bloqueado!" resetOnSuccess>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="barberId">De quem</Label>
              {isOwner ? (
                <select id="barberId" name="barberId" className={fieldClass} defaultValue="todos">
                  <option value="todos">Barbearia toda (fechada)</option>
                  {(staff ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm">{profile.full_name}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Início</Label>
              <Input id="startDate" name="startDate" type="date" required min={today} defaultValue={today} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="startTime">Hora de início (vazio = dia todo)</Label>
              <Input id="startTime" name="startTime" type="time" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">Fim (vazio = mesmo dia)</Label>
              <Input id="endDate" name="endDate" type="date" min={today} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endTime">Hora do fim (vazio = fim do dia)</Label>
              <Input id="endTime" name="endTime" type="time" className="h-11" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="reason">Motivo (opcional)</Label>
              <Input id="reason" name="reason" maxLength={80} placeholder="Férias, médico, curso…" className="h-11" />
            </div>
          </div>
        </ActionForm>
      </Card>

      <Section title="Próximos bloqueios">
        {(blocks ?? []).length === 0 ? (
          <Empty>Nenhum bloqueio marcado.</Empty>
        ) : (
          <List>
            {(blocks as TimeBlock[]).map((b) => {
              const canDelete = isOwner || b.barber_id === profile.id;
              return (
                <li key={b.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {b.barber_id ? (names.get(b.barber_id) ?? "Barbeiro removido") : "Barbearia toda"}
                      {b.reason ? ` · ${b.reason}` : ""}
                    </p>
                    <p className="text-muted-foreground">
                      {fmt(b.starts_at)} → {fmt(b.ends_at)}
                    </p>
                  </div>
                  {canDelete && (
                    <ActionButton
                      action={deleteBlock}
                      fields={{ id: b.id }}
                      variant="ghost"
                      confirm="Remover este bloqueio?"
                      successMessage="Bloqueio removido."
                    >
                      <Trash2 className="size-4" />
                    </ActionButton>
                  )}
                </li>
              );
            })}
          </List>
        )}
      </Section>
    </Page>
  );
}
