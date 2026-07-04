-- ═══════════════════════════════════════════════════════════════
-- 🌸 MONIE V3 — SQL à exécuter sur Supabase
-- Copie-colle TOUT ce fichier dans SQL Editor, clique "Run"
-- ═══════════════════════════════════════════════════════════════

-- ─── TABLE : transactions ──────────────────────────────────────
create table if not exists transactions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    date_op date not null,
    label text not null,
    amount numeric not null,
    type text check (type in ('entree', 'sortie')) not null,
    category text,
    sub_category text,
    account text default 'Compte courant',
    source text default 'manual' check (source in ('manual', 'import_csv', 'import_pdf', 'legacy_json')),
    merchant_key text,
    comment text,
    merged_from uuid,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index if not exists idx_tx_user_date on transactions(user_id, date_op desc);
create index if not exists idx_tx_amount on transactions(user_id, amount);
create index if not exists idx_tx_merchant on transactions(user_id, merchant_key);

alter table transactions enable row level security;

drop policy if exists "Users can view own transactions" on transactions;
create policy "Users can view own transactions"
    on transactions for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own transactions" on transactions;
create policy "Users can insert own transactions"
    on transactions for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own transactions" on transactions;
create policy "Users can update own transactions"
    on transactions for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own transactions" on transactions;
create policy "Users can delete own transactions"
    on transactions for delete using (auth.uid() = user_id);

-- ─── TABLE : merchant_rules ────────────────────────────────────
create table if not exists merchant_rules (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    pattern text not null,
    category text not null,
    sub_category text,
    priority int default 0,
    is_generic boolean default false,
    created_at timestamptz default now()
);

create index if not exists idx_rules_user on merchant_rules(user_id);
create index if not exists idx_rules_pattern on merchant_rules(pattern);

alter table merchant_rules enable row level security;

drop policy if exists "Users can view own rules or public" on merchant_rules;
create policy "Users can view own rules or public"
    on merchant_rules for select using (auth.uid() = user_id or user_id is null);
drop policy if exists "Users can insert own rules" on merchant_rules;
create policy "Users can insert own rules"
    on merchant_rules for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own rules" on merchant_rules;
create policy "Users can update own rules"
    on merchant_rules for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own rules" on merchant_rules;
create policy "Users can delete own rules"
    on merchant_rules for delete using (auth.uid() = user_id);

-- ─── TRIGGER updated_at ────────────────────────────────────────
create or replace function set_updated_at_v3()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists tx_updated on transactions;
create trigger tx_updated before update on transactions
    for each row execute function set_updated_at_v3();

