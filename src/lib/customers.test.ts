import { describe, expect, it } from "vitest";
import { customerInsight, formatDaysAgo, matchesCustomerSearch } from "./customers";

const NOW = new Date("2026-06-30T15:00:00Z");

function daysAgo(days: number) {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

function stats(visitDaysAgo: number[], nextAppointment: string | null = null) {
  const sorted = [...visitDaysAgo].sort((a, b) => b - a);
  return {
    visits: sorted.length,
    first_visit_at: sorted.length ? daysAgo(sorted[0]) : null,
    last_visit_at: sorted.length ? daysAgo(sorted[sorted.length - 1]) : null,
    next_appointment_at: nextAppointment,
  };
}

describe("customerInsight", () => {
  it("sem atendimento finalizado é sem_visita", () => {
    const r = customerInsight(stats([], daysAgo(-2)), NOW);
    expect(r.status).toBe("sem_visita");
    expect(r.daysSinceLastVisit).toBeNull();
    expect(r.expectedReturnAt).toBeNull();
  });

  it("primeira visita recente é novo", () => {
    expect(customerInsight(stats([10]), NOW).status).toBe("novo");
  });

  it("uma visita só usa a frequência padrão de 30 dias: sumido depois de 45", () => {
    expect(customerInsight(stats([45]), NOW).status).toBe("ativo");
    expect(customerInsight(stats([46]), NOW).status).toBe("sumido");
  });

  it("frequência vem das visitas do próprio cliente", () => {
    // Vem a cada 14 dias: some depois de 21 (mínimo), não de 45.
    const weekly = customerInsight(stats([78, 64, 50, 36, 22]), NOW);
    expect(weekly.averageIntervalDays).toBe(14);
    expect(weekly.status).toBe("sumido");

    // Vem a cada 60 dias: 50 dias sem vir ainda é normal.
    const bimonthly = customerInsight(stats([230, 170, 110, 50]), NOW);
    expect(bimonthly.averageIntervalDays).toBe(60);
    expect(bimonthly.status).toBe("ativo");
  });

  it("quem tem horário marcado nunca é sumido", () => {
    const r = customerInsight(stats([200], daysAgo(-3)), NOW);
    expect(r.status).not.toBe("sumido");
  });

  it("nunca considera sumido antes de 3 semanas, mesmo com frequência alta", () => {
    // Vem a cada 7 dias; 20 dias sem vir ainda não é sumido.
    expect(customerInsight(stats([48, 41, 34, 27, 20]), NOW).status).toBe("ativo");
  });

  it("frequência tem teto, para o cliente esporádico não ficar ativo para sempre", () => {
    // Uma visita por ano: o teto de 120 dias faz sumir após 180.
    expect(customerInsight(stats([900, 535, 170]), NOW).status).toBe("ativo");
    expect(customerInsight(stats([900, 535, 181]), NOW).status).toBe("sumido");
  });

  it("duas visitas no mesmo dia não viram frequência zero", () => {
    const r = customerInsight(stats([5, 5]), NOW);
    expect(r.averageIntervalDays).toBe(1);
  });

  it("calcula atraso em relação à volta esperada", () => {
    const r = customerInsight(stats([40]), NOW);
    expect(r.daysSinceLastVisit).toBe(40);
    expect(r.daysOverdue).toBe(10);
    expect(customerInsight(stats([10]), NOW).daysOverdue).toBe(0);
  });

  it("aceita visits vindo como texto do banco", () => {
    const r = customerInsight({ ...stats([10]), visits: "1" as unknown as number }, NOW);
    expect(r.status).toBe("novo");
  });
});

describe("formatDaysAgo", () => {
  it("formata em dias, meses e anos", () => {
    expect(formatDaysAgo(0)).toBe("hoje");
    expect(formatDaysAgo(1)).toBe("ontem");
    expect(formatDaysAgo(12)).toBe("há 12 dias");
    expect(formatDaysAgo(90)).toBe("há 3 meses");
    expect(formatDaysAgo(800)).toBe("há 2 anos");
  });
});

describe("matchesCustomerSearch", () => {
  const joao = { name: "João Araújo", phone: "11991112222" };

  it("busca por nome sem acento e sem maiúsculas", () => {
    expect(matchesCustomerSearch(joao, "joao")).toBe(true);
    expect(matchesCustomerSearch(joao, "ARAUJO")).toBe(true);
    expect(matchesCustomerSearch(joao, "pedro")).toBe(false);
  });

  it("busca por telefone formatado ou não", () => {
    expect(matchesCustomerSearch(joao, "(11) 99111")).toBe(true);
    expect(matchesCustomerSearch(joao, "2222")).toBe(true);
    expect(matchesCustomerSearch(joao, "3333")).toBe(false);
  });

  it("busca vazia mostra todos", () => {
    expect(matchesCustomerSearch(joao, "  ")).toBe(true);
  });
});
