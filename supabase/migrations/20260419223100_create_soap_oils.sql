create extension if not exists pgcrypto with schema extensions;

create table if not exists public.soap_oils (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  submitted_by text,
  naoh_sap numeric,
  koh_sap numeric,
  hardness numeric,
  cleansing numeric,
  condition numeric,
  bubbly numeric,
  creamy numeric,
  iodine numeric,
  ins numeric,
  lauric numeric,
  myristic numeric,
  palmitic numeric,
  stearic numeric,
  ricinoleic numeric,
  oleic numeric,
  linoleic numeric,
  linolenic numeric,
  saturated numeric,
  unsaturated numeric,
  status text not null default 'approved',
  approved_at timestamptz,
  approved_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint soap_oils_status_check check (status in ('pending', 'approved'))
);

create unique index if not exists soap_oils_name_lower_key
on public.soap_oils (lower(name));

create index if not exists soap_oils_status_idx
on public.soap_oils (status, created_at desc);

alter table public.soap_oils enable row level security;

drop policy if exists "approved soap oils are public" on public.soap_oils;
drop policy if exists "public can submit pending soap oils" on public.soap_oils;

create policy "approved soap oils are public"
on public.soap_oils
for select
to anon, authenticated
using (status = 'approved');

create policy "public can submit pending soap oils"
on public.soap_oils
for insert
to anon, authenticated
with check (
  status = 'pending'
  and approved_at is null
  and approved_by is null
);
