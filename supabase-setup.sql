-- =====================================================================
-- CodeCraft Solutions — configuração do Supabase
-- Rode este script UMA VEZ no Supabase: menu "SQL Editor" → New query →
-- cole tudo → RUN. Ele cria a tabela de conversas (chat) e liga a
-- atualização em tempo real (realtime) para o painel/portal atualizarem
-- sozinhos, sem precisar recarregar a página.
-- =====================================================================

-- 1) Tabela de conversas (chat estilo WhatsApp por projeto)
create table if not exists public.chat_messages (
  id            uuid primary key default gen_random_uuid(),
  tracking_code text not null,
  sender        text not null check (sender in ('admin','client')),
  body          text not null,
  created_at    timestamptz not null default now()
);
create index if not exists chat_messages_tracking_idx
  on public.chat_messages (tracking_code, created_at);

-- 2) Permissões (RLS). Protótipo: liberado para a chave anônima.
--    Troque por regras mais restritas antes de usar com dados sensíveis.
alter table public.chat_messages enable row level security;

drop policy if exists "chat anon select" on public.chat_messages;
create policy "chat anon select" on public.chat_messages
  for select using (true);

drop policy if exists "chat anon insert" on public.chat_messages;
create policy "chat anon insert" on public.chat_messages
  for insert with check (true);

-- 3) Realtime: adiciona as tabelas na publicação usada pelo Supabase.
--    Sem isso, as mudanças não chegam em tempo real e você precisa
--    ficar recarregando a página.
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.projects';      exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.messages';       exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.chat_messages';  exception when duplicate_object then null; end;
end $$;

-- 4) REPLICA IDENTITY FULL: necessário para os filtros de realtime
--    (ex.: acompanhar um projeto por tracking_code) funcionarem.
alter table public.projects      replica identity full;
alter table public.chat_messages replica identity full;
