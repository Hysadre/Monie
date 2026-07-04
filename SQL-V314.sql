-- ═══════════════════════════════════════════════════════════════
-- V3.14 : Budget mensuel (un budget enregistré par mois)
-- Permet un historique de budgets mois par mois (revenu, répartition %,
-- répartition sous-catégories, dépenses à prévoir), avec copie du mois précédent.
-- L'ancienne table budget_prep sert désormais de "modèle par défaut".
-- ═══════════════════════════════════════════════════════════════

create table if not exists budget_mensuel (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    month date not null,                 -- 1er du mois (ex: 2026-07-01)
    revenu_mensuel numeric default 0,
    pct_charges int default 50,
    pct_plaisir int default 30,
    pct_epargne int default 20,
    sub_budget jsonb,                    -- répartition fine par sous-catégorie
    events jsonb,                        -- dépenses "à prévoir" du mois
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique(user_id, month)
);

create index if not exists idx_budget_mensuel_user on budget_mensuel(user_id, month);

alter table budget_mensuel enable row level security;
create policy "Users can view own budget"   on budget_mensuel for select using (auth.uid() = user_id);
create policy "Users can insert own budget" on budget_mensuel for insert with check (auth.uid() = user_id);
create policy "Users can update own budget" on budget_mensuel for update using (auth.uid() = user_id);
create policy "Users can delete own budget" on budget_mensuel for delete using (auth.uid() = user_id);
