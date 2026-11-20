# Barbearia — Agenda online para barbearias

<!-- LINK DA DEMO -->

<!-- GIF/PRINT DO APP -->

SaaS multi-tenant para barbearias: o cliente agenda sozinho por um link, e o
barbeiro gerencia a agenda pelo celular e confirma pelo WhatsApp com um toque.

## Stack

Next.js 16 (App Router) + TypeScript, Tailwind CSS v4 + shadcn/ui (Base UI),
Supabase (`@supabase/ssr`). Testes com Vitest.

## Setup

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode nesta ordem:
   - `supabase/schema.sql` — tabelas, RLS multi-tenant, permissões e Realtime.
   - `supabase/seed.sql` (opcional) — barbearia de demonstração com agenda de
     hoje (login: `dono@cartolabarbearia.com.br` / senha `demo1234`).
3. Copie `.env.example` para `.env.local` e preencha:

   | Variável | Obrigatória | O que é |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | sim | URL do projeto (Project Settings → API). |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim | Chave pública (publishable/anon). Vai para o navegador; a RLS protege os dados. |
   | `SUPABASE_SERVICE_ROLE_KEY` | sim | Chave secreta (secret/service_role). Só no servidor; nunca exponha. |
   | `NEXT_PUBLIC_SITE_URL` | não | Endereço público do app, usado no link que o dono divulga. Sem ela, usa o host da requisição. |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | não | Chave do site do Cloudflare Turnstile (captcha). |
   | `TURNSTILE_SECRET_KEY` | não | Chave secreta do Turnstile. Preencha as duas para ativar o captcha. |

4. `npm install && npm run dev`.

**Atualizando um banco existente:** sempre que o `schema.sql` mudar, rode o
arquivo inteiro de novo no SQL Editor. Ele é idempotente: cria o que falta,
recria policies e constraints e migra dados de versões antigas, sem apagar
nada.

- Página inicial / venda: `/`
- Cadastro de barbearia nova: `/cadastro`
- Painel: `/login` → `/admin`
- Agendamento do cliente: `/:slug` (demo: `/demo-barbearia`)
- Link pessoal do cliente (enviado pelo WhatsApp): `/h/:token`

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento em `localhost:3000`. |
| `npm run build` | Build de produção. |
| `npm run lint` | ESLint. |
| `npm test` | Testes com Vitest (uma execução, sem modo watch). |

## Como funciona para o barbeiro

1. **Cadastro** (`/cadastro`): nome da barbearia, WhatsApp, e-mail e senha. A
   barbearia nasce com 3 serviços e horário seg–sex 9h–19h, sáb 9h–17h.
2. **Agenda** (`/admin`): o dia em lista ou em quadro (Novos → Confirmados →
   A caminho → Atendendo → Finalizados). "Confirmar no WhatsApp" abre o
   WhatsApp com a mensagem pronta (link `wa.me`, sem API paga) e um link
   pessoal em que o cliente confirma presença, avisa que está a caminho ou
   cancela. Ao finalizar, o barbeiro registra a forma de pagamento.
3. **Financeiro**: caixa do dia com conferência do dinheiro, gastos do mês e
   estoque (só o dono); o barbeiro vê só o próprio faturamento.
4. **Serviços**, **Equipe** e **Ajustes** (só o dono): preços e durações,
   barbeiros (com senha inicial definida pelo dono), horários por dia da
   semana com intervalo de almoço, e o link da barbearia.

## Cobrança (manual)

Cada barbearia tem a coluna `barbershops.active`. Para suspender quem não
pagou, desligue `active` no Table Editor do Supabase: a página pública para
de aceitar agendamentos e o painel mostra um aviso de assinatura pendente.
O dono não consegue religar pelo app (ver Segurança).

## Testes

`npm test` roda o Vitest sobre as regras de data e de agenda, que não
dependem do Supabase:

- `src/lib/time.test.ts` — conversão de horário no fuso da barbearia, virada
  de dia (22h em São Paulo já é o dia seguinte em UTC), horário de verão,
  soma de dias atravessando mês e ano.
- `src/lib/hours.test.ts` — expediente por dia da semana, dia fechado,
  intervalo de almoço, serviço que não cabe antes de fechar, validação do
  formulário de horários.
- `src/lib/slots.test.ts` — horários livres: sobreposição, barbeiro
  específico vs. "qualquer um", agendamento sem barbeiro ocupando a
  capacidade da equipe, horários no passado.

A regra de horários livres fica em `computeFreeSlots` (`lib/slots.ts`), uma
função pura; `computeAvailability` (`lib/availability.ts`) só busca os dados
no Supabase e chama essa função.

## CI

