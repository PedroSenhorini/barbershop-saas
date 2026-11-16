# Barbearia — Agenda online para barbearias

SaaS multi-tenant para barbearias: o cliente agenda sozinho por um link, e o
barbeiro gerencia a agenda pelo celular e confirma pelo WhatsApp com um toque.

## Stack

Next.js 16 (App Router) + TypeScript, Tailwind CSS v4 + shadcn/ui (Base UI),
Supabase (`@supabase/ssr`).

## Setup

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode nesta ordem:
   - `supabase/schema.sql` — tabelas, RLS multi-tenant e Realtime. É
     idempotente: também migra um banco que estava na versão antiga.
   - `supabase/seed.sql` (opcional) — barbearia de demonstração com agenda de
     hoje (login: `dono@cartolabarbearia.com.br` / senha `demo1234`).
3. Copie `.env.example` para `.env.local` e preencha com as chaves do projeto
   (Project Settings → API).
4. `npm install && npm run dev`.

- Página inicial / venda: `/`
- Cadastro de barbearia nova: `/cadastro`
- Painel: `/login` → `/admin`
- Agendamento do cliente: `/:slug` (demo: `/demo-barbearia`)

## Como funciona para o barbeiro

1. **Cadastro** (`/cadastro`): nome da barbearia, WhatsApp, e-mail e senha. A
   barbearia nasce com 3 serviços e horário seg–sex 9h–19h, sáb 9h–17h.
2. **Agenda** (`/admin`): lista do dia com botões grandes. "Confirmar no
   WhatsApp" abre o WhatsApp com a mensagem pronta (link `wa.me`, sem API
   paga) e já marca como confirmado. Também dá para iniciar, finalizar,
   marcar falta, cancelar, desfazer e lançar encaixes.
3. **Serviços**, **Equipe** e **Ajustes** (só o dono): preços e durações,
   barbeiros (com senha inicial definida pelo dono), horários por dia da
   semana com intervalo de almoço, e o link da barbearia.

## Cobrança (manual)

Cada barbearia tem a coluna `barbershops.active`. Para suspender quem não
pagou, desligue `active` no Table Editor do Supabase: a página pública para
de aceitar agendamentos e o painel mostra um aviso de assinatura pendente.

## Estrutura de pastas

```
src/
  app/
    page.tsx               # landing de venda
    (client)/[slug]/       # página pública de agendamento (sem login)
    (admin)/
      cadastro/            # criação de conta + barbearia
      login/
      sair/route.ts        # encerra sessão (evita loop de redirect)
      admin/
        page.tsx, agenda.tsx         # agenda do dia
        new-appointment-dialog.tsx   # encaixe manual
        servicos/  equipe/  ajustes/
  lib/
    availability.ts        # regra única de horários livres + criação de agendamento
    hours.ts               # expediente semanal e geração de horários
    time.ts                # datas sempre no fuso da barbearia
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
  `lib/availability.ts`.
- **Service role só depois de checar a sessão.** Um delete/update bloqueado
  por RLS não retorna erro (afeta 0 linhas), então ações que usam a service
  role (ex.: remover barbeiro) conferem antes, pela sessão, que o alvo é da
  mesma barbearia.
- **`Database` usa `type`, não `interface`** em `lib/supabase/types.ts`: o
  supabase-js precisa que cada tabela satisfaça `Record<string, unknown>`
  estruturalmente, senão tipa tudo como `never` silenciosamente.
- **Contas criadas já confirmadas** (`email_confirm: true`) no cadastro e na
  equipe, para ninguém travar esperando e-mail de confirmação.
