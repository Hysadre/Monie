-- ═══════════════════════════════════════════════════════════════
-- V3.12 : Table tracker_mensuel (suivi patrimoine mois par mois)
-- Utilisée par la page "Suivi mensuel" (app.js : loadSuivi / saveSuivi).
-- Manquait dans les scripts précédents → à exécuter avant utilisation.
-- ═══════════════════════════════════════════════════════════════

create table if not exists tracker_mensuel (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    month date not null,                 -- 1er du mois (ex: 2026-05-01)
    -- Patrimoine (saisi manuellement)
    lcl numeric,
    bourso numeric,
    especes numeric,
    esalia numeric,
    banque_postale numeric,
    investissements numeric,
    autre numeric,
    -- Revenus (override manuel si non calculé auto depuis transactions)
    salaire numeric,
    tickets_resto numeric,
    remboursements numeric,
    autres_revenus numeric,
    -- Épargne
    epargne_cible numeric,
    epargne_reel numeric,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique(user_id, month)
);

create index if not exists idx_tracker_user_month on tracker_mensuel(user_id, month);

-- RLS : chaque utilisateur ne voit et ne modifie que ses propres lignes
alter table tracker_mensuel enable row level security;

create policy "Users can view own tracker"   on tracker_mensuel for select using (auth.uid() = user_id);
create policy "Users can insert own tracker" on tracker_mensuel for insert with check (auth.uid() = user_id);
create policy "Users can update own tracker" on tracker_mensuel for update using (auth.uid() = user_id);
create policy "Users can delete own tracker" on tracker_mensuel for delete using (auth.uid() = user_id);
