-- ═══════════════════════════════════════════════════════════════
-- V3.19 : Reclasser « Achats divers » de Vie quotidienne par marchand
-- (Fnac→Livres, AliExpress→Mode, Apple→Tech). Amazon reste (trop mélangé).
-- À lancer dans le SQL Editor de Supabase (après V3.18 idéalement).
--
-- APERÇU (facultatif) — voir combien de lignes concernées :
-- select
--   count(*) filter (where label ~* 'apple')                as apple,
--   count(*) filter (where label ~* 'fnac')                 as fnac,
--   count(*) filter (where label ~* 'aliexpress|alibaba')   as ali,
--   count(*) filter (where label ~* 'amazon')               as amazon_reste
-- from transactions where category = 'Vie quotidienne';
-- ═══════════════════════════════════════════════════════════════

-- 💻 Apple → Tech & Électronique
update transactions set category = 'Tech & Électronique', sub_category = null
  where category = 'Vie quotidienne' and label ~* 'apple';

-- 📚 Fnac → Livres
update transactions set category = 'Livres', sub_category = null
  where category = 'Vie quotidienne' and label ~* 'fnac';

-- 👗 AliExpress / Alibaba → Mode (cheveux / perruques / accessoires)
update transactions set category = 'Mode', sub_category = 'Cheveux / perruques'
  where category = 'Vie quotidienne' and label ~* 'aliexpress|alibaba';

-- ⚠️ Amazon reste en Vie quotidienne — trop varié pour deviner (élec, maison, parfois alimentation).

-- Vérif :
-- select category, count(*), round(sum(abs(amount))) from transactions
-- where category in ('Vie quotidienne','Tech & Électronique','Livres','Mode')
-- group by category order by category;
