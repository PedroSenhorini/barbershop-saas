import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  CalendarOff,
  CalendarRange,
  ChartColumn,
  ContactRound,
  Crown,
  Ellipsis,
  Gift,
  HandCoins,
  ListOrdered,
  Megaphone,
  MessageCircle,
  Package,
  Percent,
  Repeat,
  Rocket,
  Scissors,
  Settings,
  ShoppingCart,
  Sparkles,
  Star,
  Trophy,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  /** Frase curta que aparece no cartão da tela "Mais". */
  hint: string;
  icon: LucideIcon;
  ownerOnly?: boolean;
};

export type NavArea = { title: string; hint: string; items: NavItem[] };

/**
 * Menu organizado pelo que o dono quer fazer, não por módulo técnico. A barra
 * de baixo do celular mostra só os atalhos do dia a dia (MOBILE_TABS); o resto
 * fica na tela "Mais", em cartões com uma frase explicando cada um.
 */
export const NAV_AREAS: NavArea[] = [
  {
    title: "Atendimento",
    hint: "Onde o dia acontece.",
    items: [
      { href: "/admin", label: "Agenda", hint: "O dia em lista ou quadro.", icon: CalendarDays },
      { href: "/admin/semana", label: "Semana", hint: "A semana inteira de uma vez.", icon: CalendarRange },
      { href: "/admin/bloqueios", label: "Bloqueios", hint: "Folga, férias e intervalos que somem da agenda.", icon: CalendarOff },
      { href: "/admin/horarios-fixos", label: "Horários fixos", hint: "Clientes que vêm sempre no mesmo dia e hora.", icon: Repeat },
      { href: "/admin/espera", label: "Lista de espera", hint: "Quem quer encaixe; avise quando abrir vaga.", icon: ListOrdered },
    ],
  },
  {
    title: "Clientes",
    hint: "Quem já veio e como fazer voltar.",
    items: [
      { href: "/admin/clientes", label: "Clientes", hint: "Histórico, observações e etiquetas.", icon: ContactRound },
      { href: "/admin/chamar", label: "Chamar quem sumiu", hint: "Fila de mensagens prontas, 1 toque cada.", icon: MessageCircle },
      { href: "/admin/avaliacoes", label: "Avaliações", hint: "Notas e comentários dos clientes.", icon: Star },
    ],
  },
  {
    title: "Dinheiro",
    hint: "O que entrou, o que saiu e quem deve.",
    items: [
      { href: "/admin/vender", label: "Vender", hint: "Balcão e extras da comanda.", icon: ShoppingCart },
      { href: "/admin/financeiro", label: "Financeiro", hint: "Caixa do dia, gastos e estoque.", icon: Wallet },
      { href: "/admin/fiado", label: "Fiado", hint: "Quem ficou devendo e quanto.", icon: HandCoins, ownerOnly: true },
      { href: "/admin/comissoes", label: "Comissões e metas", hint: "Quanto cada um ganhou e a meta do mês.", icon: Percent },
    ],
  },
  {
    title: "Clube",
    hint: "Planos mensais: receita todo mês.",
    items: [
      { href: "/admin/clube", label: "Clube", hint: "Assinantes, vencimentos e repasse.", icon: Crown },
      { href: "/admin/clube/planos", label: "Planos do Clube", hint: "Preço e o que cada plano inclui.", icon: Gift, ownerOnly: true },
    ],
  },
  {
    title: "Marketing",
    hint: "Atrair cliente e saber de onde ele vem.",
    items: [
      { href: "/admin/divulgar", label: "Divulgar", hint: "Link, QR Code, pôster e links por canal.", icon: Megaphone },
      { href: "/admin/cadastros", label: "Cadastros da porta", hint: "Contatos e indicações captados.", icon: UserPlus },
      { href: "/admin/fidelidade", label: "Fidelidade e marketing", hint: "Cashback, Google, pixel e vitrine.", icon: Sparkles, ownerOnly: true },
    ],
  },
  {
    title: "Relatórios",
    hint: "Os números do negócio.",
    items: [
      { href: "/admin/relatorios", label: "Relatórios", hint: "Faturamento, serviços, origem e ocupação.", icon: ChartColumn, ownerOnly: true },
      { href: "/admin/desempenho", label: "Desempenho da equipe", hint: "Ranking, ticket médio e retorno.", icon: Trophy, ownerOnly: true },
    ],
  },
  {
    title: "Configurações",
    hint: "Como a barbearia funciona.",
    items: [
      { href: "/admin/servicos", label: "Serviços", hint: "Preços e durações.", icon: Scissors, ownerOnly: true },
      { href: "/admin/produtos", label: "Produtos", hint: "Preço de venda dos produtos.", icon: Package, ownerOnly: true },
      { href: "/admin/equipe", label: "Equipe", hint: "Barbeiros e acessos.", icon: Users, ownerOnly: true },
      { href: "/admin/ajustes", label: "Ajustes", hint: "Dados, horários e link.", icon: Settings, ownerOnly: true },
      { href: "/admin/plano", label: "Plano e indicação", hint: "Seu plano do sistema e indique e ganhe.", icon: Rocket, ownerOnly: true },
      { href: "/admin/novidades", label: "Novidades", hint: "O que mudou no sistema.", icon: Sparkles },
    ],
  },
];

export const MORE_ITEM: NavItem = {
  href: "/admin/mais",
  label: "Mais",
  hint: "Todas as telas.",
  icon: Ellipsis,
};

/** Barra de baixo do celular: no máximo 5 atalhos. */
export const MOBILE_TABS = ["/admin", "/admin/clientes", "/admin/vender", "/admin/financeiro"];

export function visibleAreas(isOwner: boolean): NavArea[] {
  return NAV_AREAS.map((area) => ({
    ...area,
    items: area.items.filter((item) => isOwner || !item.ownerOnly),
  })).filter((area) => area.items.length > 0);
}

export function findItem(href: string) {
  for (const area of NAV_AREAS) {
    const item = area.items.find((i) => i.href === href);
    if (item) return item;
  }
  return null;
}

/** Item ativo: o href mais longo que é prefixo do caminho atual. */
export function isActive(href: string, pathname: string, allHrefs: string[]) {
  if (href === "/admin") return pathname === "/admin";
  if (!(pathname === href || pathname.startsWith(`${href}/`))) return false;
  return !allHrefs.some(
    (other) => other !== href && other.length > href.length && (pathname === other || pathname.startsWith(`${other}/`)),
  );
}
