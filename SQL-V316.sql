-- ═══════════════════════════════════════════════════════════════
-- V3.16 : Nouveau type de transaction « epargne »
-- L'épargne devient un 3e type (à côté de entree/sortie) : ni revenu, ni dépense.
-- À lancer dans le SQL Editor de Supabase.
-- ═══════════════════════════════════════════════════════════════

alter table transactions drop constraint if exists transactions_type_check;
alter table transactions add constraint transactions_type_check
  check (type in ('entree', 'sortie', 'epargne'));
