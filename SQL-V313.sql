-- ═══════════════════════════════════════════════════════════════
-- V3.13 : Comptes d'épargne distincts dans le suivi mensuel
-- Ajoute Livret A, LDDS et Assurance vie (à distinguer des comptes courants).
-- Épargne = livret_a + ldds + assurance_vie + esalia + investissements
-- ═══════════════════════════════════════════════════════════════

alter table tracker_mensuel add column if not exists livret_a numeric;
alter table tracker_mensuel add column if not exists ldds numeric;
alter table tracker_mensuel add column if not exists assurance_vie numeric;
