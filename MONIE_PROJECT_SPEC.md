# 🌸 MONIE — Specification technique complète

**Version** : V3.14
**Type** : Web app de gestion budgétaire personnelle
**Cible** : Utilisatrice unique au départ, extensible multi-utilisateurs

---

## 1. 🎯 Vue d'ensemble

Monie est une application web mono-page (SPA) permettant à un utilisateur de :

- Suivre son budget mensuel et annuel via un calendrier, dashboard et vue annuelle
- Importer ses relevés bancaires (CSV, PDF, JSON) et les catégoriser
- Définir des objectifs d'épargne et suivre leurs contributions
- Gérer un portefeuille d'investissements
- Préparer un budget avec répartition Charges / Plaisir / Épargne
- Personnaliser son profil (pseudo, avatar photo, 5 thèmes graphiques)

Aucun serveur applicatif : tout est en frontend statique + backend Supabase (BaaS).

---

## 2. 🛠 Stack technique

| Couche | Techno |
|---|---|
| Frontend | HTML / CSS / JavaScript vanilla (pas de framework) |
| Backend | Supabase (Auth + PostgreSQL + Storage) |
| Hébergement front | GitHub Pages |
| Auth | Supabase Auth (email/password + magic link) |
| Graphiques | Chart.js 4.4.1 (CDN) |
| PDF parser | pdf.js 3.11.174 (CDN, Mozilla) |
| Client Supabase | @supabase/supabase-js v2 (CDN) |
| Icônes | Emojis Unicode uniquement |
| Fonts | Google Fonts — Nunito (500-900), Poppins, Inter |

**Pas de bundler, pas de build step.** Tout est chargé directement en `<script>`.

---

## 3. 📁 Structure des fichiers

```
monie/
├── index.html              # SPA complète (~1000 lignes)
├── app.js                  # Toute la logique (~3000 lignes)
├── style.css               # Design system + composants (~2500 lignes)
├── favicon.svg             # Logo (SVG rose framboise avec M blanc)
├── apple-touch-icon.png    # 180×180 iOS home
├── icon-152.png            # 152×152 iPad
├── icon-167.png            # 167×167 iPad Pro
├── icon-192.png            # 192×192 Android/PWA
├── icon-512.png            # 512×512 Android/PWA splash
├── manifest.json           # PWA manifest (Add to Home Screen)
└── SQL-V*.sql              # Scripts SQL de migration (versionnés)
```

---

## 4. 🗄 Schéma base de données (Supabase / PostgreSQL)

### Table `transactions` *(cœur du système)*
```sql
create table transactions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    date_op date not null,
    label text not null,
    amount numeric not null,           -- toujours positif; le signe vient du champ type
    type text check (type in ('entree', 'sortie')) not null,
    category text,
    sub_category text,
    account text default 'Compte courant',
    source text default 'manual' check (source in ('manual','import_csv','import_pdf','legacy_json')),
    merchant_key text,                 -- clé nettoyée du marchand (pour dédup)
    comment text,                      -- note libre
    merged_from uuid,                  -- pour tracer les fusions
    payment_method text check (payment_method in ('carte','especes','cheque','prelevement','virement','ticket_resto','autre')),
    bank_source text,                  -- 'LCL' ou 'BoursoBank' ou autre
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
create index idx_tx_user_date on transactions(user_id, date_op desc);
create index idx_tx_amount on transactions(user_id, amount);
create index idx_tx_merchant on transactions(user_id, merchant_key);
```

### Table `merchant_rules` *(règles de catégorisation apprises)*
```sql
create table merchant_rules (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    pattern text not null,              -- pattern lower-cased cherché dans le label
    category text not null,
    sub_category text,
    priority int default 0,             -- plus haut = plus prioritaire
    is_generic boolean default false,   -- règle générique (fallback bas)
    created_at timestamptz default now()
);
```

### Table `tracker_mensuel` *(suivi patrimoine mois par mois)*
```sql
create table tracker_mensuel (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    month date not null,                -- 1er du mois
    lcl numeric,
    bourso numeric,
    especes numeric,
    esalia numeric,
    banque_postale numeric,
    investissements numeric,
    autre numeric,
    salaire numeric,
    tickets_resto numeric,
    remboursements numeric,
    autres_revenus numeric,
    epargne_cible numeric,
    epargne_reel numeric,
    unique(user_id, month)
);
```

