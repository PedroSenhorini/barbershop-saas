-- ============================================================================
-- Barbearia — schema multi-tenant (Supabase/Postgres)
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

-- Formato do link público, igual ao slugSchema de src/lib/slugs.ts: a
-- validação não depende só do app.
alter table public.barbershops drop constraint if exists barbershops_slug_format_check;
alter table public.barbershops add constraint barbershops_slug_format_check
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

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
-- barbershops: sem leitura anônima (ver policy abaixo). Escrita só para o
-- próprio dono.
-- O cadastro de uma barbearia nova é feito pelo servidor (service role).
-- ---------------------------------------------------------------------------
-- Leitura: cada equipe só a própria barbearia. As páginas públicas (/slug,
-- /slug/espera, /slug/cadastro, prévia do link) leem pelo servidor com a
-- service role e só as colunas que mostram (src/lib/public-barbershop.ts).
-- Antes era using (true): a anon key listava telefone, plano, código de
-- indicação e situação de pagamento de TODAS as barbearias.
drop policy if exists "Barbershop e publica para leitura" on public.barbershops;
drop policy if exists "Equipe le a propria barbearia" on public.barbershops;
create policy "Equipe le a propria barbearia"
  on public.barbershops for select
  using (id = public.current_barbershop_id());

drop policy if exists "Dono atualiza a propria barbearia" on public.barbershops;
create policy "Dono atualiza a propria barbearia"
  on public.barbershops for update
  using (id = public.current_barbershop_id() and public.is_owner());

-- A policy acima diz QUAIS linhas o dono altera; isto limita QUAIS colunas.
-- Sem isso, a sessão do navegador poderia fazer update({ active: true }) e
-- reativar uma barbearia suspensa por falta de pagamento. `active` só muda
-- pela service role (painel do Supabase).
revoke update on public.barbershops from authenticated;
grant update (name, phone, address, slug, timezone, weekly_hours)
  on public.barbershops to authenticated;

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

-- ============================================================================
-- Financeiro: pagamento dos atendimentos, gastos, estoque e conferência do
-- caixa. Gastos/estoque/caixa são só do dono; o barbeiro registra a forma de
-- pagamento ao finalizar (policy de update de appointments, acima).
-- ============================================================================

-- Registrado ao finalizar. amount_paid pode diferir do preço do serviço
-- (desconto, gorjeta); sem ele, os relatórios usam o preço do serviço.
alter table public.appointments add column if not exists payment_method text;
alter table public.appointments add column if not exists amount_paid numeric(10, 2);
alter table public.appointments drop constraint if exists appointments_payment_check;
alter table public.appointments add constraint appointments_payment_check
  check (
    (payment_method is null or payment_method in ('dinheiro', 'pix', 'cartao'))
    and (amount_paid is null or amount_paid >= 0)
  );

-- products: itens com quantidade em estoque (pomada, lâmina, shampoo...).
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  name text not null,
  quantity numeric(10, 2) not null default 0,
  -- Abaixo disto o painel avisa que está acabando.
  min_quantity numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists products_barbershop_id_idx on public.products (barbershop_id);

-- expenses: todo dinheiro que sai. Compra de produto aponta para o produto e
-- a quantidade comprada (ver register_purchase).
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  category text not null,
  description text not null,
  amount numeric(10, 2) not null,
  spent_on date not null default current_date,
  product_id uuid references public.products (id) on delete set null,
  quantity numeric(10, 2),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.expenses drop constraint if exists expenses_check;
alter table public.expenses add constraint expenses_check
  check (
    amount >= 0
    and category in ('produtos', 'equipamentos', 'aluguel', 'luz_agua', 'internet', 'salarios', 'impostos', 'outros')
  );
create index if not exists expenses_barbershop_spent_idx on public.expenses (barbershop_id, spent_on);

-- cash_counts: quanto o dono contou na gaveta no fim do dia, para comparar
-- com o que os atendimentos em dinheiro dizem que deveria ter.
create table if not exists public.cash_counts (
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  day date not null,
  counted numeric(10, 2) not null check (counted >= 0),
  notes text,
  counted_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (barbershop_id, day)
);

alter table public.products enable row level security;
alter table public.expenses enable row level security;
alter table public.cash_counts enable row level security;

drop policy if exists "Dono gerencia produtos" on public.products;
create policy "Dono gerencia produtos"
  on public.products for all
  using (barbershop_id = public.current_barbershop_id() and public.is_owner())
  with check (barbershop_id = public.current_barbershop_id() and public.is_owner());

drop policy if exists "Dono gerencia gastos" on public.expenses;
create policy "Dono gerencia gastos"
  on public.expenses for all
  using (barbershop_id = public.current_barbershop_id() and public.is_owner())
  with check (barbershop_id = public.current_barbershop_id() and public.is_owner());

