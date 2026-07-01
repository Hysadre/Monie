-- V3.8 : Objectifs d'épargne
create table if not exists epargne_objectifs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    nom text not null,
    emoji text default '🎯',
    couleur text default '#7FB89E',
    cible numeric not null,
    deja_epargne numeric default 0,
    date_debut date default current_date,
    date_cible date,
    statut text default 'en_cours' check (statut in ('en_cours', 'atteint', 'abandonne')),
    note text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index if not exists idx_ep_obj_user on epargne_objectifs(user_id);
create index if not exists idx_ep_obj_statut on epargne_objectifs(user_id, statut);

alter table epargne_objectifs enable row level security;

drop policy if exists "Users can view own goals" on epargne_objectifs;
create policy "Users can view own goals" on epargne_objectifs for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own goals" on epargne_objectifs;
create policy "Users can insert own goals" on epargne_objectifs for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own goals" on epargne_objectifs;
create policy "Users can update own goals" on epargne_objectifs for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own goals" on epargne_objectifs;
create policy "Users can delete own goals" on epargne_objectifs for delete using (auth.uid() = user_id);

-- Table optionnelle pour tracer chaque contribution (historique)
create table if not exists epargne_contributions (
    id uuid primary key default gen_random_uuid(),
    objectif_id uuid references epargne_objectifs(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    montant numeric not null,
    date_contrib date default current_date,
    note text,
    created_at timestamptz default now()
);

create index if not exists idx_ep_contrib_obj on epargne_contributions(objectif_id, date_contrib desc);
create index if not exists idx_ep_contrib_user on epargne_contributions(user_id);

alter table epargne_contributions enable row level security;

drop policy if exists "Users can view own contribs" on epargne_contributions;
create policy "Users can view own contribs" on epargne_contributions for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own contribs" on epargne_contributions;
create policy "Users can insert own contribs" on epargne_contributions for insert with check (auth.uid() = user_id);
drop policy if exists "Users can delete own contribs" on epargne_contributions;
create policy "Users can delete own contribs" on epargne_contributions for delete using (auth.uid() = user_id);

-- Trigger updated_at
create or replace function set_updated_at_ep_obj()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists ep_obj_updated on epargne_objectifs;
create trigger ep_obj_updated before update on epargne_objectifs
    for each row execute function set_updated_at_ep_obj();
