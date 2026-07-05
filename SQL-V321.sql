-- ═══════════════════════════════════════════════════════════════
-- V3.21 : 3e niveau de catégorie sur les transactions
-- Ajoute la colonne « sub_sub_category » (sous-sous-catégorie).
-- Ex : Vie quotidienne → Hygiène & entretien → Produits ménagers.
-- À lancer dans le SQL Editor de Supabase. Sans risque (rien n'est supprimé).
-- ═══════════════════════════════════════════════════════════════

alter table public.transactions
  add column if not exists sub_sub_category text;

comment on column public.transactions.sub_sub_category is 'Sous-sous-catégorie (3e niveau) — ex: "Produits ménagers".';
