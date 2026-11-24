import { describe, expect, it } from "vitest";
import { MAX_OCCURRENCES, seriesDates } from "./recurring";

describe("seriesDates", () => {
  it("repete a cada N semanas atravessando mês e ano", () => {
    expect(seriesDates("2026-12-17", 2, 3)).toEqual(["2026-12-17", "2026-12-31", "2027-01-14"]);
  });

  it("limita a quantidade e a frequência", () => {
    expect(seriesDates("2026-01-05", 1, 999)).toHaveLength(MAX_OCCURRENCES);
    expect(seriesDates("2026-01-05", 0, 2)).toEqual(["2026-01-05", "2026-01-12"]);
  });
});
