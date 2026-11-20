import { describe, expect, it } from "vitest";
import { computeFreeSlots, type BusyInterval } from "@/lib/slots";
import { zonedDateTime } from "@/lib/time";
import type { DayHours } from "@/lib/supabase/types";

const SP = "America/Sao_Paulo";
const DATE = "2026-11-19";
const at = (time: string) => zonedDateTime(DATE, time, SP).getTime();
const busy = (from: string, to: string, barberId: string | null): BusyInterval => ({
  start: at(from),
  end: at(to),
  barberId,
});

// 09:00–11:00, serviço de 30 min → 09:00, 09:30, 10:00, 10:30.
const morning: DayHours = { open: "09:00", close: "11:00", breakStart: null, breakEnd: null };

function free(opts: Partial<Parameters<typeof computeFreeSlots>[0]> = {}) {
  return computeFreeSlots({
    dateIso: DATE,
    day: morning,
    durationMinutes: 30,
    timeZone: SP,
    busy: [],
    barberIds: ["ana", "beto"],
    barberId: null,
    now: 0, // tudo no futuro
    ...opts,
  }).map((s) => ({ label: s.label, barberIds: s.barberIds }));
}

describe("computeFreeSlots", () => {
  it("agenda vazia: todos os horários, com todos os barbeiros", () => {
    expect(free()).toEqual([
      { label: "09:00", barberIds: ["ana", "beto"] },
      { label: "09:30", barberIds: ["ana", "beto"] },
      { label: "10:00", barberIds: ["ana", "beto"] },
      { label: "10:30", barberIds: ["ana", "beto"] },
    ]);
  });

  it("dia fechado não tem horários", () => {
    expect(free({ day: null })).toEqual([]);
  });

  describe("sobreposição", () => {
    it("tira só o barbeiro ocupado; o horário segue livre com o outro", () => {
      expect(free({ busy: [busy("09:00", "10:00", "ana")] })).toEqual([
        { label: "09:00", barberIds: ["beto"] },
        { label: "09:30", barberIds: ["beto"] },
        { label: "10:00", barberIds: ["ana", "beto"] },
        { label: "10:30", barberIds: ["ana", "beto"] },
      ]);
    });

    it("encostar no fim de outro agendamento não é sobrepor", () => {
      const slots = free({ barberIds: ["ana"], busy: [busy("09:00", "09:30", "ana")] });
      expect(slots.map((s) => s.label)).toEqual(["09:30", "10:00", "10:30"]);
    });

    it("serviço longo não pode invadir um agendamento que começa no meio", () => {
      const slots = free({
        barberIds: ["ana"],
        durationMinutes: 60,
        busy: [busy("09:30", "10:00", "ana")],
      });
      // 09:00–10:00 e 09:30–10:30 batem em 09:30–10:00.
      expect(slots.map((s) => s.label)).toEqual(["10:00"]);
    });

    it("todos ocupados: o horário some", () => {
      const slots = free({ busy: [busy("09:00", "09:30", "ana"), busy("09:00", "09:30", "beto")] });
      expect(slots.map((s) => s.label)).toEqual(["09:30", "10:00", "10:30"]);
    });
  });

  describe("barbeiro específico vs. qualquer um", () => {
    it("com barbeiro escolhido, só os horários livres dele", () => {
      const slots = free({ barberId: "ana", busy: [busy("09:00", "09:30", "ana")] });
      expect(slots).toEqual([
        { label: "09:30", barberIds: ["ana"] },
        { label: "10:00", barberIds: ["ana"] },
        { label: "10:30", barberIds: ["ana"] },
      ]);
    });

    it("a agenda de outro barbeiro não afeta o escolhido", () => {
      const slots = free({ barberId: "beto", busy: [busy("09:00", "11:00", "ana")] });
      expect(slots.map((s) => s.label)).toEqual(["09:00", "09:30", "10:00", "10:30"]);
    });

    it("barbeiro que não atende (fora da lista) não tem horários", () => {
      expect(free({ barberId: "carlos" })).toEqual([]);
    });
  });

  describe("agendamento sem barbeiro", () => {
    it("ocupa a capacidade de alguém da equipe", () => {
      // Ana ocupada + um sem barbeiro às 09:00 = equipe de 2 cheia.
      const slots = free({ busy: [busy("09:00", "09:30", "ana"), busy("09:00", "09:30", null)] });
      expect(slots.map((s) => s.label)).toEqual(["09:30", "10:00", "10:30"]);
    });

    it("bloqueia até quem foi escolhido e está livre, se a equipe lotou", () => {
      const slots = free({
        barberId: "beto",
        busy: [busy("09:00", "09:30", "ana"), busy("09:00", "09:30", null)],
      });
      expect(slots.map((s) => s.label)).toEqual(["09:30", "10:00", "10:30"]);
    });

    it("sozinho, deixa o horário com quem sobrou", () => {
      const slots = free({ busy: [busy("09:00", "09:30", null)] });
      expect(slots[0]).toEqual({ label: "09:00", barberIds: ["ana", "beto"] });
    });
  });

  describe("horários no passado", () => {
    it("some o que já começou ou passou", () => {
      expect(free({ now: at("10:00") }).map((s) => s.label)).toEqual(["10:30"]);
    });

    it("o painel (includePast) ainda vê o dia inteiro, para encaixe", () => {
      expect(free({ now: at("10:00"), includePast: true }).map((s) => s.label)).toEqual([
        "09:00", "09:30", "10:00", "10:30",
      ]);
    });
  });
});
