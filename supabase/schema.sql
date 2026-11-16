-- ============================================================================
-- Cartola — schema multi-tenant (Supabase/Postgres)
-- Tenant = barbershops. Toda tabela de negócio carrega barbershop_id e é
-- isolada por RLS, para que uma barbearia jamais veja dados de outra.
--
-- Este arquivo é idempotente: pode ser rodado num banco vazio OU por cima de
-- uma versão anterior do schema (ele migra o que já existe).
-- ============================================================================

create extension if not exists pgcrypto;
-- btree_gist: permite a exclusion constraint que impede dois agendamentos
-- sobrepostos do mesmo barbeiro (ver appointments_no_overlap).
create extension if not exists btree_gist;

-- ----------------------------------------------------------------------------
-- barbershops: o tenant. Dados públicos (a página de agendamento do cliente
-- lê esta tabela sem login, então nada sensível deve morar aqui).
-- ----------------------------------------------------------------------------
create table if not exists public.barbershops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  phone text,
  address text,
  created_at timestamptz not null default now()
);

-- Fuso da barbearia: todos os horários são calculados nele, nunca no fuso do
-- servidor (que na Vercel é UTC).
alter table public.barbershops
  add column if not exists timezone text not null default 'America/Sao_Paulo';

-- Expediente por dia da semana. Array de 7 posições indexado por getDay()
-- (0 = domingo). Cada posição é null (fechado) ou
-- {"open":"09:00","close":"19:00","breakStart":"12:00","breakEnd":"13:00"}.
alter table public.barbershops
  add column if not exists weekly_hours jsonb not null default '[
    null,
    {"open":"09:00","close":"19:00","breakStart":null,"breakEnd":null},
    {"open":"09:00","close":"19:00","breakStart":null,"breakEnd":null},
    {"open":"09:00","close":"19:00","breakStart":null,"breakEnd":null},
    {"open":"09:00","close":"19:00","breakStart":null,"breakEnd":null},
    {"open":"09:00","close":"19:00","breakStart":null,"breakEnd":null},
    {"open":"09:00","close":"17:00","breakStart":null,"breakEnd":null}
  ]'::jsonb;

-- Cobrança manual: desligue `active` para suspender uma barbearia que não
-- pagou. A página de agendamento para de aceitar novos horários.
alter table public.barbershops
  add column if not exists active boolean not null default true;

-- Migração da versão antiga (opening_time/closing_time únicos para todos os
-- dias, domingo fechado fixo no código) para weekly_hours.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'barbershops'
      and column_name = 'opening_time'
  ) then
    update public.barbershops b
    set weekly_hours = (
      select jsonb_agg(
        case when d = 0 then 'null'::jsonb
        else jsonb_build_object(
          'open', to_char(b.opening_time, 'HH24:MI'),
          'close', to_char(b.closing_time, 'HH24:MI'),
          'breakStart', null,
          'breakEnd', null
        ) end
        order by d
      )
      from generate_series(0, 6) as d
    );
    alter table public.barbershops drop column opening_time;
    alter table public.barbershops drop column closing_time;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- users: perfil de STAFF (donos e barbeiros), 1:1 com auth.users.
-- Clientes finais não têm conta — o agendamento web não exige login.
-- ----------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  full_name text not null,
  role text not null default 'barber',
  avatar_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Um dono que só administra (não corta cabelo) não deve aparecer como opção
-- para o cliente nem contar como capacidade de atendimento.
alter table public.users
  add column if not exists takes_appointments boolean not null default true;

alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check
  check (role in ('owner', 'barber'));

create index if not exists users_barbershop_id_idx on public.users (barbershop_id);

-- ----------------------------------------------------------------------------
-- services: catálogo de serviços de cada barbearia (Corte, Barba, etc.).
-- ----------------------------------------------------------------------------
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  name text not null,
  description text,
  price numeric(10, 2) not null default 0,
  duration_minutes integer not null default 30,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.services drop constraint if exists services_duration_check;
alter table public.services add constraint services_duration_check
  check (duration_minutes > 0);

create index if not exists services_barbershop_id_idx on public.services (barbershop_id);

