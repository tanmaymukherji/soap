create extension if not exists pgcrypto with schema extensions;

create or replace function public.soap_admin_password_matches(p_username text, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_password_hash text;
begin
  select password_hash
  into v_password_hash
  from public.soap_admin_accounts
  where username = lower(trim(coalesce(p_username, '')));

  if v_password_hash is null then
    return false;
  end if;

  return extensions.crypt(p_password, v_password_hash) = v_password_hash;
end;
$$;

create or replace function public.soap_hash_admin_password(p_password text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if coalesce(length(trim(p_password)), 0) < 10 then
    raise exception 'password must be at least 10 characters long';
  end if;

  return extensions.crypt(p_password, extensions.gen_salt('bf'));
end;
$$;

revoke all on function public.soap_admin_password_matches(text, text) from public, anon, authenticated;
revoke all on function public.soap_hash_admin_password(text) from public, anon, authenticated;

grant execute on function public.soap_admin_password_matches(text, text) to service_role;
grant execute on function public.soap_hash_admin_password(text) to service_role;
