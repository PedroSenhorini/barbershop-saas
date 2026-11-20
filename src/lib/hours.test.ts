import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEEKLY_HOURS,
  generateDaySlots,
  hoursForDate,
  summarizeHours,
  weeklyHoursSchema,
} from "@/lib/hours";
import { formatTime } from "@/lib/time";
import type { DayHours } from "@/lib/supabase/types";

const SP = "America/Sao_Paulo";
const labels = (slots: Date[]) => slots.map((s) => formatTime(s, SP));

describe("hoursForDate", () => {
  it("domingo fechado no expediente padrão", () => {
    expect(hoursForDate(DEFAULT_WEEKLY_HOURS, "2026-11-22")).toBeNull();
  });

  it("devolve o expediente do dia da semana", () => {
    expect(hoursForDate(DEFAULT_WEEKLY_HOURS, "2026-11-21")).toEqual({
      open: "09:00",
      close: "17:00",
      breakStart: null,
      breakEnd: null,
    });
  });
});

describe("generateDaySlots", () => {
  const withLunch: DayHours = { open: "09:00", close: "14:00", breakStart: "12:00", breakEnd: "13:00" };

  it("pula o intervalo de almoço", () => {
    expect(labels(generateDaySlots("2026-11-19", withLunch, 30, SP))).toEqual([
      "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "13:00", "13:30",
    ]);
  });

  it("não oferece serviço que atravessaria o almoço", () => {
    // 11:30 + 60 min invadiria 12:00–13:00.
    expect(labels(generateDaySlots("2026-11-19", withLunch, 60, SP))).toEqual([
      "09:00", "09:30", "10:00", "10:30", "11:00", "13:00",
    ]);
  });

  it("o serviço precisa caber inteiro antes de fechar", () => {
    const short: DayHours = { open: "09:00", close: "10:00", breakStart: null, breakEnd: null };
    expect(labels(generateDaySlots("2026-11-19", short, 60, SP))).toEqual(["09:00"]);
    expect(generateDaySlots("2026-11-19", short, 90, SP)).toEqual([]);
  });

  it("gera os horários no fuso da barbearia", () => {
    const [first] = generateDaySlots("2026-11-19", withLunch, 30, SP);
    expect(first.toISOString()).toBe("2026-11-19T12:00:00.000Z");
  });
});

describe("weeklyHoursSchema", () => {
  const open: DayHours = { open: "09:00", close: "18:00", breakStart: null, breakEnd: null };

  it("recusa a semana toda fechada", () => {
    expect(weeklyHoursSchema.safeParse(Array(7).fill(null)).success).toBe(false);
  });

  it("recusa intervalo fora do expediente", () => {
    const bad = { ...open, breakStart: "17:30", breakEnd: "18:30" };
    expect(weeklyHoursSchema.safeParse([null, bad, null, null, null, null, null]).success).toBe(false);
  });

  it("recusa intervalo pela metade", () => {
    const bad = { ...open, breakStart: "12:00", breakEnd: null };
    expect(weeklyHoursSchema.safeParse([null, bad, null, null, null, null, null]).success).toBe(false);
  });

  it("aceita o expediente padrão", () => {
    expect(weeklyHoursSchema.safeParse(DEFAULT_WEEKLY_HOURS).success).toBe(true);
  });
});

describe("summarizeHours", () => {
  it("agrupa dias seguidos com o mesmo horário", () => {
    expect(summarizeHours(DEFAULT_WEEKLY_HOURS)).toBe("Seg a Sex 09:00–19:00 · Sáb 09:00–17:00");
  });
});