### Table `epargne_objectifs` *(objectifs d'épargne)*
```sql
create table epargne_objectifs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    nom text not null,
    emoji text default '🎯',
    couleur text default '#7FB89E',
    cible numeric not null,
    deja_epargne numeric default 0,
    date_debut date default current_date,
    date_cible date,
    statut text default 'en_cours' check (statut in ('en_cours','atteint','abandonne')),
    note text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
```

### Table `epargne_contributions`
```sql
create table epargne_contributions (
    id uuid primary key default gen_random_uuid(),
    objectif_id uuid references epargne_objectifs(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    montant numeric not null,
    date_contrib date default current_date,
    note text
);
```

### Table `investissements`
```sql
create table investissements (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    nom text not null,
    type text default 'PEA',
    montant_investi numeric default 0,
    valeur_actuelle numeric default 0,
    date_ouverture date,
    note text,
    couleur text default '#7FB89E'
);
```

### Table `budget_prep`
```sql
create table budget_prep (
    user_id uuid references auth.users(id) on delete cascade primary key,
    revenu_mensuel numeric default 0,
    pct_charges int default 50,
    pct_plaisir int default 30,
    pct_epargne int default 20
);
```

### Table `profiles`
```sql
create table profiles (
    user_id uuid references auth.users(id) on delete cascade primary key,
    display_name text,
    avatar_emoji text default '🌸',
    avatar_url text,                    -- URL Supabase Storage
    theme text default 'rose' check (theme in ('rose','ocean','foret','nuit','sobre')),
    show_emojis boolean default true
);
```

### Bucket Storage : `avatars`
```sql
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
```
Chemin des fichiers : `avatars/{user_id}/avatar-{timestamp}.jpg`

### RLS (Row Level Security) — appliqué à TOUTES les tables
```sql
-- Pattern répété sur chaque table
alter table X enable row level security;
create policy "own read"   on X for select using (auth.uid() = user_id);
create policy "own insert" on X for insert with check (auth.uid() = user_id);
create policy "own update" on X for update using (auth.uid() = user_id);
create policy "own delete" on X for delete using (auth.uid() = user_id);
```

---

## 5. 🗂 Taxonomie des catégories

### 25 catégories top-level
| Emoji | Nom | Type |
|---|---|---|
| 💰 | Salaire | Revenu |
| 🎟️ | Tickets restaurant | Revenu |
| ↩️ | Remboursements | Revenu |
| 🏘️ | Aide au logement | Revenu |
| 🏠 | Loyer | Dépense |
| 🛒 | Alimentation | Dépense |
| 🚗 | Transport | Dépense |
| ✈️ | Voyages | Dépense |
| 🏡 | Maison & Logement | Dépense |
| 💄 | Cosmétique | Dépense |
| 👗 | Mode | Dépense |
| 💊 | Santé | Dépense |
| 🎓 | Éducation | Dépense |
| 📋 | Administratif | Dépense |
| 🛍️ | Vie quotidienne | Dépense |
| 📱 | Abonnements | Dépense |
| 🎬 | Divertissement | Dépense |
| ⛪ | Dîme | Épargne |
| 💝 | Dons | Épargne |
| 💌 | Amis & Famille | Dépense |
| 📈 | Investissements | Épargne |
| 🏦 | Banque | Dépense |
| 🧾 | Impôts | Dépense |
| 🔄 | Transactions | Transfert |
| 📌 | Autres | — |

### Sous-catégories (hiérarchie)
Chaque catégorie a ses sous-cat. Exemples :
- Alimentation → Courses / Restaurants & sorties / Livraison / Boulangerie / Cantine
- Transport → Transports en commun / Taxi / VTC / Voiture / Voyages
- Banque → Frais / Cotisation carte / Crédit conso / Assurance / Paiement échelonné
- Amis & Famille → Amis / Famille
- Santé → Pharmacie / Médecin / Mutuelle / Optique / Assurance-vie
- Etc.

Voir table `⚙️ Paramètres` de l'Excel source pour la liste complète.

---

## 6. 🎨 Design system

