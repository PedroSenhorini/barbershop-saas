import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  dateIsoInZone,
  formatTime,
  fromMinutes,
  isValidDateIso,
  toMinutes,
  weekdayOf,
  zonedDateTime,
} from "@/lib/time";

const SP = "America/Sao_Paulo";

describe("zonedDateTime", () => {
  it("interpreta o horário no fuso da barbearia, não no do servidor", () => {
    // São Paulo é UTC-3 o ano todo (sem horário de verão desde 2019).
    expect(zonedDateTime("2026-11-19", "09:30", SP).toISOString()).toBe("2026-11-19T12:30:00.000Z");
    expect(zonedDateTime("2026-11-19", "09:30", "UTC").toISOString()).toBe("2026-11-19T09:30:00.000Z");
  });

  it("meia-noite em São Paulo ainda é 03:00 em UTC", () => {
    expect(zonedDateTime("2026-11-19", "00:00", SP).toISOString()).toBe("2026-11-19T03:00:00.000Z");
  });

  it("acerta os dois lados de uma mudança de horário de verão", () => {
    // Nova York adianta o relógio em 2026-03-08: EST (-5) → EDT (-4).
    expect(zonedDateTime("2026-03-07", "12:00", "America/New_York").toISOString()).toBe("2026-03-07T17:00:00.000Z");
    expect(zonedDateTime("2026-03-08", "12:00", "America/New_York").toISOString()).toBe("2026-03-08T16:00:00.000Z");
  });
});

describe("dateIsoInZone (virada de dia)", () => {
  // 22:00 de quinta em São Paulo = 01:00 de sexta em UTC.
  const lateNight = new Date("2026-11-20T01:00:00Z");

  it("em São Paulo ainda é o dia anterior", () => {
    expect(dateIsoInZone(lateNight, SP)).toBe("2026-11-19");
  });

  it("em UTC já virou o dia", () => {
    expect(dateIsoInZone(lateNight, "UTC")).toBe("2026-11-20");
  });

  it("volta ao mesmo dia que zonedDateTime gerou", () => {
    const late = zonedDateTime("2026-11-19", "23:30", SP);
    expect(dateIsoInZone(late, SP)).toBe("2026-11-19");
    expect(formatTime(late, SP)).toBe("23:30");
  });
});

describe("addDaysIso", () => {
  it("atravessa mês e ano", () => {
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysIso("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDaysIso("2028-03-01", -1)).toBe("2028-02-29");
  });
});

describe("weekdayOf", () => {
  it("0 = domingo, independente do fuso do processo", () => {
    expect(weekdayOf("2026-11-19")).toBe(4); // quinta
    expect(weekdayOf("2026-11-22")).toBe(0); // domingo
  });
});

describe("isValidDateIso", () => {
  it("aceita só YYYY-MM-DD válido", () => {
    expect(isValidDateIso("2026-11-19")).toBe(true);
    expect(isValidDateIso("2026-13-01")).toBe(false);
    expect(isValidDateIso("19/11/2026")).toBe(false);
    expect(isValidDateIso("")).toBe(false);
    expect(isValidDateIso(undefined)).toBe(false);
  });
});

describe("toMinutes / fromMinutes", () => {
  it("convertem ida e volta", () => {
    expect(toMinutes("09:30")).toBe(570);
    expect(fromMinutes(570)).toBe("09:30");
    expect(fromMinutes(0)).toBe("00:00");
  });
});

describe("formatTime", () => {
  it("mostra a hora no fuso pedido", () => {
    expect(formatTime(new Date("2026-11-20T01:00:00Z"), SP)).toBe("22:00");
    expect(formatTime("2026-11-20T01:00:00Z", "UTC")).toBe("01:00");
  });
});
