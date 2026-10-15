-- ============================================================================
-- ECONEXUS - CLUB ÉTUDIANT · ID Card Generator Panel
-- schema.sql — Script complet prêt à exécuter dans Supabase (SQL Editor)
-- ============================================================================
-- COMMENT L'UTILISER (copier-coller) :
--   1. Ouvrez votre projet sur https://supabase.com/dashboard
--   2. Allez dans « SQL Editor » → « New query »
--   3. Copiez-collez TOUT ce fichier, puis cliquez sur « Run »
--   4. Vérifiez dans « Table Editor » que les tables
--      access_passkeys et members_cards existent.
-- Une migration identique est aussi disponible dans :
--   supabase/migrations/20261014000000_create_access_passkeys_and_members_cards.sql
-- ============================================================================

-- Extensions requises (uuid)
create extension if not exists "pgcrypto";

-- --------------------------------------------------------------------------
-- 1. Table access_passkeys — Passkeys d'accès au panneau (créés par l'admin)
-- --------------------------------------------------------------------------
create table if not exists public.access_passkeys (
  id uuid primary key default gen_random_uuid(),
  passkey_code text unique not null,
  label text,
  is_active boolean not null default true,
  first_name text,
  last_name text,
  created_at timestamptz not null default now()
);

-- Bases déjà créées : ajoute les colonnes du propriétaire sans rien casser
alter table public.access_passkeys
  add column if not exists first_name text,
  add column if not exists last_name text;

-- Index pour la vérification rapide du passkey au login
create index if not exists idx_access_passkeys_code
  on public.access_passkeys (passkey_code);

-- --------------------------------------------------------------------------
-- 2. Table members_cards — Cartes de membres générées
-- --------------------------------------------------------------------------
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

-- Index pour trier les cartes les plus récentes en premier
create index if not exists idx_members_cards_created_at
  on public.members_cards (created_at desc);

-- --------------------------------------------------------------------------
-- 3. Sécurité RLS — Politiques d'accès (ANON) pour le panneau
--    Le panneau utilise la clé ANON publique : on autorise lecture/écriture
--    sur les deux tables. Le passkey applicatif reste la garde principale
--    (vérifié dans le code contre access_passkeys.is_active).
--    Adaptez ces politiques si vous activez Supabase Auth plus tard.
-- --------------------------------------------------------------------------
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

-- --------------------------------------------------------------------------
-- 4. Passkey de test par défaut (modifiez / désactivez après vos tests)
-- --------------------------------------------------------------------------
insert into public.access_passkeys (passkey_code, label, is_active)
values ('ECONEXUS-2026', 'Passkey de test initial', true)
on conflict (passkey_code) do update
  set label = excluded.label,
      is_active = true;

-- --------------------------------------------------------------------------
-- 5. Nom du propriétaire du passkey → pré-remplit Prénom/Nom à la connexion
-- --------------------------------------------------------------------------
-- update public.access_passkeys
-- set first_name = 'Amina', last_name = 'Benjeloun'
-- where passkey_code = 'ECONEXUS-2026';

-- --------------------------------------------------------------------------
-- 6. Vérification (optionnel) — décommentez pour contrôler après exécution
-- --------------------------------------------------------------------------
-- select * from public.access_passkeys;
-- select * from public.members_cards order by created_at desc;