### Palette par défaut (thème "rose")
```css
--bg: #FDFAF8;              /* Fond global rose crème */
--card: #FFFFFF;
--rose: #E76F51;            /* Accent principal (rose framboise) */
--tender-rose: #DD7B85;     /* Accent secondaire */
--sage: #7FB89E;            /* Vert sauge (positif) */
--peach: #F4A993;
--plum: #7C3F58;
--gold: #E8B84D;
--ink: #1B2340;             /* Texte principal */
--muted: #718096;
```

### 4 autres thèmes disponibles
- **Océan** : bleu marine + turquoise
- **Forêt** : vert olive + terre
- **Nuit** : mode sombre violet (data-theme="nuit")
- **Sobre** : anthracite + gris neutre

Chaque thème redéfinit `--rose`, `--sage`, `--bg`, `--card` etc. via `[data-theme="X"]`.

### Typography
- **Font principale** : Nunito 400-900 (arrondie, chaleureuse)
- **Font mono/nombres** : Nunito ou Inter selon contexte
- **Hauteur ligne** : 1.5
- **Tailles** : 10px pour hints, 13-14px body, 16-24px titles

### Radius
- `--radius: 16px` (cartes)
- `--radius-sm: 10px` (inputs, boutons)
- `--radius-xs: 6px` (badges)

### Ombres
```css
--shadow-sm: 0 1px 3px rgba(45,55,72,0.04);
--shadow: 0 4px 12px rgba(231,111,81,0.06), 0 2px 4px rgba(45,55,72,0.04);
--shadow-lg: 0 12px 32px rgba(231,111,81,0.10);
```

---

## 7. 📱 Structure des pages

### Menu latéral (desktop) / Bottom-nav (mobile)
- Calendrier
- Dashboard *(qui regroupe Global / Mensuel / Annuel via CTAs)*
- Transactions
- Import
- Épargne
- Investissements
- ⚙ Profil *(accessible via user-pill sidebar)*

### Page 1 : 📅 Calendrier
- Sélecteur Mois / Année + flèches ‹ ›
- Vue Mensuelle (grille jours), option 🌍 Global
- KPIs mois : Revenus / Dépenses / Solde
- Clic sur un jour → panneau détail à droite avec tx du jour + formulaire ajout rapide
- Formulaire rapide 5 étapes (Type / Paiement / Montant / Libellé / Catégorie)

### Page 2 : 📊 Dashboard
Contient 3 CTAs en haut : `🌍 Global` `📊 Mensuel` `📅 Annuel`
- **Global** : 4 KPIs mois + 4 KPIs année, courbe 12 mois figée sur l'année, donut cat, top dépenses
- Sélecteur mois/année avec option 🌍 Global (affiche cumul de toutes tx)
- 2 cartes perf vs M-1 : gestion globale + épargne
- Widget "Prochain objectif d'épargne"

### Page 3 : 💸 Transactions
- Filtres : recherche + catégorie + année + mois + date exacte + reset
- Bouton **📥 Exporter** CSV (respecte les filtres)
- Liste avec checkbox de sélection, sélecteur catégorie inline, croix supprimer
- Bulk bar flottante quand sélection : Appliquer catégorie / Supprimer / Annuler
- Pastilles LCL (bleu) / BoursoBank (rose) sur chaque libellé
- Affiche sous-catégorie sous le libellé

### Page 4 : 📥 Import
- Drop zone drag & drop (CSV, PDF, JSON)
- 3 onglets sur la preview : "À vérifier" (Autres) / "Catégorisées" / "Auto"
- Filtres : année / mois / catégorie
- Bulk actions (sélection + appliquer cat / supprimer)
- Détection duplicates (match date + montant + label ~40 premiers chars)
- Note éditable sur les transactions catégorisées "Autres"
- Auto-apprentissage : catégoriser crée une règle marchande perso
- Boutons "Valider" et "Annuler" en haut ET en bas de la preview

### Page 5 : 📊 Suivi mensuel (accessible via Dashboard > Mensuel)
Grand tableau mois × colonnes :
- **💎 PATRIMOINE** (rose) : LCL / Bourso / Espèces / Esalia / B.Postale / Invest. / Autre / **Total**
- **💰 REVENUS** (vert) : Salaire / Tickets / Rembours. / Autres / **Total**
- **🧾 TOTAL** : Patrimoine + Revenus
- **📈 ÉVOLUTION vs N-1** : Valeur (€) + %

Revenus calculés auto depuis transactions, patrimoine saisi manuellement, résiste aux imports.
Sticky first column, scroll horizontal indiqué par gradients aux bords.

