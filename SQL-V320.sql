-- ═══════════════════════════════════════════════════════════════
-- V3.20 : Liste de courses (📸 import photo → produits) + historique de prix
-- À lancer dans le SQL Editor de Supabase.
--
-- Chaque ligne = 1 produit (avec prix, marque, et 3 niveaux de catégorie).
-- Sert à : réutiliser une liste le mois suivant, cocher au fur et à mesure,
-- et comparer les prix par marque dans le temps (focus marque).
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.courses (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  created_at        timestamptz not null default now(),
  label             text not null,              -- ex: "Lessive Ariel 2L"
  brand             text,                        -- ex: "Ariel" (rempli à la main si tu veux comparer)
  category          text,                        -- ex: "Vie quotidienne"
  sub_category      text,                        -- ex: "Hygiène & entretien"
  sub_sub_category  text,                        -- ex: "Produits ménagers"
  price             numeric,                     -- prix unitaire constaté (€)
  qty               numeric default 1,
  checked           boolean default false,       -- coché = déjà acheté / dans le panier
  list_key          text,                        -- regroupement d'une liste (ex: "2026-07" ou "Ménage")
  source            text default 'photo'         -- 'photo' | 'manuel'
);

comment on table public.courses is 'Listes de courses Monie — produits scannés/saisis, avec prix par marque pour comparaison.';

-- Index pour retrouver vite une liste et l''historique d''un produit
create index if not exists courses_user_list_idx on public.courses (user_id, list_key);
create index if not exists courses_user_label_idx on public.courses (user_id, label);

-- 🔒 RLS : chaque utilisatrice ne voit que ses propres lignes
alter table public.courses enable row level security;
drop policy if exists "courses_own" on public.courses;
create policy "courses_own" on public.courses
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
