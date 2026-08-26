-- =====================================================================
-- CodeCraft Solutions — endurecimento do banco (rode no SQL Editor)
-- NÃO apaga dados. Ajusta RLS, constraints e updated_at.
--
-- Efeito: visitantes ainda enviam contato/chat e consultam o portal;
-- criar/editar/apagar projetos e ver fila comercial exige usuário Auth.
-- =====================================================================

-- Status válidos
alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects
  add constraint projects_status_check
  check (status in ('analise', 'andamento', 'concluido'));

-- updated_at automático
create or replace function public.ccs_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ccs_projects_touch on public.projects;
create trigger ccs_projects_touch
  before update on public.projects
  for each row execute function public.ccs_touch_updated_at();

-- ================= RLS mais segura =================
-- projects: leitura pública (portal); escrita só autenticado
drop policy if exists "anon all projects" on public.projects;
drop policy if exists "public read projects" on public.projects;
drop policy if exists "auth write projects" on public.projects;
create policy "public read projects" on public.projects
  for select using (true);
create policy "auth write projects" on public.projects
  for all to authenticated
  using (true) with check (true);

-- messages: visitante envia; admin lê/apaga
drop policy if exists "anon all messages" on public.messages;
drop policy if exists "public insert messages" on public.messages;
drop policy if exists "auth read messages" on public.messages;
drop policy if exists "auth delete messages" on public.messages;
create policy "public insert messages" on public.messages
  for insert with check (true);
create policy "auth read messages" on public.messages
  for select to authenticated using (true);
create policy "auth delete messages" on public.messages
  for delete to authenticated using (true);

-- chat: cliente e admin enviam/lêem (portal + widget); delete só admin
drop policy if exists "anon all chat" on public.chat_messages;
drop policy if exists "public read chat" on public.chat_messages;
drop policy if exists "public insert chat" on public.chat_messages;
drop policy if exists "auth delete chat" on public.chat_messages;
create policy "public read chat" on public.chat_messages
  for select using (true);
create policy "public insert chat" on public.chat_messages
  for insert with check (true);
create policy "auth delete chat" on public.chat_messages
  for delete to authenticated using (true);

-- lead_chats: abrir chat público; listar/atualizar admin
drop policy if exists "anon all leads" on public.lead_chats;
drop policy if exists "public insert leads" on public.lead_chats;
drop policy if exists "public read leads" on public.lead_chats;
drop policy if exists "auth update leads" on public.lead_chats;
create policy "public insert leads" on public.lead_chats
  for insert with check (true);
create policy "public read leads" on public.lead_chats
  for select using (true);
create policy "auth update leads" on public.lead_chats
  for update to authenticated using (true) with check (true);

-- admin_leads: só autenticado
drop policy if exists "anon all admin_leads" on public.admin_leads;
drop policy if exists "auth all admin_leads" on public.admin_leads;
create policy "auth all admin_leads" on public.admin_leads
  for all to authenticated using (true) with check (true);

-- marketing_intel: leitura pública; escrita autenticada
drop policy if exists "anon all marketing" on public.marketing_intel;
drop policy if exists "public read marketing" on public.marketing_intel;
drop policy if exists "auth write marketing" on public.marketing_intel;
create policy "public read marketing" on public.marketing_intel
  for select using (true);
create policy "auth write marketing" on public.marketing_intel
  for all to authenticated using (true) with check (true);

-- Índices úteis
create index if not exists projects_status_idx on public.projects (status);
create index if not exists projects_paid_idx on public.projects (paid);
create index if not exists messages_created_idx on public.messages (created_at desc);
