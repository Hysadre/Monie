-- V3.7 : nouvelle table investissements + budget prépa
create table if not exists investissements (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    nom text not null,
    type text default 'PEA',
    montant_investi numeric default 0,
    valeur_actuelle numeric default 0,
    date_ouverture date,
    note text,
    couleur text default '#7FB89E',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index if not exists idx_inv_user on investissements(user_id);

alter table investissements enable row level security;

drop policy if exists "Users can view own inv" on investissements;
create policy "Users can view own inv" on investissements for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own inv" on investissements;
create policy "Users can insert own inv" on investissements for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own inv" on investissements;
create policy "Users can update own inv" on investissements for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own inv" on investissements;
create policy "Users can delete own inv" on investissements for delete using (auth.uid() = user_id);

-- Table budget prépa (1 ligne par user)
create table if not exists budget_prep (
    user_id uuid references auth.users(id) on delete cascade primary key,
    revenu_mensuel numeric default 0,
    pct_charges int default 50,
    pct_plaisir int default 30,
    pct_epargne int default 20,
    updated_at timestamptz default now()
);

alter table budget_prep enable row level security;

drop policy if exists "Users can view own bp" on budget_prep;
create policy "Users can view own bp" on budget_prep for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own bp" on budget_prep;
create policy "Users can insert own bp" on budget_prep for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own bp" on budget_prep;
create policy "Users can update own bp" on budget_prep for update using (auth.uid() = user_id);
