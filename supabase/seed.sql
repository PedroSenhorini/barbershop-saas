-- ============================================================================
-- Seed de demonstração — "Cartola Barbearia"
-- Rode depois do schema.sql. Cria uma barbearia com dono + barbeiros,
-- serviços e uma agenda de HOJE já cheia, prontos para o pitch.
-- Senha de todos os funcionários de demo: "demo1234"
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Barbearia
-- ----------------------------------------------------------------------------
insert into public.barbershops (id, name, slug, phone, address, weekly_hours)
values (
  '11111111-1111-4111-8111-111111111111',
  'Cartola Barbearia',
  'demo-barbearia',
  '11988887777',
  'Rua Augusta, 1200 — São Paulo, SP',
  '[
    null,
    {"open":"08:00","close":"19:00","breakStart":"12:00","breakEnd":"13:00"},
    {"open":"08:00","close":"19:00","breakStart":"12:00","breakEnd":"13:00"},
    {"open":"08:00","close":"19:00","breakStart":"12:00","breakEnd":"13:00"},
    {"open":"08:00","close":"19:00","breakStart":"12:00","breakEnd":"13:00"},
    {"open":"08:00","close":"19:00","breakStart":"12:00","breakEnd":"13:00"},
    {"open":"08:00","close":"16:00","breakStart":null,"breakEnd":null}
  ]'::jsonb
)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Staff (auth.users + public.users). Inserir direto em auth.users só faz
-- sentido em ambiente de demonstração/seed — em produção a conta do dono nasce
-- em /cadastro e a dos barbeiros na tela Equipe (ambas usam a Admin API).
-- ----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated', 'authenticated',
    'dono@cartolabarbearia.com.br',
    crypt('demo1234', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-4333-8333-333333333333',
    'authenticated', 'authenticated',
    'rafael.barbeiro@cartolabarbearia.com.br',
    crypt('demo1234', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '44444444-4444-4444-8444-444444444444',
    'authenticated', 'authenticated',
    'juliana.barbeira@cartolabarbearia.com.br',
    crypt('demo1234', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', ''
  )
on conflict (id) do nothing;

-- O Auth lê estas colunas como texto e falha com "Database error querying
-- schema" (login e Admin API quebram) se ficarem NULL. Quem cria pela Admin
-- API recebe '' automaticamente; inserindo direto, precisamos preencher.
update auth.users set
  email_change = coalesce(email_change, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, '')
where email like '%@cartolabarbearia.com.br';

-- O dono da demo só administra: não aparece como opção para o cliente.
insert into public.users (id, barbershop_id, full_name, role, active, takes_appointments)
values
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Marcos Andrade', 'owner', true, false),
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'Rafael Souza', 'barber', true, true),
  ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'Juliana Lima', 'barber', true, true)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Serviços
-- ----------------------------------------------------------------------------
insert into public.services (id, barbershop_id, name, description, price, duration_minutes)
values
  ('55555555-5555-4555-8555-555555555501', '11111111-1111-4111-8111-111111111111', 'Corte Masculino', 'Corte na tesoura ou máquina, com acabamento na navalha.', 45.00, 30),
  ('55555555-5555-4555-8555-555555555502', '11111111-1111-4111-8111-111111111111', 'Barba', 'Barba desenhada com toalha quente.', 35.00, 30),
  ('55555555-5555-4555-8555-555555555503', '11111111-1111-4111-8111-111111111111', 'Corte + Barba', 'Combo completo de corte e barba.', 70.00, 60),
  ('55555555-5555-4555-8555-555555555504', '11111111-1111-4111-8111-111111111111', 'Alisamento', 'Alisamento capilar com produtos profissionais.', 90.00, 60),
  ('55555555-5555-4555-8555-555555555505', '11111111-1111-4111-8111-111111111111', 'Sobrancelha', 'Design de sobrancelha na navalha.', 20.00, 15)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Agendamentos de hoje (no fuso de São Paulo), em todos os status. ends_at é
-- calculado a partir da duração do serviço.
-- ----------------------------------------------------------------------------
insert into public.appointments (
  barbershop_id, service_id, barber_id, customer_name, customer_phone,
  scheduled_at, ends_at, status
)
select
  '11111111-1111-4111-8111-111111111111',
  v.service_id::uuid,
  v.barber_id::uuid,
  v.customer_name,
  v.customer_phone,
  v.starts,
  v.starts + make_interval(mins => s.duration_minutes),
  v.status
from (
  select
    v0.*,
    ((now() at time zone 'America/Sao_Paulo')::date + v0.at_time)
      at time zone 'America/Sao_Paulo' as starts
  from (values
    ('55555555-5555-4555-8555-555555555501', '33333333-3333-4333-8333-333333333333', 'Pedro Nilson',     '11991112222', time '09:00', 'solicitado'),
    ('55555555-5555-4555-8555-555555555502', '44444444-4444-4444-8444-444444444444', 'Lucas Ferreira',   '11991113333', time '10:30', 'solicitado'),
    ('55555555-5555-4555-8555-555555555505', '33333333-3333-4333-8333-333333333333', 'Gabriel Nogueira', '11991114444', time '16:00', 'solicitado'),
    ('55555555-5555-4555-8555-555555555503', '33333333-3333-4333-8333-333333333333', 'Thiago Martins',   '11992221111', time '10:00', 'confirmado'),
    ('55555555-5555-4555-8555-555555555501', '44444444-4444-4444-8444-444444444444', 'Bruno Cardoso',    '11992222222', time '13:30', 'confirmado'),
    ('55555555-5555-4555-8555-555555555504', '33333333-3333-4333-8333-333333333333', 'André Ribeiro',    '11992223333', time '17:00', 'confirmado'),
    ('55555555-5555-4555-8555-555555555502', '44444444-4444-4444-8444-444444444444', 'Felipe Costa',     '11993331111', time '14:00', 'em_andamento'),
    ('55555555-5555-4555-8555-555555555501', '33333333-3333-4333-8333-333333333333', 'Rodrigo Almeida',  '11994441111', time '08:00', 'finalizado'),
    ('55555555-5555-4555-8555-555555555503', '44444444-4444-4444-8444-444444444444', 'Diego Barbosa',    '11994442222', time '08:30', 'finalizado')
  ) as v0 (service_id, barber_id, customer_name, customer_phone, at_time, status)
) as v
join public.services s on s.id = v.service_id::uuid;