### Page 6 : 📅 Vue annuelle
Tableau catégorie × 12 mois × Total année.
- Revenus (vert) : sub-list REV_CATS
- Dépenses (rose) : sub-list EXP_CATS
- Total revenus / dépenses / solde en bas
- Sélecteur année incluant option 🌍 Global (agrège 2020-2026)

### Page 7 : 🎯 Prépa Budget
- Saisie salaire net mensuel
- 3 inputs % : Charges / Plaisir / Épargne (doit totaliser 100%)
- **Blocage rouge** si total ≠ 100% : masque les sous-cat et affiche warning
- Sous-catégories éditables par bloc (input % pour chaque)
- Ligne "Total du bloc" par section
- **Ligne TOTAL GÉNÉRAL** grand format dégradé rose/pêche
- Sauvegarde localStorage

### Page 8 : 🎯 Épargne
- KPIs : épargne du mois / cible totale / reste / taux
- Liste objectifs "en cours" avec barre de progression
- Sections repliables : "Atteints" / "Abandonnés"
- Modal création/édition objectif : nom, cible, deja épargné, date début/cible, note
- Modal contribution : montant + date + note (met à jour deja_epargne)

### Page 9 : 📈 Investissements
- KPIs : total investi / valeur actuelle / performance %
- Liste cartes investissement avec barre couleur perso
- Modal ajout/édition : nom, type (PEA/PEE/Livret A/etc.), montant investi, valeur actuelle, date ouverture

### Page 10 : ⚙ Profil (Réglages)
Accessible via la user-pill (sidebar) ou greeting mobile (header).
- Photo perso : upload avec redimensionnement canvas côté client (400×400 max, JPEG 85%)
- Emoji avatar (16 choix)
- Toggle "afficher les emojis"
- Section Sécurité : changer email / mot de passe (via sb.auth.updateUser)
- Section Apparence : 5 palettes cliquables
- Section Zone sensible : supprimer le compte (efface toutes les tables user)

---

## 8. 🔐 Authentification & sécurité

- Supabase Auth avec email/password
- RLS activée sur toutes les tables → chaque user isolé
- Storage bucket public en lecture (pour affichage avatars) mais insert/update/delete filtrés par folder = auth.uid()
- Pas de secrets côté client autres que l'anon key Supabase
- Token JWT géré automatiquement par supabase-js

---

## 9. 📥 Import bancaire

### Formats supportés
- **CSV** : détection auto délimiteur (virgule / point-virgule / tab)
- **PDF** : parsing via pdf.js, extraction par ligne (regex date + montant)
- **JSON** : format Monie v2 avec catégories déjà calculées

### Pipeline d'import
1. Parse le fichier → array de {date, label, amount, type}
2. Pour chaque tx : `merchant_key = clean(label)` (retire préfixes CARTE/VIR SEPA, dates)
3. Appliquer les règles catégorisation :
   - Overrides conversation (priorité max)
   - Règles user (par ordre de priorité + longueur pattern)
   - Excel legacy (si tx importée depuis fichier v2)
   - Fallback "Autres"
4. Détecter doublons vs DB (même date + même montant abs + merchant_key match)
5. Preview 3 onglets : à vérifier (Autres) / catégorisées / auto
6. User peut recatégoriser en masse (crée règle perso)
7. Confirm → insert batch de 200 en DB

### Auto-détection bank_source
- Format "CB MERCHANT dd/mm/yy" → BoursoBank
- Format "CARTEdd/mm/yy...CB*XXXX" → LCL
- Format "PRLV SEPA" / "VIR SEPA" / "VIREMENT " → LCL
- Sinon null

### Auto-détection payment_method
- Commence par CARTE ou CB → carte
- Contient VIR SEPA / VIREMENT / VIR INST → virement
- Contient PRLV SEPA → prelevement
- Contient SWILE → ticket_resto
- Contient DAB / RETRAIT → especes
- Contient CHEQUE → cheque

---

## 10. 📤 Export

Depuis la page Transactions, bouton "📥 Exporter" génère un CSV UTF-8 avec BOM (compatible Excel FR) :
```
"Date";"Libellé";"Banque";"Moyen paiement";"Type";"Montant";"Catégorie";"Sous-catégorie";"Note"
```
Respecte les filtres actifs. Nom fichier : `monie_transactions_YYYY-MM-DD.csv`.

