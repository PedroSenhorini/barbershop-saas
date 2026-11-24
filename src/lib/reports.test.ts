import { describe, expect, it } from "vitest";
import type { WeeklyHours } from "./supabase/types";
import {
  capacityMinutes,
  countBySource,
  lastMonths,
  occupancyPercent,
  openMinutes,
  revenueByMonth,
  topServices,
  type FinishedRow,
} from "./reports";

const corte = { id: "s1", name: "Corte", price: 40 };
const barba = { id: "s2", name: "Barba", price: 30 };

const row = (over: Partial<FinishedRow>): FinishedRow => ({
  month: "2026-11",
  payment_method: "pix",
  amount_paid: null,
  service: corte,
  ...over,
});

// Domingo fechado; seg–sex 09–19 com almoço 12–13; sábado 09–13.
const WEEK: WeeklyHours = [
  null,
  { open: "09:00", close: "19:00", breakStart: "12:00", breakEnd: "13:00" },
  { open: "09:00", close: "19:00", breakStart: "12:00", breakEnd: "13:00" },
  { open: "09:00", close: "19:00", breakStart: "12:00", breakEnd: "13:00" },
  { open: "09:00", close: "19:00", breakStart: "12:00", breakEnd: "13:00" },
  { open: "09:00", close: "19:00", breakStart: "12:00", breakEnd: "13:00" },
  { open: "09:00", close: "13:00", breakStart: null, breakEnd: null },
];

describe("lastMonths", () => {
  it("volta meses atravessando o ano", () => {
    expect(lastMonths("2026-02", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("revenueByMonth", () => {
  it("soma serviços, produtos e Clube por mês e ignora o atendimento pelo plano", () => {
    const result = revenueByMonth(
      ["2026-10", "2026-11"],
      [
        row({ amount_paid: 50 }),
        row({ payment_method: "fiado" }),
        row({ payment_method: "plano" }),
        row({ month: "2026-10", service: barba }),
        row({ month: "2026-09", amount_paid: 999 }),
      ],
      [{ month: "2026-11", total: 25.5 }],
      [{ month: "2026-11", amount: 100 }],
    );
    expect(result).toEqual([
      { month: "2026-10", services: 30, products: 0, club: 0, total: 30 },
      { month: "2026-11", services: 90, products: 25.5, club: 100, total: 215.5 },
    ]);
  });
});

describe("topServices", () => {
  it("ordena pelo mais feito e conta o plano na quantidade, não na receita", () => {
    const result = topServices([
      row({}),
      row({ payment_method: "plano" }),
      row({ service: barba }),
      row({ service: null }),
    ]);
    expect(result).toEqual([
      { name: "Corte", count: 2, revenue: 40 },
      { name: "Barba", count: 1, revenue: 30 },
    ]);
  });
});

describe("countBySource", () => {
  it("agrupa origem nula junto", () => {
    expect(countBySource([{ source: "instagram" }, { source: null }, { source: "instagram" }])).toEqual([
      { source: "instagram", count: 2 },
      { source: null, count: 1 },
    ]);
  });
});

describe("ocupação", () => {
  it("desconta o intervalo de almoço e respeita dia fechado", () => {
    expect(openMinutes(WEEK, "2026-11-23")).toBe(540); // segunda
    expect(openMinutes(WEEK, "2026-11-28")).toBe(240); // sábado
    expect(openMinutes(WEEK, "2026-11-22")).toBe(0); // domingo
  });

  it("multiplica pela equipe e limita a 100%", () => {
    // seg 23 a dom 29: 5×540 + 240 = 2940 min por barbeiro
    expect(capacityMinutes(WEEK, "2026-11-23", "2026-11-29", 2)).toBe(5880);
    expect(occupancyPercent(2940, 5880)).toBe(50);
    expect(occupancyPercent(10_000, 5880)).toBe(100);
    expect(occupancyPercent(10, 0)).toBe(0);
  });
});

describe("returningSplit", () => {
  it("separa quem já tinha vindo antes do mês de quem é novo", async () => {
    const { returningSplit } = await import("./team-stats");
    const start = Date.parse("2026-11-01T03:00:00Z");
    const first = new Map<string, string | null>([
      ["a", "2026-08-10T15:00:00+00:00"],
      ["b", "2026-11-05T15:00:00+00:00"],
      ["c", null],
    ]);
    expect(returningSplit(["a", "b", "c"], first, start)).toEqual({ returning: 1, newcomers: 2 });
  });
});
