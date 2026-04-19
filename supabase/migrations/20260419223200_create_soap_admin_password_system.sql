create extension if not exists pgcrypto with schema extensions;

create table if not exists public.soap_admin_accounts (
  username text primary key,
  password_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint soap_admin_accounts_username_lowercase check (username = lower(username))
);

create table if not exists public.soap_admin_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  username text not null references public.soap_admin_accounts(username) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

create index if not exists soap_admin_sessions_expires_idx
on public.soap_admin_sessions (expires_at);

alter table public.soap_admin_accounts enable row level security;
alter table public.soap_admin_sessions enable row level security;

insert into public.soap_admin_accounts (username, password_hash)
values ('admin', null)
on conflict (username) do nothing;
