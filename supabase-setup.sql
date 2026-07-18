-- =====================================================================
-- CodeCraft Solutions — configuração do Supabase (script completo)
-- Rode UMA VEZ no Supabase: menu "SQL Editor" → New query → cole tudo →
-- RUN. Cria as 3 tabelas que o site usa (sem apagar dados existentes),
-- as permissões e liga a atualização em tempo real (realtime).
-- =====================================================================

-- ================= TABELAS =================
create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  tracking_code text unique not null,
  client_name  text not null,
  project_name text not null,
  status       text not null default 'analise',
  pix_key      text,
  pix_value    numeric,
  pix_city     text,
  notes        text,
  paid         boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  contact    text not null,
  msg        text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id           uuid primary key default gen_random_uuid(),
  tracking_code text not null,
  sender       text not null check (sender in ('admin','client')),
  body         text not null,
  created_at   timestamptz not null default now()
);
create index if not exists chat_messages_tracking_idx
  on public.chat_messages (tracking_code, created_at);

-- Chat aberto: contatos iniciados na landing, antes de existir um projeto.
-- As mensagens reusam a tabela chat_messages (tracking_code = lead_chats.code).
create table if not exists public.lead_chats (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,
  name       text not null,
  created_at timestamptz not null default now(),
  last_at    timestamptz not null default now()
);
create index if not exists lead_chats_last_idx
  on public.lead_chats (last_at desc);

-- ================= PERMISSÕES (RLS) =================
-- Protótipo: liberado para a chave anônima. Troque por regras mais
-- restritas antes de usar com dados sensíveis.
alter table public.projects      enable row level security;
alter table public.messages      enable row level security;
alter table public.chat_messages enable row level security;
alter table public.lead_chats    enable row level security;

drop policy if exists "anon all projects" on public.projects;
create policy "anon all projects" on public.projects for all using (true) with check (true);

drop policy if exists "anon all messages" on public.messages;
create policy "anon all messages" on public.messages for all using (true) with check (true);

drop policy if exists "anon all chat" on public.chat_messages;
create policy "anon all chat" on public.chat_messages for all using (true) with check (true);

drop policy if exists "anon all leads" on public.lead_chats;
create policy "anon all leads" on public.lead_chats for all using (true) with check (true);

-- ================= REALTIME =================
-- Sem isso, as mudanças não chegam em tempo real e você precisa
-- ficar recarregando a página.
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.projects';      exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.messages';       exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.chat_messages';  exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.lead_chats';     exception when duplicate_object then null; end;
end $$;

-- REPLICA IDENTITY FULL: necessário para os filtros de realtime
-- (ex.: acompanhar um projeto por tracking_code) funcionarem.
alter table public.projects      replica identity full;
alter table public.messages      replica identity full;
alter table public.chat_messages replica identity full;
alter table public.lead_chats    replica identity full;
