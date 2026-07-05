-- ═══════════════════════════════════════════════════════════════
-- V3.18 : Nettoyage de « Vie quotidienne » (fourre-tout)
-- On ressort ce qui n'a rien à voir avec l'hygiène/la maison.
-- À lancer dans le SQL Editor de Supabase.
--
-- APERÇU d'abord (facultatif) — voir ce qui va bouger :
-- select sub_category, count(*), round(sum(abs(amount))) as total
-- from transactions where category = 'Vie quotidienne'
-- group by sub_category order by total desc;
-- ═══════════════════════════════════════════════════════════════

-- 🎬 Sorties & Jeux → Divertissement (on garde la sous-catégorie)
update transactions set category = 'Divertissement'
  where category = 'Vie quotidienne' and sub_category in ('Sorties', 'Jeux');

-- ✈️ Voyages → Voyages
update transactions set category = 'Voyages', sub_category = null
  where category = 'Vie quotidienne' and sub_category = 'Voyages';

-- 💄 Beauté → Cosmétique
update transactions set category = 'Cosmétique', sub_category = null
  where category = 'Vie quotidienne' and sub_category = 'Beauté';

-- 👗 Mode / Vêtements → Mode
update transactions set category = 'Mode', sub_category = null
  where category = 'Vie quotidienne' and sub_category = 'Mode / Vêtements';

-- 💻 Tech & Électronique → sa propre catégorie
update transactions set category = 'Tech & Électronique', sub_category = null
  where category = 'Vie quotidienne' and sub_category = 'Tech & Électronique';

-- ⚠️ « Achats divers » (Amazon / Apple / Fnac / AliExpress…) reste en Vie quotidienne :
--    impossible de deviner automatiquement (une commande Amazon peut être n'importe quoi).
--    → utilise la « file à catégoriser » ou re-classe à la main quand tu veux.

-- Vérif après coup :
-- select category, count(*), round(sum(abs(amount))) from transactions
-- where category in ('Vie quotidienne','Tech & Électronique','Divertissement','Cosmétique','Mode','Voyages')
-- group by category order by category;