-- ─── SEED : règles marchandes par défaut (globales) ────────────
insert into merchant_rules (pattern, category, sub_category, is_generic, priority) values
    ('bespoke', 'Salaire', null, false, 100),
    ('lapeyre', 'Salaire', null, false, 100),
    ('france travail', 'Salaire', null, false, 100),
    ('action logement', 'Salaire', null, false, 100),
    ('studapart', 'Salaire', null, false, 100),
    ('employeur', 'Salaire', null, false, 90),
    ('swile', 'Tickets restaurant', null, false, 100),
    ('edenred', 'Tickets restaurant', null, false, 100),
    ('sodexo', 'Tickets restaurant', null, false, 100),
    ('pluxee', 'Tickets restaurant', null, false, 100),
    ('julien pety', 'Loyer', 'Loyer mensuel', false, 100),
    ('rob net cite u', 'Loyer', 'Loyer mensuel', false, 100),
    ('nexity', 'Loyer', 'Loyer mensuel', false, 100),
    ('loyer', 'Loyer', 'Loyer mensuel', false, 80),
    ('bailleur', 'Loyer', 'Loyer mensuel', false, 80),
    ('carrefour', 'Alimentation', 'Courses', false, 90),
    ('monoprix', 'Alimentation', 'Courses', false, 90),
    ('lidl', 'Alimentation', 'Courses', false, 90),
    ('franprix', 'Alimentation', 'Courses', false, 90),
    ('auchan', 'Alimentation', 'Courses', false, 90),
    ('picard', 'Alimentation', 'Courses', false, 90),
    ('leclerc', 'Alimentation', 'Courses', false, 90),
    ('distrifives', 'Alimentation', 'Courses', false, 90),
    ('inamori', 'Alimentation', 'Courses', false, 90),
    ('legrand primeur', 'Alimentation', 'Courses', false, 90),
    ('naturalia', 'Alimentation', 'Courses', false, 90),
    ('boulangerie', 'Alimentation', 'Boulangerie', false, 80),
    ('mcdonald', 'Alimentation', 'Restaurants', false, 90),
    ('mcdo', 'Alimentation', 'Restaurants', false, 90),
    ('sushi', 'Alimentation', 'Restaurants', false, 80),
    ('starbucks', 'Alimentation', 'Restaurants', false, 90),
    ('otacos', 'Alimentation', 'Restaurants', false, 90),
    ('burger', 'Alimentation', 'Restaurants', false, 80),
    ('pret a manger', 'Alimentation', 'Restaurants', false, 90),
    ('kebab', 'Alimentation', 'Restaurants', false, 80),
    ('uber eats', 'Alimentation', 'Restaurants', false, 100),
    ('chicken', 'Alimentation', 'Restaurants', false, 70),
    ('uber', 'Transport', 'Taxi / VTC', false, 90),
    ('bolt', 'Transport', 'Taxi / VTC', false, 90),
    ('heetch', 'Transport', 'Taxi / VTC', false, 90),
    ('sncf', 'Transport', 'Train', false, 90),
    ('navigo', 'Transport', 'Transport commun', false, 100),
    ('ratp', 'Transport', 'Transport commun', false, 100),
    ('ilevia', 'Transport', 'Transport commun', false, 100),
    ('total ', 'Transport', 'Essence', false, 80),
    ('bp station', 'Transport', 'Essence', false, 90),
    ('blablacar', 'Transport', 'Voyages', false, 90),
    ('flixbus', 'Transport', 'Voyages', false, 90),
    ('idtgv', 'Transport', 'Train', false, 100),
    ('max jeune', 'Transport', 'Train', false, 90),
    ('zara', 'Mode', 'Vêtements', false, 90),
    ('h&m', 'Mode', 'Vêtements', false, 90),
    ('asos', 'Mode', 'Vêtements', false, 90),
    ('shein', 'Mode', 'Vêtements', false, 100),
    ('uniqlo', 'Mode', 'Vêtements', false, 90),
    ('celio', 'Mode', 'Vêtements', false, 90),
    ('madame v', 'Mode', 'Vêtements', false, 100),
    ('galeries lafayette', 'Mode', 'Vêtements', false, 90),
    ('sephora', 'Cosmétique', 'Beauté', false, 100),
    ('yves rocher', 'Cosmétique', 'Beauté', false, 100),
    ('nocibe', 'Cosmétique', 'Beauté', false, 100),
    ('kiko', 'Cosmétique', 'Maquillage', false, 100),
    ('curly me', 'Cosmétique', 'Cheveux', false, 100),
    ('curlyme', 'Cosmétique', 'Cheveux', false, 100),
    ('afro beauty', 'Cosmétique', 'Cheveux', false, 100),
    ('magic afro', 'Cosmétique', 'Cheveux', false, 100),
    ('iherb', 'Cosmétique', 'Soins', false, 90),
    ('notino', 'Cosmétique', 'Parfums', false, 100),
    ('rituals', 'Cosmétique', 'Soins', false, 90),
    ('pharmacie', 'Santé', 'Pharmacie', false, 80),
    ('optique', 'Santé', 'Optique', false, 90),
    ('doctolib', 'Santé', 'Médecin', false, 90),
    ('claeys', 'Santé', 'Pharmacie', false, 80),
    ('ikea', 'Maison & Logement', 'Mobilier', false, 100),
    ('castorama', 'Maison & Logement', 'Bricolage', false, 100),
    ('leroy merlin', 'Maison & Logement', 'Bricolage', false, 100),
    ('maisons du monde', 'Maison & Logement', 'Mobilier', false, 100),
    ('edf', 'Maison & Logement', 'Factures', false, 100),
    ('engie', 'Maison & Logement', 'Factures', false, 100),
    ('amazon prime', 'Abonnements', 'Streaming', false, 100),
    ('netflix', 'Abonnements', 'Streaming', false, 100),
    ('spotify', 'Abonnements', 'Streaming', false, 100),
    ('canal+', 'Abonnements', 'Streaming', false, 100),
    ('disney+', 'Abonnements', 'Streaming', false, 100),
    ('deezer', 'Abonnements', 'Streaming', false, 100),
    ('anthropic', 'Abonnements', 'IA', false, 100),
    ('claude.ai', 'Abonnements', 'IA', false, 100),
    ('openai', 'Abonnements', 'IA', false, 100),
    ('chatgpt', 'Abonnements', 'IA', false, 100),
    ('whisperai', 'Abonnements', 'IA', false, 100),
    ('free mobile', 'Abonnements', 'Téléphone', false, 100),
    ('orange mobile', 'Abonnements', 'Téléphone', false, 100),
    ('sfr', 'Abonnements', 'Téléphone', false, 90),
    ('basic fit', 'Abonnements', 'Sport', false, 100),
    ('basic-fit', 'Abonnements', 'Sport', false, 100),
    ('apple.com', 'Abonnements', 'Apple', false, 90),
    ('amazon', 'Vie quotidienne', 'Achats divers', false, 60),
    ('fnac', 'Vie quotidienne', 'Tech', false, 80),
    ('apple store', 'Vie quotidienne', 'Tech', false, 90),
    ('boulanger', 'Vie quotidienne', 'Tech', false, 80),
    ('darty', 'Vie quotidienne', 'Tech', false, 90),
    ('ugc', 'Vie quotidienne', 'Sorties', false, 90),
    ('pathe', 'Vie quotidienne', 'Sorties', false, 90),
    ('cinema', 'Vie quotidienne', 'Sorties', false, 80),
    ('lefarafina', 'Vie quotidienne', 'Sorties', false, 100),
    ('cofidis', 'Banque', 'Crédit conso', false, 100),
    ('klarna', 'Banque', 'Paiement échelonné', false, 100),
    ('cotisation', 'Banque', 'Frais', false, 70),
    ('commission rejet', 'Banque', 'Incidents', false, 90),
    ('urssaf', 'Impôts', 'URSSAF', false, 100),
    ('dgfip', 'Impôts', 'Impôt revenu', false, 100),
    ('trading 212', 'Investissements', 'Trading', false, 100),
    ('eglise', 'Dîme', 'Mensuelle', false, 100),
    ('protestante', 'Dîme', 'Mensuelle', false, 90),
    ('orange money', 'Dons', 'Famille', false, 100),
    ('wero', 'Remboursements', 'Ami', false, 90),
    ('lydia', 'Remboursements', 'Ami', false, 90),
    ('paylib', 'Remboursements', 'Ami', false, 90),
    ('prlv sepa', 'Transactions', 'Prélèvement', true, 10),
    ('vir sepa', 'Transactions', 'Virement', true, 10),
    ('vir inst', 'Transactions', 'Virement', true, 10),
    ('virement', 'Transactions', 'Virement', true, 10),
    ('retrait', 'Transactions', 'Retrait', true, 20),
    ('versement', 'Transactions', 'Versement', true, 20),
    ('prelevement', 'Transactions', 'Prélèvement', true, 10)
on conflict do nothing;
