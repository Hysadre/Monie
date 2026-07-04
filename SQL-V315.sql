-- ═══════════════════════════════════════════════════════════════
-- V3.15 : Moyens de paiement AVANT juin 2026 → carte (sauf tickets resto)
-- À lancer dans le SQL Editor de Supabase.
-- Les tickets resto (Swile, Edenred, Bimpli, Sodexo…) restent en ticket_resto.
-- ═══════════════════════════════════════════════════════════════

-- 1) APERÇU (facultatif) — lance D'ABORD juste cette requête pour voir combien de tx sont concernées :
-- select
--   count(*) filter (where label !~* 'swile|edenred|bimpli|ticket rest|titre.?resto|resto flash|sodexo|pluxee') as vont_en_carte,
--   count(*) filter (where label ~*  'swile|edenred|bimpli|ticket rest|titre.?resto|resto flash|sodexo|pluxee') as restent_ticket_resto
-- from transactions where date_op < '2026-06-01';

-- 2) APPLICATION
-- Tickets resto avant juin → ticket_resto
update transactions
set payment_method = 'ticket_resto'
where date_op < '2026-06-01'
  and label ~* 'swile|edenred|bimpli|ticket rest|titre.?resto|resto flash|sodexo|pluxee';

-- Tout le reste avant juin → carte
update transactions
set payment_method = 'carte'
where date_op < '2026-06-01'
  and label !~* 'swile|edenred|bimpli|ticket rest|titre.?resto|resto flash|sodexo|pluxee';
