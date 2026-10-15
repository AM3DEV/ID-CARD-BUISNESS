# Migrations Supabase — copier-coller dans le Dashboard

Ce dossier contient la migration SQL du projet.

## Option A — Copier-coller rapide (recommandé, sans CLI)

1. Ouvrez https://supabase.com/dashboard → votre projet.
2. Menu latéral : **SQL Editor** → **New query**.
3. Ouvrez le fichier `20261014000000_create_access_passkeys_and_members_cards.sql`
   (ou le fichier `schema.sql` à la racine — contenu identique).
4. Copiez **tout** le contenu, collez-le dans l'éditeur, cliquez **Run**.
5. Vérifiez dans **Table Editor** :
   - table `access_passkeys` (avec 1 ligne `ECONEXUS-2026`)
   - table `members_cards` (vide au départ)

## Option B — Supabase CLI

```bash
npm install -g supabase
supabase login
supabase link --project-ref VOTRE_PROJECT_REF
supabase db push
```

## Passkeys avec nom du propriétaire (pré-remplissage auto)

Exécutez `20261015000000_add_owner_name_to_access_passkeys.sql` (ajoute
`first_name` / `last_name` à `access_passkeys`), puis associez chaque passkey
à son détenteur — son Prénom et Nom se rempliront seuls dans l'éditeur :

```sql
insert into public.access_passkeys (passkey_code, label, first_name, last_name)
values ('ECONEXUS-2026', 'Passkey de test initial', 'Amina', 'Benjeloun')
on conflict (passkey_code) do update
  set label = excluded.label,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      is_active = true;

-- Autres membres du bureau :
insert into public.access_passkeys (passkey_code, label, first_name, last_name)
values
  ('BUREAU-2026-01', 'Présidence', 'Yasmine', 'El Fassi'),
  ('BUREAU-2026-02', 'Trésorerie', 'Omar', 'Chraibi');
```

## Passkeys supplémentaires (admin)

```sql
insert into public.access_passkeys (passkey_code, label)
values ('BUREAU-2026-ADMIN', 'Admin Bureau');

-- Désactiver un passkey :
update public.access_passkeys
set is_active = false
where passkey_code = 'BUREAU-2026-ADMIN';
```
