-- ============================================================
-- 🌸 MONIE V2 — Migration Supabase pour page "Suivi mensuel"
-- À exécuter dans le SQL Editor de ton projet Supabase
-- ============================================================

create table if not exists tracker_mensuel (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    month date not null,

    -- 💎 PATRIMOINE (snapshot fin de mois)
    lcl numeric default 0,
    bourso numeric default 0,
    especes numeric default 0,
    esalia numeric default 0,
    banque_postale numeric default 0,
    investissements numeric default 0,
    autre numeric default 0,

    -- 💰 REVENUS (auto-calculé depuis transactions OU saisi manuellement)
    salaire numeric default 0,
    tickets_resto numeric default 0,
    remboursements numeric default 0,
    autres_revenus numeric default 0,

    -- 🎯 ÉPARGNE
    epargne_cible numeric default 0,
    epargne_reel numeric default 0,

    -- Notes
    note text,
    updated_at timestamptz default now(),

    -- Contrainte : 1 ligne par (user, mois)
    unique(user_id, month)
);

-- Index pour les requêtes par utilisateur + tri par date
create index if not exists idx_tracker_user_month on tracker_mensuel(user_id, month);

-- Row Level Security : chaque user ne voit que sa propre data
alter table tracker_mensuel enable row level security;

drop policy if exists "Users can view their own tracker" on tracker_mensuel;
create policy "Users can view their own tracker"
    on tracker_mensuel for select
    using (auth.uid() = user_id);

drop policy if exists "Users can insert their own tracker" on tracker_mensuel;
create policy "Users can insert their own tracker"
    on tracker_mensuel for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can update their own tracker" on tracker_mensuel;
create policy "Users can update their own tracker"
    on tracker_mensuel for update
    using (auth.uid() = user_id);

drop policy if exists "Users can delete their own tracker" on tracker_mensuel;
create policy "Users can delete their own tracker"
    on tracker_mensuel for delete
    using (auth.uid() = user_id);

-- Trigger pour updated_at
create or replace function set_updated_at_tracker()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists tracker_updated on tracker_mensuel;
create trigger tracker_updated
    before update on tracker_mensuel
    for each row execute function set_updated_at_tracker();

-- ============================================================
-- TEST : vérifie que la table est bien créée
-- ============================================================
-- select count(*) from tracker_mensuel;
-- → devrait retourner 0
