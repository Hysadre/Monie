-- ═══════════════════════════════════════════════════════════════
-- V3.17 : Remboursements · Enveloppes (cagnottes) · Dettes
-- À lancer une fois dans le SQL Editor de Supabase.
-- ═══════════════════════════════════════════════════════════════

-- 1) REMBOURSEMENTS — « on me doit » / « je dois »
create table if not exists remboursements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  tiers text not null,                 -- ex: "Julien", "Maman"
  montant numeric not null,
  sens text not null default 'on_me_doit',  -- 'on_me_doit' | 'je_dois'
  motif text,
  statut text not null default 'en_attente', -- 'en_attente' | 'regle'
  date_creation date default current_date,
  created_at timestamptz default now()
);
alter table remboursements enable row level security;
drop policy if exists "own remboursements" on remboursements;
create policy "own remboursements" on remboursements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) ENVELOPPES / CAGNOTTES — provisions mensuelles (Noël, vacances, impôts…)
create table if not exists enveloppes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  nom text not null,
  emoji text default '📦',
  objectif numeric default 0,          -- montant visé (facultatif)
  mensuel numeric default 0,           -- ce que tu mets chaque mois
  actuel numeric default 0,            -- ce qu'il y a dans l'enveloppe
  created_at timestamptz default now()
);
alter table enveloppes enable row level security;
drop policy if exists "own enveloppes" on enveloppes;
create policy "own enveloppes" on enveloppes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3) DETTES / PAIEMENTS ÉCHELONNÉS
create table if not exists dettes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  nom text not null,                   -- ex: "Klarna canapé", "Prêt étudiant"
  montant_total numeric not null,
  mensualite numeric default 0,
  deja_paye numeric default 0,
  created_at timestamptz default now()
);
alter table dettes enable row level security;
drop policy if exists "own dettes" on dettes;
create policy "own dettes" on dettes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