drop policy if exists "Dono gerencia caixa" on public.cash_counts;
create policy "Dono gerencia caixa"
  on public.cash_counts for all
  using (barbershop_id = public.current_barbershop_id() and public.is_owner())
  with check (barbershop_id = public.current_barbershop_id() and public.is_owner());

-- Compra de produto: soma no estoque E lança o gasto, numa transação só.
-- security invoker: roda com as permissões de quem chama, então as policies
-- acima garantem que só o dono da própria barbearia consegue.
create or replace function public.register_purchase(
  p_product_id uuid,
  p_quantity numeric,
  p_amount numeric,
  p_spent_on date
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_name text;
  v_shop uuid;
begin
  if p_quantity is null or p_quantity <= 0 or p_amount is null or p_amount < 0 then
    raise exception 'Quantidade ou valor inválido';
  end if;

  update public.products
  set quantity = quantity + p_quantity
  where id = p_product_id
  returning name, barbershop_id into v_name, v_shop;
  if v_shop is null then
    raise exception 'Produto não encontrado';
  end if;

  insert into public.expenses
    (barbershop_id, category, description, amount, spent_on, product_id, quantity, created_by)
  values
    (v_shop, 'produtos', 'Compra: ' || v_name, p_amount, p_spent_on, p_product_id, p_quantity, auth.uid());
end;
$$;

-- Uso/venda de produto: baixa no estoque sem ficar negativo. Atômico para
-- dois toques seguidos não se perderem.
create or replace function public.adjust_stock(p_product_id uuid, p_delta numeric)
returns numeric
language sql
security invoker
set search_path = public
as $$
  update public.products
  set quantity = greatest(quantity + p_delta, 0)
  where id = p_product_id
  returning quantity;
$$;

-- ============================================================================
-- Clientes: um cadastro por telefone em cada barbearia, montado sozinho a
-- partir dos agendamentos. O cliente final continua sem conta e sem login; o
-- cadastro existe para a barbearia ver histórico, anotar preferências e saber
-- quem sumiu.
-- ============================================================================
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  name text not null,
  -- Só dígitos, como em appointments.customer_phone (lib/format.ts onlyDigits).
  phone text not null,
  -- Observações da equipe: preferências de corte, alergias, etc.
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customers drop constraint if exists customers_phone_format_check;
alter table public.customers add constraint customers_phone_format_check
  check (phone ~ '^[0-9]{8,15}$');

alter table public.customers drop constraint if exists customers_name_check;
alter table public.customers add constraint customers_name_check
  check (length(btrim(name)) between 1 and 120);

-- O telefone identifica o cliente dentro da barbearia.
create unique index if not exists customers_barbershop_phone_idx
  on public.customers (barbershop_id, phone);

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
  before update on public.customers
  for each row execute procedure public.set_updated_at();

alter table public.appointments
  add column if not exists customer_id uuid references public.customers (id) on delete set null;
create index if not exists appointments_customer_id_idx on public.appointments (customer_id);

-- Todo agendamento novo (site, painel ou seed) aponta para o cliente do mesmo
-- telefone, criando o cadastro na primeira vez. Fica no banco, e não em
-- lib/availability.ts, para nenhum caminho de criação esquecer de fazer isso.
-- O nome do cadastro não é sobrescrito: se a equipe corrigiu o nome, um
-- agendamento novo com outro apelido não desfaz a correção.
create or replace function public.link_appointment_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := regexp_replace(coalesce(new.customer_phone, ''), '\D', '', 'g');
begin
  if v_phone !~ '^[0-9]{8,15}$' then
    new.customer_id := null;
    return new;
  end if;

  insert into public.customers (barbershop_id, name, phone)
  values (new.barbershop_id, left(btrim(new.customer_name), 120), v_phone)
  on conflict (barbershop_id, phone)
    -- Regrava o mesmo telefone só para o RETURNING devolver o id existente.
    do update set phone = excluded.phone
  returning id into new.customer_id;

  return new;
end;
$$;

drop trigger if exists link_appointment_customer on public.appointments;
create trigger link_appointment_customer
  before insert or update of customer_phone, barbershop_id on public.appointments
  for each row execute procedure public.link_appointment_customer();

-- Migração dos agendamentos que já existiam antes do cadastro de clientes.
-- Idempotente: na segunda execução não encontra nada para criar nem ligar.
-- O nome usado é o do agendamento mais recente daquele telefone.
insert into public.customers (barbershop_id, name, phone, created_at)
select distinct on (a.barbershop_id, a.phone)
  a.barbershop_id,
  left(btrim(a.customer_name), 120),
  a.phone,
  a.first_created_at
from (
  select
    barbershop_id,
    customer_name,
    created_at,
    regexp_replace(customer_phone, '\D', '', 'g') as phone,
    min(created_at) over (
      partition by barbershop_id, regexp_replace(customer_phone, '\D', '', 'g')
    ) as first_created_at
  from public.appointments
) a
where a.phone ~ '^[0-9]{8,15}$' and length(btrim(a.customer_name)) > 0
order by a.barbershop_id, a.phone, a.created_at desc
on conflict (barbershop_id, phone) do nothing;

-- Mexe só em customer_id, então o trigger de ligação acima não dispara.
-- (O de updated_at dispara: os agendamentos antigos ganham updated_at novo
-- uma única vez.)
update public.appointments a
set customer_id = c.id
from public.customers c
where a.customer_id is null
  and c.barbershop_id = a.barbershop_id
  and c.phone = regexp_replace(a.customer_phone, '\D', '', 'g');

-- RLS: a equipe vê e anota os clientes da própria barbearia. Criação só pelo
-- trigger acima; ninguém apaga cliente pelo app (o histórico depende dele).
alter table public.customers enable row level security;

drop policy if exists "Staff ve clientes da propria barbearia" on public.customers;
create policy "Staff ve clientes da propria barbearia"
  on public.customers for select
  using (barbershop_id = public.current_barbershop_id());

drop policy if exists "Staff edita clientes da propria barbearia" on public.customers;
create policy "Staff edita clientes da propria barbearia"
  on public.customers for update
  using (barbershop_id = public.current_barbershop_id())
  with check (barbershop_id = public.current_barbershop_id());

-- A policy diz QUAIS linhas; isto limita QUAIS colunas. Telefone e barbearia
-- não mudam pelo app: o telefone é o que liga o cliente aos agendamentos.
revoke insert, update, delete on public.customers from anon, authenticated;
grant update (name, notes) on public.customers to authenticated;

-- Números de cada cliente, calculados no banco para a lista não precisar
-- baixar todos os agendamentos. security_invoker: a view roda com as
-- permissões de quem consulta, então a RLS de customers e appointments vale.
-- total_spent segue lib/finance.ts paidAmount: o valor pago ou, sem ele, o
-- preço do serviço.
create or replace view public.customer_stats
with (security_invoker = true)
as
select
  c.id as customer_id,
  c.barbershop_id,
  count(a.id) filter (where a.status = 'finalizado') as visits,
  min(a.scheduled_at) filter (where a.status = 'finalizado') as first_visit_at,
  max(a.scheduled_at) filter (where a.status = 'finalizado') as last_visit_at,
  min(a.scheduled_at) filter (
    where a.status not in ('finalizado', 'cancelado', 'faltou') and a.scheduled_at > now()
  ) as next_appointment_at,
  count(a.id) filter (where a.status = 'faltou') as no_shows,
  coalesce(
    sum(coalesce(a.amount_paid, s.price)) filter (where a.status = 'finalizado'),
    0
  ) as total_spent
from public.customers c
left join public.appointments a on a.customer_id = c.id
left join public.services s on s.id = a.service_id
group by c.id, c.barbershop_id;

revoke all on public.customer_stats from anon;
grant select on public.customer_stats to authenticated;

-- ============================================================================
-- Bloqueios de horário: folga, férias, intervalo, médico. barber_id nulo =
-- a barbearia toda fecha naquele intervalo. lib/availability.ts trata cada
-- bloqueio como um horário ocupado, então some da agenda pública e do encaixe.
-- ============================================================================
create table if not exists public.time_blocks (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  barber_id uuid references public.users (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.time_blocks drop constraint if exists time_blocks_range_check;
alter table public.time_blocks add constraint time_blocks_range_check
  check (ends_at > starts_at and ends_at - starts_at <= interval '90 days');

create index if not exists time_blocks_shop_range_idx
  on public.time_blocks (barbershop_id, starts_at, ends_at);

alter table public.time_blocks enable row level security;

drop policy if exists "Staff ve bloqueios da propria barbearia" on public.time_blocks;
create policy "Staff ve bloqueios da propria barbearia"
  on public.time_blocks for select
  using (barbershop_id = public.current_barbershop_id());

-- O dono bloqueia qualquer um (ou a barbearia toda); o barbeiro, só a si mesmo.
drop policy if exists "Staff gerencia bloqueios permitidos" on public.time_blocks;
create policy "Staff gerencia bloqueios permitidos"
  on public.time_blocks for all
  using (
    barbershop_id = public.current_barbershop_id()
    and (public.is_owner() or barber_id = auth.uid())
  )
  with check (
    barbershop_id = public.current_barbershop_id()
    and (public.is_owner() or barber_id = auth.uid())
  );

-- ============================================================================
-- Horários fixos: uma série de agendamentos repetidos (toda semana, a cada
-- 15 dias...). Cada ocorrência é um agendamento normal; series_id só agrupa
-- para listar e cancelar o resto da série de uma vez.
-- ============================================================================
alter table public.appointments add column if not exists series_id uuid;
create index if not exists appointments_series_id_idx
  on public.appointments (series_id) where series_id is not null;

-- ============================================================================
-- Lista de espera: quem quer um encaixe. Entra pelo site (servidor, service
-- role) ou pelo painel; a equipe avisa pelo WhatsApp quando abre vaga.
-- ============================================================================
create table if not exists public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  service_id uuid references public.services (id) on delete set null,
  barber_id uuid references public.users (id) on delete set null,
  preferred_date date,
  preferred_period text not null default 'qualquer',
  notes text,
  status text not null default 'aguardando',
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.waitlist_entries drop constraint if exists waitlist_entries_check;
alter table public.waitlist_entries add constraint waitlist_entries_check
  check (
    preferred_period in ('qualquer', 'manha', 'tarde', 'noite')
    and status in ('aguardando', 'avisado', 'agendado', 'desistiu')
    and customer_phone ~ '^[0-9]{8,15}$'
    and length(btrim(customer_name)) between 1 and 120
    and (notes is null or length(notes) <= 500)
  );

create index if not exists waitlist_entries_shop_status_idx
  on public.waitlist_entries (barbershop_id, status, created_at);

alter table public.waitlist_entries enable row level security;

drop policy if exists "Staff gerencia lista de espera" on public.waitlist_entries;
create policy "Staff gerencia lista de espera"
  on public.waitlist_entries for all
  using (barbershop_id = public.current_barbershop_id())
  with check (barbershop_id = public.current_barbershop_id());

-- ============================================================================
-- Formas de pagamento além de dinheiro/Pix/cartão:
--   fiado  = atendeu e ficou devendo (quitação em debt_payments)
--   plano  = coberto pela assinatura do Clube (não entra como receita do dia)
-- ============================================================================
alter table public.appointments drop constraint if exists appointments_payment_check;
alter table public.appointments add constraint appointments_payment_check
  check (
    (payment_method is null or payment_method in ('dinheiro', 'pix', 'cartao', 'fiado', 'plano'))
    and (amount_paid is null or amount_paid >= 0)
  );

-- Origem do cliente (?origem=instagram no link de agendamento).
alter table public.appointments add column if not exists source text;
alter table public.appointments drop constraint if exists appointments_source_check;
alter table public.appointments add constraint appointments_source_check
  check (source is null or source ~ '^[a-z0-9_-]{1,40}$');

-- ============================================================================
-- Equipe: comissão e meta do mês de cada profissional.
-- ============================================================================
alter table public.users add column if not exists commission_percent numeric(5, 2) not null default 0;
alter table public.users add column if not exists product_commission_percent numeric(5, 2) not null default 0;
alter table public.users add column if not exists monthly_goal numeric(10, 2);
alter table public.users drop constraint if exists users_commission_check;
alter table public.users add constraint users_commission_check
  check (
    commission_percent between 0 and 100
    and product_commission_percent between 0 and 100
    and (monthly_goal is null or monthly_goal >= 0)
  );

-- ============================================================================
-- Barbearia: configurações novas que o dono altera pelo painel.
-- ============================================================================
alter table public.barbershops add column if not exists cashback_percent numeric(5, 2) not null default 0;
alter table public.barbershops add column if not exists google_review_url text;
alter table public.barbershops add column if not exists meta_pixel_id text;
alter table public.barbershops add column if not exists about text;
alter table public.barbershops add column if not exists instagram text;
alter table public.barbershops drop constraint if exists barbershops_settings_check;
alter table public.barbershops add constraint barbershops_settings_check
  check (
    cashback_percent between 0 and 50
    and (google_review_url is null or google_review_url ~ '^https://')
    and (meta_pixel_id is null or meta_pixel_id ~ '^[0-9]{5,20}$')
    and (about is null or length(about) <= 600)
    and (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$')
  );

-- Plano do sistema (cobrança manual pela service role, como `active`).
-- Barbearias que já existiam antes desta coluna ficam como 'ativo'.
alter table public.barbershops add column if not exists plan text;
update public.barbershops set plan = 'ativo' where plan is null;
alter table public.barbershops alter column plan set default 'teste';
alter table public.barbershops alter column plan set not null;
alter table public.barbershops add column if not exists trial_ends_at timestamptz;
alter table public.barbershops alter column trial_ends_at set default now() + interval '14 days';
alter table public.barbershops add column if not exists referral_code text;
update public.barbershops
  set referral_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  where referral_code is null;
alter table public.barbershops
  alter column referral_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
alter table public.barbershops alter column referral_code set not null;
create unique index if not exists barbershops_referral_code_idx on public.barbershops (referral_code);
alter table public.barbershops add column if not exists referred_by uuid references public.barbershops (id) on delete set null;
alter table public.barbershops drop constraint if exists barbershops_plan_check;
alter table public.barbershops add constraint barbershops_plan_check
  check (plan in ('teste', 'ativo', 'individual', 'duo', 'time', 'premium'));

-- Mesma regra do grant original: o dono muda só o que é configuração dele.
-- plan, trial_ends_at, referral_code, referred_by e active ficam de fora.
revoke update on public.barbershops from authenticated;
grant update (
  name, phone, address, slug, timezone, weekly_hours,
  cashback_percent, google_review_url, meta_pixel_id, about, instagram
) on public.barbershops to authenticated;

-- ============================================================================
-- Produtos à venda e vendas (balcão e extras da comanda).
-- ============================================================================
alter table public.products add column if not exists sale_price numeric(10, 2);
alter table public.products drop constraint if exists products_sale_price_check;
alter table public.products add constraint products_sale_price_check
  check (sale_price is null or sale_price >= 0);

-- O barbeiro precisa ver o catálogo para vender; gestão continua só do dono.
drop policy if exists "Staff ve produtos" on public.products;
create policy "Staff ve produtos"
  on public.products for select
  using (barbershop_id = public.current_barbershop_id());

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  -- Venda feita dentro de um atendimento (comanda).
  appointment_id uuid references public.appointments (id) on delete set null,
  seller_id uuid references public.users (id) on delete set null,
  payment_method text not null,
  subtotal numeric(10, 2) not null,
  discount numeric(10, 2) not null default 0,
  total numeric(10, 2) not null,
  notes text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.sales drop constraint if exists sales_check;
alter table public.sales add constraint sales_check
  check (
    payment_method in ('dinheiro', 'pix', 'cartao', 'fiado')
    and subtotal >= 0 and discount >= 0 and total = subtotal - discount and total >= 0
  );
create index if not exists sales_shop_created_idx on public.sales (barbershop_id, created_at);
create index if not exists sales_appointment_idx on public.sales (appointment_id) where appointment_id is not null;
create index if not exists sales_customer_idx on public.sales (customer_id) where customer_id is not null;

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  description text not null,
  quantity numeric(10, 2) not null,
  unit_price numeric(10, 2) not null
);
alter table public.sale_items drop constraint if exists sale_items_check;
alter table public.sale_items add constraint sale_items_check
  check (quantity > 0 and unit_price >= 0 and length(btrim(description)) between 1 and 120);
create index if not exists sale_items_sale_idx on public.sale_items (sale_id);

alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

-- Dono vê todas as vendas; barbeiro, as que ele vendeu.
drop policy if exists "Staff ve vendas" on public.sales;
create policy "Staff ve vendas"
  on public.sales for select
  using (
    barbershop_id = public.current_barbershop_id()
    and (public.is_owner() or seller_id = auth.uid())
  );
drop policy if exists "Staff ve itens de vendas" on public.sale_items;
create policy "Staff ve itens de vendas"
  on public.sale_items for select
  using (
    barbershop_id = public.current_barbershop_id()
    and exists (select 1 from public.sales s where s.id = sale_items.sale_id)
  );
drop policy if exists "Dono apaga vendas" on public.sales;
create policy "Dono apaga vendas"
  on public.sales for delete
  using (barbershop_id = public.current_barbershop_id() and public.is_owner());

-- Venda numa transação só: confere que tudo é da barbearia de quem vende,
-- grava itens com o preço do cadastro, baixa o estoque e devolve o id.
-- security definer porque o barbeiro não pode mexer em products/sales direto.
-- p_items: [{"product_id": uuid|null, "description": text, "quantity": n, "unit_price": n}]
-- unit_price só vale para item avulso (sem product_id).
create or replace function public.register_sale(
  p_items jsonb,
  p_payment_method text,
  p_discount numeric default 0,
  p_customer_id uuid default null,
  p_appointment_id uuid default null,
  p_seller_id uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop uuid := public.current_barbershop_id();
  v_sale uuid;
  v_item jsonb;
  v_product record;
  v_qty numeric;
  v_price numeric;
  v_desc text;
  v_subtotal numeric := 0;
  v_seller uuid := coalesce(p_seller_id, auth.uid());
begin
  if v_shop is null then raise exception 'Sem permissão'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Venda sem itens';
  end if;
  if p_customer_id is not null and not exists (
    select 1 from customers where id = p_customer_id and barbershop_id = v_shop
  ) then raise exception 'Cliente inválido'; end if;
  if p_appointment_id is not null and not exists (
    select 1 from appointments where id = p_appointment_id and barbershop_id = v_shop
  ) then raise exception 'Atendimento inválido'; end if;
  if not exists (select 1 from users where id = v_seller and barbershop_id = v_shop and active) then
    raise exception 'Vendedor inválido';
  end if;
  if p_payment_method = 'fiado' and p_customer_id is null then
    raise exception 'Fiado precisa de cliente';
  end if;

  insert into sales (barbershop_id, customer_id, appointment_id, seller_id, payment_method,
                     subtotal, discount, total, notes, created_by)
  values (v_shop, p_customer_id, p_appointment_id, v_seller, p_payment_method,
          0, 0, 0, nullif(btrim(coalesce(p_notes, '')), ''), auth.uid())
  returning id into v_sale;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'quantity')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Quantidade inválida'; end if;

    if nullif(v_item ->> 'product_id', '') is not null then
      select id, name, sale_price into v_product
      from products
      where id = (v_item ->> 'product_id')::uuid and barbershop_id = v_shop;
      if v_product.id is null or v_product.sale_price is null then
        raise exception 'Produto sem preço de venda';
      end if;
      v_price := v_product.sale_price;
      v_desc := v_product.name;
      update products set quantity = greatest(quantity - v_qty, 0) where id = v_product.id;
    else
      v_price := (v_item ->> 'unit_price')::numeric;
      v_desc := left(btrim(coalesce(v_item ->> 'description', '')), 120);
      if v_price is null or v_price < 0 or v_desc = '' then raise exception 'Item avulso inválido'; end if;
    end if;

    insert into sale_items (sale_id, barbershop_id, product_id, description, quantity, unit_price)
    values (v_sale, v_shop, nullif(v_item ->> 'product_id', '')::uuid, v_desc, v_qty, v_price);
    v_subtotal := v_subtotal + round(v_qty * v_price, 2);
  end loop;

  if coalesce(p_discount, 0) < 0 or coalesce(p_discount, 0) > v_subtotal then
    raise exception 'Desconto inválido';
  end if;

  update sales
  set subtotal = v_subtotal, discount = coalesce(p_discount, 0), total = v_subtotal - coalesce(p_discount, 0)
  where id = v_sale;

  return v_sale;
end;
$$;

revoke execute on function public.register_sale(jsonb, text, numeric, uuid, uuid, uuid, text) from public, anon;
grant execute on function public.register_sale(jsonb, text, numeric, uuid, uuid, uuid, text) to authenticated;

-- ============================================================================
-- Fiado: quitações de atendimentos ou vendas pagos depois.
-- ============================================================================
create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete cascade,
  sale_id uuid references public.sales (id) on delete cascade,
  amount numeric(10, 2) not null,
  payment_method text not null,
  paid_on date not null default current_date,
  received_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.debt_payments drop constraint if exists debt_payments_check;
alter table public.debt_payments add constraint debt_payments_check
  check (
    amount > 0
    and payment_method in ('dinheiro', 'pix', 'cartao')
    and (appointment_id is not null) <> (sale_id is not null)
  );
create index if not exists debt_payments_shop_paid_idx on public.debt_payments (barbershop_id, paid_on);

alter table public.debt_payments enable row level security;
drop policy if exists "Dono gerencia fiado" on public.debt_payments;
create policy "Dono gerencia fiado"
  on public.debt_payments for all
  using (barbershop_id = public.current_barbershop_id() and public.is_owner())
  with check (barbershop_id = public.current_barbershop_id() and public.is_owner());

-- ============================================================================
-- Caixa: abertura (troco inicial), sangria (retirada) e suprimento (reforço).
-- ============================================================================
create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  day date not null,
  kind text not null,
  amount numeric(10, 2) not null,
  notes text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.cash_movements drop constraint if exists cash_movements_check;
alter table public.cash_movements add constraint cash_movements_check
  check (kind in ('abertura', 'sangria', 'suprimento') and amount > 0);
create index if not exists cash_movements_shop_day_idx on public.cash_movements (barbershop_id, day);

alter table public.cash_movements enable row level security;
drop policy if exists "Dono gerencia movimentos de caixa" on public.cash_movements;
create policy "Dono gerencia movimentos de caixa"
  on public.cash_movements for all
  using (barbershop_id = public.current_barbershop_id() and public.is_owner())
  with check (barbershop_id = public.current_barbershop_id() and public.is_owner());

-- ============================================================================
-- Clientes: etiquetas, último contato e cashback.
-- ============================================================================
alter table public.customers add column if not exists tags text[] not null default '{}';
alter table public.customers add column if not exists last_contacted_at timestamptz;
alter table public.customers drop constraint if exists customers_tags_check;
alter table public.customers add constraint customers_tags_check
  check (cardinality(tags) <= 10);
grant update (name, notes, tags, last_contacted_at) on public.customers to authenticated;

create table if not exists public.cashback_entries (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete cascade,
  amount numeric(10, 2) not null,
  reason text not null,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.cashback_entries drop constraint if exists cashback_entries_check;
alter table public.cashback_entries add constraint cashback_entries_check
  check (amount <> 0 and reason in ('credito', 'uso', 'ajuste'));
-- Um crédito por atendimento, mesmo que finalize, desfaça e finalize de novo.
create unique index if not exists cashback_credit_per_appointment_idx
  on public.cashback_entries (appointment_id) where reason = 'credito';
create index if not exists cashback_entries_customer_idx on public.cashback_entries (customer_id);

alter table public.cashback_entries enable row level security;
drop policy if exists "Staff ve cashback" on public.cashback_entries;
create policy "Staff ve cashback"
  on public.cashback_entries for select
  using (barbershop_id = public.current_barbershop_id());
-- Uso de saldo pela equipe; o crédito vem do trigger abaixo.
drop policy if exists "Staff lanca uso de cashback" on public.cashback_entries;
create policy "Staff lanca uso de cashback"
  on public.cashback_entries for insert
  with check (
    barbershop_id = public.current_barbershop_id()
    and reason in ('uso', 'ajuste')
    and exists (
      select 1 from public.customers c
      where c.id = cashback_entries.customer_id and c.barbershop_id = cashback_entries.barbershop_id
    )
  );

-- Ao finalizar um atendimento pago, credita o % de cashback da barbearia.
-- Se o atendimento deixar de estar finalizado, o crédito sai.
create or replace function public.apply_cashback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_percent numeric;
  v_value numeric;
begin
  if new.status = 'finalizado'
     and new.customer_id is not null
     and coalesce(new.payment_method, '') in ('dinheiro', 'pix', 'cartao') then
    select cashback_percent into v_percent from barbershops where id = new.barbershop_id;
    if coalesce(v_percent, 0) > 0 then
      v_value := round(
        coalesce(new.amount_paid, (select price from services where id = new.service_id), 0)
        * v_percent / 100, 2);
      if v_value > 0 then
        insert into cashback_entries (barbershop_id, customer_id, appointment_id, amount, reason)
        values (new.barbershop_id, new.customer_id, new.id, v_value, 'credito')
        on conflict (appointment_id) where reason = 'credito' do nothing;
      end if;
    end if;
  elsif tg_op = 'UPDATE' and old.status = 'finalizado' and new.status <> 'finalizado' then
    delete from cashback_entries where appointment_id = new.id and reason = 'credito';
  end if;
  return new;
end;
$$;

drop trigger if exists apply_cashback on public.appointments;
create trigger apply_cashback
  after insert or update of status, payment_method, amount_paid on public.appointments
  for each row execute procedure public.apply_cashback();

-- ============================================================================
-- Avaliação do atendimento pelo cliente (link /h/:token, via servidor).
-- ============================================================================
create table if not exists public.customer_feedback (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  appointment_id uuid not null unique references public.appointments (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  barber_id uuid references public.users (id) on delete set null,
  rating integer not null,
  comment text,
  created_at timestamptz not null default now()
);
alter table public.customer_feedback drop constraint if exists customer_feedback_check;
alter table public.customer_feedback add constraint customer_feedback_check
  check (rating between 1 and 5 and (comment is null or length(comment) <= 500));
create index if not exists customer_feedback_shop_idx on public.customer_feedback (barbershop_id, created_at);

alter table public.customer_feedback enable row level security;
drop policy if exists "Staff ve avaliacoes" on public.customer_feedback;
create policy "Staff ve avaliacoes"
  on public.customer_feedback for select
  using (barbershop_id = public.current_barbershop_id());

-- ============================================================================
-- Clube: planos mensais para o cliente, assinaturas e pagamentos (manuais).
-- ============================================================================
create table if not exists public.club_plans (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  name text not null,
  description text,
  price numeric(10, 2) not null,
  -- Atendimentos por mês; null = ilimitado.
  uses_per_month integer,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.club_plans drop constraint if exists club_plans_check;
alter table public.club_plans add constraint club_plans_check
  check (price >= 0 and (uses_per_month is null or uses_per_month > 0) and length(btrim(name)) between 1 and 60);

create table if not exists public.club_subscriptions (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  plan_id uuid not null references public.club_plans (id) on delete restrict,
  -- Preço no momento da assinatura: mudar o plano não muda quem já assina.
  price numeric(10, 2) not null,
  status text not null default 'ativa',
  started_on date not null default current_date,
  next_due_on date not null default current_date,
  canceled_on date,
  sold_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.club_subscriptions drop constraint if exists club_subscriptions_check;
alter table public.club_subscriptions add constraint club_subscriptions_check
  check (status in ('ativa', 'cancelada') and price >= 0);
-- Uma assinatura ativa por cliente.
create unique index if not exists club_subscriptions_one_active_idx
  on public.club_subscriptions (customer_id) where status = 'ativa';
create index if not exists club_subscriptions_shop_idx on public.club_subscriptions (barbershop_id, status);

create table if not exists public.club_payments (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  subscription_id uuid not null references public.club_subscriptions (id) on delete cascade,
  amount numeric(10, 2) not null,
  payment_method text not null,
  paid_on date not null default current_date,
  -- Mês que este pagamento cobre (começa no vencimento que estava em aberto).
  period_start date not null,
  received_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.club_payments drop constraint if exists club_payments_check;
alter table public.club_payments add constraint club_payments_check
  check (amount >= 0 and payment_method in ('dinheiro', 'pix', 'cartao'));
create index if not exists club_payments_shop_paid_idx on public.club_payments (barbershop_id, paid_on);

alter table public.club_plans enable row level security;
alter table public.club_subscriptions enable row level security;
alter table public.club_payments enable row level security;

drop policy if exists "Staff ve planos" on public.club_plans;
create policy "Staff ve planos"
  on public.club_plans for select
  using (barbershop_id = public.current_barbershop_id());
drop policy if exists "Dono gerencia planos" on public.club_plans;
create policy "Dono gerencia planos"
  on public.club_plans for all
  using (barbershop_id = public.current_barbershop_id() and public.is_owner())
  with check (barbershop_id = public.current_barbershop_id() and public.is_owner());

-- Barbeiro também vende plano e registra pagamento.
drop policy if exists "Staff gerencia assinaturas" on public.club_subscriptions;
create policy "Staff gerencia assinaturas"
  on public.club_subscriptions for all
  using (barbershop_id = public.current_barbershop_id())
  with check (
    barbershop_id = public.current_barbershop_id()
    and exists (
      select 1 from public.customers c
      where c.id = club_subscriptions.customer_id and c.barbershop_id = club_subscriptions.barbershop_id
    )
    and exists (
      select 1 from public.club_plans p
      where p.id = club_subscriptions.plan_id and p.barbershop_id = club_subscriptions.barbershop_id
    )
  );
drop policy if exists "Staff gerencia pagamentos do clube" on public.club_payments;
create policy "Staff gerencia pagamentos do clube"
  on public.club_payments for all
  using (barbershop_id = public.current_barbershop_id())
  with check (
    barbershop_id = public.current_barbershop_id()
    and exists (
      select 1 from public.club_subscriptions s
      where s.id = club_payments.subscription_id and s.barbershop_id = club_payments.barbershop_id
    )
  );

-- Pagamento de mensalidade: registra e empurra o vencimento um mês, juntos.
create or replace function public.register_club_payment(
  p_subscription_id uuid,
  p_amount numeric,
  p_method text,
  p_paid_on date
)
returns date
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sub record;
begin
  select id, barbershop_id, next_due_on, status into v_sub
  from club_subscriptions where id = p_subscription_id
  for update;
  if v_sub.id is null then raise exception 'Assinatura não encontrada'; end if;
  if v_sub.status <> 'ativa' then raise exception 'Assinatura cancelada'; end if;

  insert into club_payments (barbershop_id, subscription_id, amount, payment_method, paid_on, period_start, received_by)
  values (v_sub.barbershop_id, v_sub.id, p_amount, p_method, coalesce(p_paid_on, current_date), v_sub.next_due_on, auth.uid());

  update club_subscriptions
  set next_due_on = (next_due_on + interval '1 month')::date
  where id = v_sub.id;

  return (v_sub.next_due_on + interval '1 month')::date;
end;
$$;

-- ============================================================================
-- Captação: cadastro na porta / indicação (página pública, via servidor).
-- ============================================================================
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  name text not null,
  phone text not null,
  referred_by_phone text,
  source text,
  status text not null default 'novo',
  created_at timestamptz not null default now()
);
alter table public.leads drop constraint if exists leads_check;
alter table public.leads add constraint leads_check
  check (
    phone ~ '^[0-9]{8,15}$'
    and (referred_by_phone is null or referred_by_phone ~ '^[0-9]{8,15}$')
    and length(btrim(name)) between 1 and 120
    and status in ('novo', 'contatado', 'virou_cliente')
    and (source is null or source ~ '^[a-z0-9_-]{1,40}$')
  );
create unique index if not exists leads_shop_phone_idx on public.leads (barbershop_id, phone);

alter table public.leads enable row level security;
drop policy if exists "Staff gerencia cadastros" on public.leads;
create policy "Staff gerencia cadastros"
  on public.leads for all
  using (barbershop_id = public.current_barbershop_id())
  with check (barbershop_id = public.current_barbershop_id());
