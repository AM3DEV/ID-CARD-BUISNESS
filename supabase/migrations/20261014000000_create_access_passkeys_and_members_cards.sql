-- Migration: create access_passkeys and members_cards tables
-- Supabase CLI migration — appliquée via `supabase db push`
-- Contenu identique à schema.sql (racine). Voir README.md dans ce dossier
-- pour la procédure copier-coller dans le Dashboard Supabase.

create extension if not exists "pgcrypto";

create table if not exists public.access_passkeys (
  id uuid primary key default gen_random_uuid(),
  passkey_code text unique not null,
  label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_access_passkeys_code
  on public.access_passkeys (passkey_code);

create table if not exists public.members_cards (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  role text not null,
  badge_status text not null default 'MEMBRE DU BUREAU',
  validity_year text not null default '2026/2027',
  photo_base64 text,
  created_at timestamptz not null default now()
);

create index if not exists idx_members_cards_created_at
  on public.members_cards (created_at desc);

alter table public.access_passkeys enable row level security;
alter table public.members_cards enable row level security;

drop policy if exists "Allow anon read active passkeys" on public.access_passkeys;
create policy "Allow anon read active passkeys"
  on public.access_passkeys
  for select
  to anon
  using (true);

drop policy if exists "Allow anon read members cards" on public.members_cards;
create policy "Allow anon read members cards"
  on public.members_cards
  for select
  to anon
  using (true);

drop policy if exists "Allow anon insert members cards" on public.members_cards;
create policy "Allow anon insert members cards"
  on public.members_cards
  for insert
  to anon
  with check (true);

drop policy if exists "Allow anon update members cards" on public.members_cards;
create policy "Allow anon update members cards"
  on public.members_cards
  for update
  to anon
  using (true)
  with check (true);

drop policy if exists "Allow anon delete members cards" on public.members_cards;
create policy "Allow anon delete members cards"
  on public.members_cards
  for delete
  to anon
  using (true);

insert into public.access_passkeys (passkey_code, label, is_active)
values ('ECONEXUS-2026', 'Passkey de test initial', true)
on conflict (passkey_code) do update
  set label = excluded.label,
      is_active = true;
