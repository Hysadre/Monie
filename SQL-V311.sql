-- V3.11 : Photo de profil (upload dans Supabase Storage)

-- 1) Ajoute la colonne pour stocker l'URL de la photo
alter table profiles add column if not exists avatar_url text;

-- 2) Crée le bucket "avatars" (public en lecture pour affichage)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 3) Policies RLS sur le storage : chaque user gère uniquement son dossier
-- Chemin des fichiers : avatars/{user_id}/{filename}

drop policy if exists "Avatars sont publics en lecture" on storage.objects;
create policy "Avatars sont publics en lecture"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users uploadent leur propre avatar" on storage.objects;
create policy "Users uploadent leur propre avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users modifient leur propre avatar" on storage.objects;
create policy "Users modifient leur propre avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users suppriment leur propre avatar" on storage.objects;
create policy "Users suppriment leur propre avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
