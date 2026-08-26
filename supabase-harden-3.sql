-- BLOCO 3 (seguro) — só altera tabelas que existem
do $body$
begin
  -- chat_messages
  if to_regclass('public.chat_messages') is not null then
    execute 'drop policy if exists "anon all chat" on public.chat_messages';
    execute 'drop policy if exists "public read chat" on public.chat_messages';
    execute 'drop policy if exists "public insert chat" on public.chat_messages';
    execute 'drop policy if exists "auth delete chat" on public.chat_messages';
    execute 'create policy "public read chat" on public.chat_messages for select using (true)';
    execute 'create policy "public insert chat" on public.chat_messages for insert with check (true)';
    execute 'create policy "auth delete chat" on public.chat_messages for delete to authenticated using (true)';
  end if;

  -- lead_chats
  if to_regclass('public.lead_chats') is not null then
    execute 'drop policy if exists "anon all leads" on public.lead_chats';
    execute 'drop policy if exists "public insert leads" on public.lead_chats';
    execute 'drop policy if exists "public read leads" on public.lead_chats';
    execute 'drop policy if exists "auth update leads" on public.lead_chats';
    execute 'create policy "public insert leads" on public.lead_chats for insert with check (true)';
    execute 'create policy "public read leads" on public.lead_chats for select using (true)';
    execute 'create policy "auth update leads" on public.lead_chats for update to authenticated using (true) with check (true)';
  end if;

  -- admin_leads
  if to_regclass('public.admin_leads') is not null then
    execute 'drop policy if exists "anon all admin_leads" on public.admin_leads';
    execute 'drop policy if exists "auth all admin_leads" on public.admin_leads';
    execute 'create policy "auth all admin_leads" on public.admin_leads for all to authenticated using (true) with check (true)';
  end if;

  -- marketing_intel
  if to_regclass('public.marketing_intel') is not null then
    execute 'drop policy if exists "anon all marketing" on public.marketing_intel';
    execute 'drop policy if exists "public read marketing" on public.marketing_intel';
    execute 'drop policy if exists "auth write marketing" on public.marketing_intel';
    execute 'create policy "public read marketing" on public.marketing_intel for select using (true)';
    execute 'create policy "auth write marketing" on public.marketing_intel for all to authenticated using (true) with check (true)';
  end if;

  -- indexes (só se a tabela/coluna existir)
  if to_regclass('public.projects') is not null then
    execute 'create index if not exists projects_status_idx on public.projects (status)';
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'projects' and column_name = 'paid'
    ) then
      execute 'create index if not exists projects_paid_idx on public.projects (paid)';
    end if;
  end if;

  if to_regclass('public.messages') is not null then
    execute 'create index if not exists messages_created_idx on public.messages (created_at desc)';
  end if;
end;
$body$;