`.github/workflows/ci.yml` roda em todo push e pull request: `npm ci`, lint,
`tsc --noEmit`, testes e build. O build usa variáveis do Supabase fictícias;
nenhum passo acessa um banco de verdade.

## Segurança

- **Colunas editáveis de `barbershops`.** A policy de update deixa o dono
  alterar a própria barbearia, e um `grant` por coluna limita o que pode
  mudar: `name`, `phone`, `address`, `slug`, `timezone` e `weekly_hours`.
  `active` fica de fora: só muda pela service role (painel do Supabase).
- **Formato do slug no banco.** A constraint `barbershops_slug_format_check`
  repete a regra de `lib/slugs.ts` (letras minúsculas, números e hífen).
- **Leitura de `barbershops`.** Hoje a policy de select é pública: qualquer
  pessoa com a chave anon consegue listar as barbearias. A restrição ainda
  não foi aplicada.
- **Anti-spam no agendamento público e no cadastro**, sem serviço pago:
  - no máximo 2 agendamentos futuros ativos por telefone em cada barbearia
    (encaixes feitos pelo painel não têm limite);
  - campo-isca invisível: se um robô preenche, o servidor finge sucesso e não
    grava nada;
  - Cloudflare Turnstile opcional, ligado só quando as duas variáveis
    `TURNSTILE` existem. Se a Cloudflare estiver fora do ar, a verificação
    deixa passar, para não travar os agendamentos.

## Estrutura de pastas

```
src/
  app/
    page.tsx               # landing de venda
    (client)/[slug]/       # página pública de agendamento (sem login)
    (client)/h/[token]/    # link pessoal do cliente: confirmar, a caminho, cancelar
    (admin)/
      cadastro/            # criação de conta + barbearia
      login/
      sair/route.ts        # encerra sessão (evita loop de redirect)
      admin/
        page.tsx, agenda.tsx         # agenda do dia (lista)
        board.tsx                    # agenda do dia (quadro)
        new-appointment-dialog.tsx   # encaixe manual
        financeiro/                  # caixa, gastos, estoque
        servicos/  equipe/  ajustes/
  components/
    anti-spam.tsx          # campo-isca e widget do Turnstile
  lib/
    availability.ts        # busca dados e cria agendamento
    slots.ts               # regra pura de horários livres (testada)
    hours.ts               # expediente semanal e geração de horários
    time.ts                # datas sempre no fuso da barbearia
    finance.ts             # rótulos e contas do financeiro
    turnstile.ts           # verificação do captcha no servidor
    whatsapp.ts            # links wa.me e mensagens prontas
    auth.ts                # sessão do painel (staff + barbearia)
    supabase/              # clients e tipos
  proxy.ts                 # refresh de sessão + proteção de /admin
supabase/
  schema.sql
  seed.sql
```

## Decisões importantes

- **Fuso horário.** O servidor (Vercel) roda em UTC. Todo cálculo de dia e
  horário usa `barbershops.timezone` via `lib/time.ts` — nunca
  `new Date("YYYY-MM-DDT00:00")`, que usa o fuso do processo.
- **Sem horário duplicado.** `appointments.ends_at` é gravado no agendamento
  e a constraint `appointments_no_overlap` (btree_gist) impede dois
  agendamentos sobrepostos do mesmo barbeiro, mesmo em cliques simultâneos.
- **`appointments` não tem policy pública de RLS.** Criação (cliente ou
  painel) passa pelo servidor com a service role, depois de validar em
  `lib/availability.ts`. O link do cliente (`/h/:token`) também passa pelo
  servidor; o token é aleatório e separado do id.
- **Service role só depois de checar a sessão.** Um delete/update bloqueado
  por RLS não retorna erro (afeta 0 linhas), então ações que usam a service
  role (ex.: remover barbeiro) conferem antes, pela sessão, que o alvo é da
  mesma barbearia.
- **Sessão validada localmente.** O painel usa `auth.getClaims()`, que valida
  o JWT com as chaves assimétricas do projeto, em vez de `getUser()`, que iria
  ao servidor de auth a cada página.
- **`Database` usa `type`, não `interface`** em `lib/supabase/types.ts`: o
  supabase-js precisa que cada tabela satisfaça `Record<string, unknown>`
  estruturalmente, senão tipa tudo como `never` silenciosamente.
- **Contas criadas já confirmadas** (`email_confirm: true`) no cadastro e na
  equipe, para ninguém travar esperando e-mail de confirmação.
- **Contas de seed inseridas direto em `auth.users`** precisam das colunas de
  token preenchidas com `''`; com `NULL`, o login e a Admin API falham com
  "Database error querying schema". O `seed.sql` já faz isso.
