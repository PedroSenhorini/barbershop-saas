# Progresso — roadmap inspirado no NavalhaGO

Branch: `feature/clientes` (nada commitado, a pedido). Última sessão: 23/11/2026.

## Antes de rodar
1. `npm install` (entrou a dependência `qrcode` para o QR Code).
2. Rodar `supabase/schema.sql` inteiro no SQL Editor (idempotente; testado em Postgres local,
   2x seguidas, em banco com dados e em banco novo + seed).

## Estado da verificação (23/11)
- `tsc --noEmit` OK · `npm run lint` OK · `npm test` 69 testes OK · `npm run build` OK.
- `schema.sql` rodado 2x seguidas + `seed.sql` em Postgres 16 local (com stubs do Supabase): OK.
  Conferido: anon não lê `barbershops`; dono lê só a própria; dono não consegue mudar `active`.
- **Ainda não testado no navegador** (precisa do Supabase de verdade com o seed).

## Pronto
- **Banco (schema.sql)**: clientes, bloqueios, horário fixo (series_id), lista de espera, vendas
  (register_sale), fiado (debt_payments), gaveta (cash_movements), cashback (trigger), avaliações,
  Clube (planos, assinaturas, pagamentos, register_club_payment), cadastros da porta (leads),
  origem do agendamento, comissão/meta da equipe, configurações de marketing, plano/teste/indicação.
- **Menu por área** (`lib/nav.ts`) + tela **Mais** (`/admin/mais`); barra do celular: Agenda,
  Clientes, Vender, Financeiro, Mais.
- Onda 1: `/admin/semana`, `/admin/bloqueios` (já respeitados na agenda online),
  `/admin/horarios-fixos`, `/admin/espera` + página pública `/:slug/espera`, `/admin/divulgar`
  (QR, links por canal) + pôster `/poster`.
- Onda 2: `/admin/vender` (balcão + comanda), `/admin/produtos` (preço de venda), `/admin/fiado`,
  `/admin/comissoes` (comissão e meta), Financeiro com troco/sangria/suprimento e vendas/fiado/Clube
  no caixa. Finalizar atendimento agora aceita "Fiado" e "Plano do Clube".
- Onda 3: etiquetas na ficha e filtro na lista, `/admin/chamar` (fila de sumidos), cashback
  (saldo e "usar" na ficha), avaliação no link do cliente `/h/:token` → `/admin/avaliacoes`,
  `/admin/fidelidade` (cashback, link do Google, pixel, Instagram, "sobre").
- Onda 4: `/admin/clube` (assinantes, vencidos, MRR, cobrança no WhatsApp, repasse por tempo) e
  `/admin/clube/planos`.
- Onda 5 (parcial): `?origem=` é gravado no agendamento (booking-flow + actions + availability);
  evento do pixel "Schedule" disparado ao agendar; página pública `/:slug/cadastro`.

## Feito em 23/11
- Lint: 3 erros de `Date.now()` no render (chamar, fiado) → helpers `daysSince`/`msDaysAgo` em `lib/time.ts`.
- Página pública `/:slug`: `?origem=` vai para o agendamento; pixel da Meta quando `meta_pixel_id`
  existe; "sobre", Instagram e atalhos para `/espera` e `/cadastro` (e link da espera quando o dia
  não tem horário).
- **Segurança**: `barbershops` sem leitura anônima (antes `using (true)` expunha telefone, plano,
  código de indicação e `active` de todas). Páginas públicas leem por `lib/public-barbershop.ts`
  (service role, só as colunas mostradas). **Rodar o schema.sql de novo no Supabase.**
- Telas novas: `/admin/cadastros`, `/admin/relatorios`, `/admin/desempenho`, `/admin/plano`,
  `/admin/novidades` (conteúdo em `lib/changelog.ts`). Contas puras em `lib/reports.ts` e
  `lib/plan.ts`, com testes.
- Indicação: `/cadastro?ref=CODIGO` mostra "Indicação de X" e grava `referred_by`. Aviso de teste
  no painel (só dono, últimos 7 dias). Nova env opcional `NEXT_PUBLIC_SUPPORT_WHATSAPP`.
- Limite de 1000 linhas do Supabase: `monthByBarber` (comissões/desempenho) e relatórios agora
  paginam com `fetchAll`.

## Próximos passos
1. Rodar `schema.sql` no Supabase e testar no navegador com o seed (celular de verdade também):
   agenda, vender, financeiro, clube, relatórios, desempenho, cadastros, plano, página pública.
2. Ainda usam `.limit(5000/10000)`, que o Supabase corta em 1000: `fiado/page.tsx`,
   `avaliacoes/page.tsx`, `clube/page.tsx`, `financeiro/extra-income.ts`, `lib/debts.ts`.
   Trocar por `fetchAll` (lib/customer-data.ts).
3. Atualizar README e a planilha (aba Roadmap).

Fora do escopo por decisão: gateway de pagamento (cobrança manual), WhatsApp automático (wa.me
com 1 toque), multiunidade.
