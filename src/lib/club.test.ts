import { describe, expect, it } from "vitest";
import { dueStatus, minusOneMonth, splitPot } from "./club";
import { averageTicket, commissionFor } from "./team-stats";

describe("dueStatus", () => {
  it("separa em dia, vence logo e vencido", () => {
    expect(dueStatus("2026-11-30", "2026-11-20")).toBe("em_dia");
    expect(dueStatus("2026-11-23", "2026-11-20")).toBe("vence_logo");
    expect(dueStatus("2026-11-20", "2026-11-20")).toBe("vence_logo");
    expect(dueStatus("2026-11-19", "2026-11-20")).toBe("vencido");
  });
});

describe("minusOneMonth", () => {
  it("volta um mês sem estourar o fim do mês", () => {
    expect(minusOneMonth("2026-03-31")).toBe("2026-02-28");
    expect(minusOneMonth("2028-03-31")).toBe("2028-02-29");
    expect(minusOneMonth("2026-01-15")).toBe("2025-12-15");
  });
});

describe("splitPot", () => {
  it("divide pelos minutos e não perde centavos", () => {
    const r = splitPot(100, { a: 60, b: 30, c: 30 });
    expect(r).toEqual({ a: 50, b: 25, c: 25 });
    const odd = splitPot(100, { a: 1, b: 1, c: 1 });
    expect(Object.values(odd).reduce((s, v) => s + v, 0)).toBeCloseTo(100, 2);
  });

  it("sem pote ou sem minutos não divide nada", () => {
    expect(splitPot(0, { a: 10 })).toEqual({});
    expect(splitPot(50, { a: 0 })).toEqual({});
  });
});

describe("comissão e ticket", () => {
  it("aplica % de serviço e produto separadas", () => {
    expect(commissionFor({ serviceRevenue: 1000, productRevenue: 200 }, 40, 10)).toBe(420);
  });

  it("ticket médio ignora atendimentos do Clube", () => {
    expect(averageTicket({ services: 12, planServices: 2, serviceRevenue: 450, productRevenue: 50 })).toBe(50);
    expect(averageTicket({ services: 2, planServices: 2, serviceRevenue: 0, productRevenue: 0 })).toBe(0);
  });
});
