-- BLOCO 2 — RLS projects + messages
drop policy if exists "anon all projects" on public.projects;
drop policy if exists "public read projects" on public.projects;
drop policy if exists "auth write projects" on public.projects;
create policy "public read projects" on public.projects
  for select using (true);
create policy "auth write projects" on public.projects
  for all to authenticated
  using (true) with check (true);

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
