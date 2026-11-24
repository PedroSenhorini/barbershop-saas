/**
 * O que mudou no sistema, do mais novo para o mais antigo. Mostrado na tela
 * Novidades. Para lançar algo novo, adicione um item no topo.
 */
export type ChangelogEntry = {
  /** "AAAA-MM-DD" */
  date: string;
  title: string;
  items: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-11-23",
    title: "Relatórios, desempenho e indicação",
    items: [
      "Relatórios: faturamento dos últimos 6 meses, serviços mais feitos, de onde vêm os agendamentos e ocupação da agenda.",
      "Desempenho da equipe: ranking do mês, ticket médio, clientes que voltaram e faltas.",
      "Cadastros da porta: chame no WhatsApp quem deixou o contato e marque quem virou cliente.",
      "Plano e indicação: veja seu plano, os dias de teste e mande seu link para indicar outras barbearias.",
      "Página de agendamento mostra o texto \"sobre\", o Instagram e atalhos para a lista de espera e o cadastro.",
    ],
  },
  {
    date: "2026-11-20",
    title: "Clientes, vendas e Clube",
    items: [
      "Ficha de clientes com histórico, etiquetas, cashback e fila para chamar quem sumiu.",
      "Vender no balcão, produtos, fiado, comissões e metas da equipe.",
      "Clube de assinatura: planos, assinantes, vencimentos e cobrança pelo WhatsApp.",
      "Semana, bloqueios, horários fixos e lista de espera.",
      "Divulgar: QR Code, pôster e links por canal para saber de onde vem cada cliente.",
      "Avaliação do atendimento pelo link do cliente.",
    ],
  },
];
