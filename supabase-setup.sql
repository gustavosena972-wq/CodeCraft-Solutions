-- =====================================================================
-- CodeCraft Solutions — configuração do Supabase (script completo)
-- Rode UMA VEZ no Supabase: menu "SQL Editor" → New query → cole tudo →
-- RUN. Cria as tabelas que o site usa (sem apagar dados existentes),
-- as permissões e liga a atualização em tempo real (realtime).
--
-- Depois, rode também supabase-harden.sql para trancar escrita anônima
-- (projetos só com login admin).
-- =====================================================================

-- ================= TABELAS =================
create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  tracking_code text unique not null,
  client_name  text not null,
  project_name text not null,
  service_type text not null default 'site',
  status       text not null default 'analise',
  delivery_url text,
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

-- Fila comercial do admin (Clientes). Sem isso, o cadastro fica só no computador.
create table if not exists public.admin_leads (
  id         text primary key,
  name       text not null,
  phone      text,
  niche      text,
  status     text not null default 'aberto',
  created_at timestamptz not null default now()
);
create index if not exists admin_leads_created_idx
  on public.admin_leads (created_at desc);

-- Se a tabela projects já existia antes, adiciona a coluna de tipo de serviço.
alter table public.projects add column if not exists service_type text not null default 'site';

-- Link de entrega do projeto (site pronto) mostrado ao cliente.
alter table public.projects add column if not exists delivery_url text;

-- ================= PERMISSÕES (RLS) =================
-- Protótipo: liberado para a chave anônima. Troque por regras mais
-- restritas antes de usar com dados sensíveis.
alter table public.projects      enable row level security;
alter table public.messages      enable row level security;
alter table public.chat_messages enable row level security;
alter table public.lead_chats    enable row level security;
alter table public.admin_leads   enable row level security;

drop policy if exists "anon all projects" on public.projects;
create policy "anon all projects" on public.projects for all using (true) with check (true);

drop policy if exists "anon all messages" on public.messages;
create policy "anon all messages" on public.messages for all using (true) with check (true);

drop policy if exists "anon all chat" on public.chat_messages;
create policy "anon all chat" on public.chat_messages for all using (true) with check (true);

drop policy if exists "anon all leads" on public.lead_chats;
create policy "anon all leads" on public.lead_chats for all using (true) with check (true);

drop policy if exists "anon all admin_leads" on public.admin_leads;
create policy "anon all admin_leads" on public.admin_leads for all using (true) with check (true);

-- ================= REALTIME =================
-- Sem isso, as mudanças não chegam em tempo real e você precisa
-- ficar recarregando a página.
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.projects';      exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.messages';       exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.chat_messages';  exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.lead_chats';     exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.admin_leads';    exception when duplicate_object then null; end;
end $$;

-- REPLICA IDENTITY FULL: necessário para os filtros de realtime
-- (ex.: acompanhar um projeto por tracking_code) funcionarem.
alter table public.projects      replica identity full;
alter table public.messages      replica identity full;
alter table public.chat_messages replica identity full;
alter table public.lead_chats    replica identity full;
alter table public.admin_leads   replica identity full;

-- Banco de inteligência de marketing da @code.invention
create table if not exists public.marketing_intel (
  id          uuid primary key default gen_random_uuid(),
  cat         text not null,
  title       text not null unique,
  body        text not null,
  channel     text not null default 'instagram',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.marketing_intel enable row level security;
drop policy if exists "anon all marketing" on public.marketing_intel;
create policy "anon all marketing" on public.marketing_intel for all using (true) with check (true);
alter table public.marketing_intel replica identity full;
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.marketing_intel'; exception when duplicate_object then null; end;
end $$;

insert into public.marketing_intel (cat, title, body) values
('strategy', 'Posicionamento', 'CodeCraft Solutions atende MEI, PME e grandes empresas em BH e Brasil. Sites, lojas, sistemas sob medida e CodeCraft Gestão (ERP). Toda peça: 1 problema, 1 prova, 1 CTA (chat do site ou portal).'),
('calendar', 'Semana padrão', 'Seg: problema do nicho. Ter: antes/depois. Qua: CodeCraft Gestão. Qui: prova social. Sex: oferta PIX na entrega. Sáb: mercado (Selic/dólar) + o que vender. Dom: bastidor da @code.invention.'),
('copy', 'Gancho', 'Primeira linha tem 3 segundos: “Sua empresa ainda perde cliente sem site profissional?”. Depois prova. Depois o que fazer. Hashtag no fim, nunca no começo.'),
('growth', 'Alcance', 'Reels ensina. Carrossel salva. Story pergunta. Feed posiciona. Não poste os 4 iguais. Um gancho, um CTA, um @code.invention. 4–6 posts/semana bate 1 viral.'),
('niche', 'Quem comprar', 'MEI, pequenas, médias e grandes empresas: clínica, loja, indústria, SaaS, varejo e corporativo. Site, loja, sistema ou ERP (Gestão). Freelance + chat do site + inbound.'),
('offer', 'Oferta', 'PIX na entrega. Preço de partida no site. CodeCraft Gestão para quem precisa de people, finanças e operações num só lugar. Uma oferta por post. Nunca duas.')
on conflict do nothing;

-- Arte da IA do Instagram (@code.invention). Bucket público para a Meta
-- conseguir puxar a imagem na hora de publicar.
insert into storage.buckets (id, name, public)
values ('ig-posts', 'ig-posts', true)
on conflict (id) do update set public = true;

drop policy if exists "anon read ig posts" on storage.objects;
create policy "anon read ig posts" on storage.objects
  for select using (bucket_id = 'ig-posts');

drop policy if exists "anon upload ig posts" on storage.objects;
create policy "anon upload ig posts" on storage.objects
  for insert with check (bucket_id = 'ig-posts');

drop policy if exists "anon update ig posts" on storage.objects;
create policy "anon update ig posts" on storage.objects
  for update using (bucket_id = 'ig-posts') with check (bucket_id = 'ig-posts');
