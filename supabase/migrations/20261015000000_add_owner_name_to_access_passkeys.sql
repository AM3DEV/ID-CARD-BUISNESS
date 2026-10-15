-- Migration: add owner first_name / last_name to access_passkeys
-- Supabase CLI migration — appliquée via `supabase db push`
-- Pour une base existante (Dashboard → SQL Editor), copiez-collez ce fichier.
-- Ces colonnes permettent de pré-remplir automatiquement le Prénom et le Nom
-- de l'éditeur lorsqu'un membre se connecte avec son passkey.

alter table public.access_passkeys
  add column if not exists first_name text,
  add column if not exists last_name text;

-- Exemple : associer un nom au passkey de test
-- update public.access_passkeys
-- set first_name = 'Amina', last_name = 'Benjeloun'
-- where passkey_code = 'ECONEXUS-2026';