-- ----------------------------------------------------------------------------
-- appointments: os agendamentos.
-- ----------------------------------------------------------------------------
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  barber_id uuid references public.users (id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  scheduled_at timestamptz not null,
  status text not null default 'solicitado',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ends_at é gravado no momento do agendamento (duração do serviço naquele
-- momento), para que mudar a duração de um serviço não "mova" horários antigos
-- e para alimentar a trava de sobreposição abaixo.
alter table public.appointments add column if not exists ends_at timestamptz;

update public.appointments a
set ends_at = a.scheduled_at + make_interval(mins => s.duration_minutes)
from public.services s
where a.service_id = s.id and a.ends_at is null;

alter table public.appointments alter column ends_at set not null;

-- Link pessoal do cliente (/h/<token>), enviado pelo WhatsApp: confirmar
-- presença, avisar que está a caminho ou cancelar, sem login. O token é
-- aleatório e separado do id, para o id nunca precisar sair do painel.
alter table public.appointments
  add column if not exists public_token text not null
  default replace(gen_random_uuid()::text, '-', '');
create unique index if not exists appointments_public_token_idx
  on public.appointments (public_token);

-- Quando o próprio cliente confirmou presença pelo link. O status
-- 'confirmado' é a barbearia aceitando o horário; isto é o lado do cliente.
alter table public.appointments add column if not exists customer_confirmed_at timestamptz;

alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check
  check (status in ('solicitado', 'confirmado', 'a_caminho', 'em_andamento', 'finalizado', 'cancelado', 'faltou'));

create index if not exists appointments_barbershop_id_idx on public.appointments (barbershop_id);
create index if not exists appointments_scheduled_at_idx on public.appointments (scheduled_at);
create index if not exists appointments_status_idx on public.appointments (status);

-- Trava de concorrência: o mesmo barbeiro nunca tem dois agendamentos ativos
-- sobrepostos, mesmo que dois clientes cliquem no mesmo segundo. Substitui o
-- antigo índice único em (barber_id, scheduled_at), que só pegava horários
-- com início idêntico.
drop index if exists public.appointments_barber_slot_unique;
alter table public.appointments drop constraint if exists appointments_no_overlap;
alter table public.appointments add constraint appointments_no_overlap
  exclude using gist (
    barber_id with =,
    tstzrange(scheduled_at, ends_at) with &&
  )
  where (barber_id is not null and status not in ('cancelado', 'faltou'));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_appointments_updated_at on public.appointments;
create trigger set_appointments_updated_at
  before update on public.appointments
  for each row execute procedure public.set_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.barbershops enable row level security;
alter table public.users enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;

-- security definer: lê o barbershop_id/role do usuário autenticado sem
-- reentrar nas policies de "users" (evita recursão infinita de RLS).
create or replace function public.current_barbershop_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select barbershop_id from public.users where id = auth.uid() and active;
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'owner' and active
  );
$$;

-- ---------------------------------------------------------------------------
-- barbershops: leitura pública (a página de agendamento precisa exibir nome/
-- horário de funcionamento sem login). Escrita só para o próprio dono.
-- O cadastro de uma barbearia nova é feito pelo servidor (service role).
-- ---------------------------------------------------------------------------
drop policy if exists "Barbershop e publica para leitura" on public.barbershops;
create policy "Barbershop e publica para leitura"
  on public.barbershops for select
  using (true);

drop policy if exists "Dono atualiza a propria barbearia" on public.barbershops;
create policy "Dono atualiza a propria barbearia"
  on public.barbershops for update
  using (id = public.current_barbershop_id() and public.is_owner());

-- ---------------------------------------------------------------------------
-- users (staff): visível apenas para colegas da mesma barbearia. Leitura
-- pública dos barbeiros que atendem fica a cargo do servidor (service role),
-- que expõe só id + nome.
-- ---------------------------------------------------------------------------
drop policy if exists "Staff ve colegas da mesma barbearia" on public.users;
create policy "Staff ve colegas da mesma barbearia"
  on public.users for select
  using (barbershop_id = public.current_barbershop_id());

drop policy if exists "Dono adiciona funcionario" on public.users;
create policy "Dono adiciona funcionario"
  on public.users for insert
  with check (barbershop_id = public.current_barbershop_id() and public.is_owner());

drop policy if exists "Dono edita funcionario" on public.users;
create policy "Dono edita funcionario"
  on public.users for update
  using (barbershop_id = public.current_barbershop_id() and public.is_owner());

drop policy if exists "Dono remove funcionario" on public.users;
create policy "Dono remove funcionario"
  on public.users for delete
  using (barbershop_id = public.current_barbershop_id() and public.is_owner() and id <> auth.uid());

-- ---------------------------------------------------------------------------
-- services: leitura pública dos serviços ativos (o cliente escolhe o serviço
-- sem login). Gestão restrita ao dono da própria barbearia.
-- ---------------------------------------------------------------------------
drop policy if exists "Servicos ativos sao publicos" on public.services;
create policy "Servicos ativos sao publicos"
  on public.services for select
  using (active = true or barbershop_id = public.current_barbershop_id());

drop policy if exists "Staff gerencia servicos da propria barbearia" on public.services;
drop policy if exists "Dono gerencia servicos da propria barbearia" on public.services;
create policy "Dono gerencia servicos da propria barbearia"
  on public.services for all
  using (barbershop_id = public.current_barbershop_id() and public.is_owner())
  with check (barbershop_id = public.current_barbershop_id() and public.is_owner());

-- ---------------------------------------------------------------------------
-- appointments: NENHUM acesso público. Criação (pelo cliente ou pelo painel)
-- passa pelo servidor com a service role, depois de validar o horário em
-- lib/availability.ts. A agenda do gestor usa a sessão autenticada do staff,
-- isolada por barbearia.
-- ---------------------------------------------------------------------------
drop policy if exists "Staff ve agendamentos da propria barbearia" on public.appointments;
create policy "Staff ve agendamentos da propria barbearia"
  on public.appointments for select
  using (barbershop_id = public.current_barbershop_id());

drop policy if exists "Staff atualiza agendamentos da propria barbearia" on public.appointments;
create policy "Staff atualiza agendamentos da propria barbearia"
  on public.appointments for update
  using (barbershop_id = public.current_barbershop_id());

-- Realtime: a agenda do painel se atualiza sozinha quando chega agendamento
-- novo pelo site. O Realtime respeita a policy de select acima.
do $$
begin
  alter publication supabase_realtime add table public.appointments;
exception
  when duplicate_object then null;
end;
$$;
