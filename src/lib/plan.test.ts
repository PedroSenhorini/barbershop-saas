import { describe, expect, it } from "vitest";
import { trialDaysLeft, trialNotice } from "./plan";
import { normalizeReferralCode } from "./referral";

const NOW = Date.parse("2026-11-23T12:00:00Z");

describe("trialDaysLeft", () => {
  it("só existe no plano de teste com data", () => {
    expect(trialDaysLeft({ plan: "ativo", trial_ends_at: "2026-11-30T12:00:00Z" }, NOW)).toBeNull();
    expect(trialDaysLeft({ plan: "teste", trial_ends_at: null }, NOW)).toBeNull();
  });

  it("arredonda para cima e fica negativo depois do fim", () => {
    expect(trialDaysLeft({ plan: "teste", trial_ends_at: "2026-11-30T12:00:00Z" }, NOW)).toBe(7);
    expect(trialDaysLeft({ plan: "teste", trial_ends_at: "2026-11-24T08:00:00Z" }, NOW)).toBe(1);
    expect(trialDaysLeft({ plan: "teste", trial_ends_at: "2026-11-20T12:00:00Z" }, NOW)).toBe(-3);
  });
});

describe("trialNotice", () => {
  it("escreve o aviso certo para cada caso", () => {
    expect(trialNotice(null)).toBeNull();
    expect(trialNotice(5)).toBe("Seu período de teste termina em 5 dias.");
    expect(trialNotice(1)).toBe("Seu período de teste termina amanhã.");
    expect(trialNotice(0)).toBe("Seu período de teste termina hoje.");
    expect(trialNotice(-1)).toBe("Seu período de teste terminou.");
  });
});

describe("normalizeReferralCode", () => {
  it("aceita 8 letras/números e põe em maiúsculas", () => {
    expect(normalizeReferralCode(" ab12cd34 ")).toBe("AB12CD34");
    expect(normalizeReferralCode("AB12")).toBeNull();
    expect(normalizeReferralCode(["AB12CD34"])).toBeNull();
    expect(normalizeReferralCode("AB12CD3!")).toBeNull();
  });
});
