-- BLOCO 1 — status + updated_at
alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects
  add constraint projects_status_check
  check (status in ('analise', 'andamento', 'concluido'));

create or replace function public.ccs_touch_updated_at()
returns trigger
language plpgsql
as $body$
begin
  new.updated_at = now();
  return new;
end;
$body$;

drop trigger if exists ccs_projects_touch on public.projects;
create trigger ccs_projects_touch
  before update on public.projects
  for each row
  execute procedure public.ccs_touch_updated_at();
