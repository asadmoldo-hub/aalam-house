-- Аалам Хаус: CRM агентства аренды недвижимости
-- Сущности: сотрудники, клиенты, объекты, бронирования, заявки, журнал событий,
-- услуги, настройки компании, база знаний (RAG), сессии чата, лимиты запросов.

create extension if not exists btree_gist with schema extensions;
create extension if not exists vector with schema extensions;

-- ───────────────────────── helpers ─────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ───────────────────────── staff ─────────────────────────
-- Доступ к CRM только у пользователей Auth, для которых есть строка в profiles.
-- Строки создаются только сервисным ключом (scripts/create-admin.mjs), публичная
-- регистрация прав не даёт.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  role text not null default 'manager' check (role in ('admin', 'manager')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()));
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke execute on function public.is_staff() from anon, public;
revoke execute on function public.is_admin() from anon, public;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ───────────────────────── clients ─────────────────────────

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 1 and 120),
  phone text check (phone is null or phone ~ '^[+0-9 ()\-]{7,20}$'),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telegram text check (telegram is null or char_length(telegram) <= 64),
  kind text not null default 'guest' check (kind in ('guest', 'tenant', 'owner', 'business')),
  source text not null default 'manual' check (source in ('website_form', 'ai_chat', 'phone', 'referral', 'manual')),
  notes text check (notes is null or char_length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_phone_idx on public.clients (phone);
create index clients_created_at_idx on public.clients (created_at desc);

-- ───────────────────────── properties ─────────────────────────

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 160),
  kind text not null check (kind in ('apartment', 'house', 'cottage', 'guest_house', 'camp', 'office', 'commercial')),
  region text not null check (region in ('issyk_kul_north', 'issyk_kul_south', 'bishkek', 'osh', 'other')),
  location text not null check (char_length(location) between 2 and 200),
  description text check (description is null or char_length(description) <= 5000),
  capacity text check (capacity is null or char_length(capacity) <= 120),
  max_guests int check (max_guests is null or max_guests between 1 and 500),
  price numeric(12, 2) not null check (price >= 0),
  price_unit text not null check (price_unit in ('night', 'month')),
  features text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'hidden', 'archived')),
  is_featured boolean not null default false,
  sort_order int not null default 0,
  owner_id uuid references public.clients (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index properties_status_idx on public.properties (status, sort_order);
create index properties_owner_idx on public.properties (owner_id);

-- ───────────────────────── leads ─────────────────────────

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  phone text not null check (phone ~ '^[+0-9 ()\-]{7,20}$'),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  topic text check (topic is null or char_length(topic) <= 160),
  message text check (message is null or char_length(message) <= 2000),
  source text not null check (source in ('website_form', 'ai_chat', 'phone', 'manual')),
  status text not null default 'new' check (status in ('new', 'in_progress', 'qualified', 'converted', 'lost')),
  property_id uuid references public.properties (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  assigned_to uuid references public.profiles (id) on delete set null,
  check_in date,
  check_out date,
  guests int check (guests is null or guests between 1 and 500),
  chat_session_id uuid,
  manager_notes text check (manager_notes is null or char_length(manager_notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_dates_check check (check_out is null or check_in is null or check_out > check_in)
);

create index leads_status_created_idx on public.leads (status, created_at desc);
create index leads_created_idx on public.leads (created_at desc);
create index leads_source_idx on public.leads (source);
create index leads_client_idx on public.leads (client_id);
create index leads_property_idx on public.leads (property_id);
create index leads_assigned_idx on public.leads (assigned_to);

-- ───────────────────────── bookings ─────────────────────────

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete restrict,
  client_id uuid not null references public.clients (id) on delete restrict,
  lead_id uuid references public.leads (id) on delete set null,
  check_in date not null,
  check_out date not null,
  guests int check (guests is null or guests between 1 and 500),
  total_price numeric(12, 2) check (total_price is null or total_price >= 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'checked_in', 'completed', 'cancelled')),
  notes text check (notes is null or char_length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_dates_check check (check_out > check_in),
  -- Один объект нельзя забронировать дважды на пересекающиеся даты
  constraint bookings_no_overlap exclude using gist (
    property_id with =,
    daterange(check_in, check_out, '[)') with &&
  ) where (status <> 'cancelled')
);

create index bookings_property_dates_idx on public.bookings (property_id, check_in, check_out);
create index bookings_client_idx on public.bookings (client_id);
create index bookings_lead_idx on public.bookings (lead_id);
create index bookings_status_idx on public.bookings (status, check_in);

-- ───────────────────────── activity log ─────────────────────────

create table public.activities (
  id bigint generated always as identity primary key,
  entity text not null check (entity in ('lead', 'client', 'booking', 'property', 'knowledge')),
  entity_id uuid not null,
  action text not null check (char_length(action) <= 60),
  details jsonb not null default '{}',
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index activities_created_idx on public.activities (created_at desc);
create index activities_entity_idx on public.activities (entity, entity_id);

create or replace function public.log_lead_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activities (entity, entity_id, action, details, actor_id)
    values ('lead', new.id, 'created', jsonb_build_object('source', new.source, 'name', new.name), (select auth.uid()));
  elsif new.status is distinct from old.status then
    insert into public.activities (entity, entity_id, action, details, actor_id)
    values ('lead', new.id, 'status_changed', jsonb_build_object('from', old.status, 'to', new.status, 'name', new.name), (select auth.uid()));
  end if;
  return new;
end;
$$;

create or replace function public.log_booking_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activities (entity, entity_id, action, details, actor_id)
    values ('booking', new.id, 'created', jsonb_build_object('check_in', new.check_in, 'check_out', new.check_out), (select auth.uid()));
  elsif new.status is distinct from old.status then
    insert into public.activities (entity, entity_id, action, details, actor_id)
    values ('booking', new.id, 'status_changed', jsonb_build_object('from', old.status, 'to', new.status), (select auth.uid()));
  end if;
  return new;
end;
$$;

-- ───────────────────────── services & settings ─────────────────────────

create table public.services (
  id uuid primary key default gen_random_uuid(),
  kicker text not null check (char_length(kicker) between 1 and 60),
  title text not null check (char_length(title) between 2 and 120),
  description text not null check (char_length(description) between 2 and 1000),
  tone text not null default 'cream' check (tone in ('cream', 'sage', 'rose')),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index services_active_idx on public.services (is_active, sort_order);

create table public.company_settings (
  id int primary key default 1 check (id = 1),
  name text not null,
  tagline text not null,
  phone text not null,
  whatsapp_url text,
  telegram_url text,
  instagram_url text,
  email text not null,
  address text not null,
  hours text not null,
  about text,
  chat_enabled boolean not null default true,
  chat_greeting text not null default 'Здравствуйте! Я помощник Аалам Хаус. Помогу подобрать жильё и отвечу на вопросы.',
  chat_instructions text check (chat_instructions is null or char_length(chat_instructions) <= 4000),
  updated_at timestamptz not null default now()
);

-- ───────────────────────── knowledge base ─────────────────────────

create table public.kb_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 200),
  kind text not null default 'article' check (kind in ('company', 'faq', 'service', 'policy', 'article', 'document')),
  content text not null check (char_length(content) between 1 and 200000),
  source_filename text,
  is_published boolean not null default true,
  indexed_at timestamptz,
  embedded_chunks int not null default 0,
  total_chunks int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.kb_chunks (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.kb_documents (id) on delete cascade,
  chunk_index int not null,
  content text not null,
  fts tsvector generated always as (to_tsvector('russian', content)) stored,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index kb_chunks_fts_idx on public.kb_chunks using gin (fts);
create index kb_chunks_embedding_idx on public.kb_chunks using hnsw (embedding extensions.vector_cosine_ops);

-- Гибридный поиск: полнотекстовый + векторный, слияние через Reciprocal Rank Fusion.
-- Эмбеддинги: OpenAI text-embedding-3-small, 1536 измерений.
-- Если эмбеддинга запроса нет, работает только полнотекстовая часть.
create or replace function public.search_kb(
  query_text text,
  query_embedding extensions.vector(1536) default null,
  match_count int default 6
)
returns table (chunk_id bigint, document_id uuid, title text, kind text, content text, score double precision)
language sql
stable
set search_path = ''
as $$
  with published as (
    select c.id, c.document_id, c.content, c.fts, c.embedding, d.title, d.kind
    from public.kb_chunks c
    join public.kb_documents d on d.id = c.document_id
    where d.is_published
  ),
  q as (
    select websearch_to_tsquery('russian', query_text) as tsq,
           to_tsquery('russian', array_to_string(
             array(select lexeme || ':*' from unnest(to_tsvector('russian', query_text))), ' | '
           )) as tsq_any
  ),
  fts as (
    select p.id, row_number() over (order by ts_rank_cd(p.fts, q.tsq_any) desc) as rnk
    from published p, q
    where q.tsq_any is not null and p.fts @@ q.tsq_any
    limit 30
  ),
  vec as (
    select p.id, row_number() over (order by p.embedding operator(extensions.<=>) query_embedding) as rnk
    from published p
    where query_embedding is not null and p.embedding is not null
    order by p.embedding operator(extensions.<=>) query_embedding
    limit 30
  ),
  fused as (
    select coalesce(f.id, v.id) as id,
           coalesce(1.0 / (60 + f.rnk), 0) + coalesce(1.0 / (60 + v.rnk), 0) as score
    from fts f
    full outer join vec v on v.id = f.id
  )
  select p.id, p.document_id, p.title, p.kind, p.content, fused.score
  from fused
  join published p on p.id = fused.id
  order by fused.score desc
  limit greatest(1, least(match_count, 20));
$$;

-- ───────────────────────── chat & rate limits ─────────────────────────

create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  client_key text not null,
  lead_id uuid references public.leads (id) on delete set null,
  message_count int not null default 0,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  tool_calls int not null default 0,
  transcript jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chat_sessions_created_idx on public.chat_sessions (created_at desc);

alter table public.leads
  add constraint leads_chat_session_fk foreign key (chat_session_id)
  references public.chat_sessions (id) on delete set null;

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits int not null default 0
);

-- Атомарно учитывает запрос и возвращает true, если лимит не превышен
create or replace function public.hit_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_hits int;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;

revoke execute on function public.hit_rate_limit(text, int, int) from anon, authenticated, public;
revoke execute on function public.search_kb(text, extensions.vector, int) from anon, public;

-- ───────────────────────── triggers ─────────────────────────

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger clients_updated_at before update on public.clients for each row execute function public.set_updated_at();
create trigger properties_updated_at before update on public.properties for each row execute function public.set_updated_at();
create trigger leads_updated_at before update on public.leads for each row execute function public.set_updated_at();
create trigger bookings_updated_at before update on public.bookings for each row execute function public.set_updated_at();
create trigger services_updated_at before update on public.services for each row execute function public.set_updated_at();
create trigger company_settings_updated_at before update on public.company_settings for each row execute function public.set_updated_at();
create trigger kb_documents_updated_at before update on public.kb_documents for each row execute function public.set_updated_at();
create trigger chat_sessions_updated_at before update on public.chat_sessions for each row execute function public.set_updated_at();

create trigger leads_activity after insert or update on public.leads for each row execute function public.log_lead_activity();
create trigger bookings_activity after insert or update on public.bookings for each row execute function public.log_booking_activity();

-- ───────────────────────── RLS ─────────────────────────
-- anon: нет доступа ни к одной таблице. Публичные данные лендинга и заявки
-- читаются/пишутся сервером с секретным ключом после валидации.
-- authenticated: доступ только сотрудникам (is_staff()).

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.properties enable row level security;
alter table public.leads enable row level security;
alter table public.bookings enable row level security;
alter table public.activities enable row level security;
alter table public.services enable row level security;
alter table public.company_settings enable row level security;
alter table public.kb_documents enable row level security;
alter table public.kb_chunks enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.rate_limits enable row level security;

create policy "staff read profiles" on public.profiles for select to authenticated using ((select public.is_staff()));
create policy "admin manage profiles" on public.profiles for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "staff all clients" on public.clients for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff all properties" on public.properties for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff all leads" on public.leads for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff all bookings" on public.bookings for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff read activities" on public.activities for select to authenticated using ((select public.is_staff()));
create policy "staff all services" on public.services for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff read settings" on public.company_settings for select to authenticated using ((select public.is_staff()));
create policy "admin update settings" on public.company_settings for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "staff all kb documents" on public.kb_documents for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff all kb chunks" on public.kb_chunks for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff read chat sessions" on public.chat_sessions for select to authenticated using ((select public.is_staff()));
-- rate_limits: без политик — только сервисный ключ

grant execute on function public.search_kb(text, extensions.vector, int) to authenticated;
