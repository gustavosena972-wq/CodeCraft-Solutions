-- CodeCraft Solutions — anti-spoof de chat admin (rode no SQL Editor do Supabase)
-- Impede visitante anônimo de inserir mensagens com sender = 'admin'.

create or replace function public.ccs_chat_block_spoof_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.sender, '')) = 'admin' and auth.uid() is null then
    raise exception 'Somente usuários autenticados podem enviar como admin';
  end if;
  return new;
end;
$$;

drop trigger if exists ccs_chat_block_spoof_admin on public.chat_messages;
create trigger ccs_chat_block_spoof_admin
  before insert on public.chat_messages
  for each row execute function public.ccs_chat_block_spoof_admin();