---

## 11. 📱 PWA / Mobile

- `manifest.json` avec `display: standalone` + icônes 192/512
- `apple-touch-icon.png` 180×180 pour iOS
- `apple-mobile-web-app-capable: yes` → plein écran depuis home screen
- Bottom-nav fixe sur mobile (< 900px)
- Hamburger menu → sidebar slide-in
- Header mobile auto-hide au scroll down, réapparaît au scroll up ou tap top
- `overscroll-behavior-y: none` sur mobile only (fix bounce iOS Safari)

---

## 12. ⚙ Fonctionnalités transverses

- **Toasts** : messages ephémères 3s (success, error, info)
- **Modal** : title + msg + body HTML + confirm/cancel, async callback avec support "return false" pour bloquer close
- **Fermeture modal** : clic sur backdrop ou touche Échap
- **Bulle info** : SVG rose framboise avec queue speech-bubble, `i` italique blanc, tooltip au hover
- **Help-banners accordéons** : cliquables, chevron vert (sauge), croix rouge, état persisté en localStorage
- **Header auto-hide** : scroll down → translate(-100%), scroll up ou mouseenter top ou tap top → visible
- **Thème** : loaded early depuis localStorage (évite flash rose) puis sync avec profiles.theme

---

## 13. 🚀 Déploiement

### Étapes reproduire à l'identique
1. Créer un projet GitHub → activer GitHub Pages sur main branch, root
2. Créer un projet Supabase (europe-west3 par ex)
3. Récupérer `SUPABASE_URL` + `SUPABASE_ANON_KEY` → les coller dans `app.js` (lignes du haut)
4. Ouvrir SQL Editor Supabase → run les scripts SQL dans l'ordre : `SQL-V3.sql`, `SQL-V37.sql`, `SQL-V38.sql`, `SQL-V39.sql`, `SQL-V310.sql`, `SQL-V311.sql`, `SQL-V312.sql` *(V312 crée `tracker_mensuel`, obligatoire pour la page Suivi mensuel)*
5. Vérifier bucket `avatars` créé et policies actives
6. Push le repo → GitHub Pages déploie automatiquement (~1 min)
7. Se rendre sur `https://[USER].github.io/[REPO]/`
8. Créer un compte, importer un JSON de tx exemple

### Configuration Supabase
- Auth → Providers : email activé
- Auth → Confirm email : désactivé (dev) ou activé (prod)
- Storage → Bucket `avatars` : public en read

---

## 14. 🧪 Test et validation

### Checklist reproduction
- [ ] Signup avec email/password → OK
- [ ] Login → redirige vers Calendrier
- [ ] Import JSON test → 5000+ tx catégorisées bien
- [ ] Pastilles LCL/Bourso visibles
- [ ] Dashboard affiche courbe 12 mois
- [ ] Suivi mensuel : saisie manuelle patrimoine → sauvegarde après 1.2s
- [ ] Vue annuelle : sélection année → tableau se recalcule
- [ ] Épargne : créer objectif + contribution → mise à jour barre progression
- [ ] Profil : upload photo → apparaît dans user-pill
- [ ] Changement thème → applique instantanément
- [ ] Suppression tx → confirmée par modal → disparait
- [ ] Bulk edit sur 5 tx → recatégorisation appliquée

---

## 15. 📚 Sources et références

- Supabase docs : https://supabase.com/docs
- pdf.js : https://mozilla.github.io/pdf.js/
- Chart.js : https://www.chartjs.org/
- Google Fonts Nunito : https://fonts.google.com/specimen/Nunito
- Emojis : Unicode 15.0+

---

## 16. 🔮 Améliorations possibles (post-v3)

- Suivi patrimoine automatique via APIs bancaires (Bridge, Powens, etc.)
- OCR sur reçus papier via Google Vision ou Tesseract
- Notifications push : dépassement budget mensuel
- Export PDF récapitulatif année
- Multi-comptes : gestion couple/famille avec dépenses partagées
- Rapprochement automatique tickets restaurant Swile
- Prédictions ML : reste à vivre estimé, alerte sur tendance dépense inhabituelle

---

## 17. 👤 Contact

Créé et maintenu par Abayo Assi.
Feedback via GitHub issues.

*Dernière mise à jour : Juillet 2026*
