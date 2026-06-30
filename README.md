# 🌸 Monie V2 — Page "Suivi mensuel"

> Patch additif à ton repo `Hysadre/Monie` existant. Dark theme préservé.

## 📦 Ce que contient ce dossier

| Fichier | Où ça va |
|---|---|
| `01-supabase-migration.sql` | À exécuter dans le SQL Editor Supabase |
| `02-suivi-mensuel.html` | À insérer dans `index.html` |
| `03-suivi-mensuel.js` | À ajouter à `app.js` |
| `04-suivi-mensuel.css` | À ajouter à `style.css` |

## 🚀 Étapes d'intégration (15 min)

### 1. Supabase — créer la table
- Ouvre [supabase.com](https://supabase.com) → ton projet
- SQL Editor → New query
- Colle le contenu de `01-supabase-migration.sql`
- Run

### 2. `index.html` — ajouter l'onglet
- Ouvre `index.html`
- Dans la **sidebar** (chercher `<nav class="nav">`), ajoute ce bouton **avant** Imports :
  ```html
  <button class="nav-btn" onclick="showTab('suivi')" data-tab="suivi">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M3 3v18h18M7 14l4-4 4 4 5-5"/>
    </svg>
    Suivi mensuel
  </button>
  ```
- Dans la **mobile-nav** (en bas), ajoute aussi :
  ```html
  <button class="mnav-btn" onclick="showTab('suivi');mnavActive(this)" data-tab="suivi">
    <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8">
      <path d="M3 3v18h18M7 14l4-4 4 4 5-5"/>
    </svg>Suivi
  </button>
  ```
- Dans `<main class="main-content">`, **avant** `<!-- ÉPARGNE -->`, colle tout le contenu de `02-suivi-mensuel.html`

### 3. `app.js` — ajouter la logique
- Ouvre `app.js`
- À la fin du fichier (avant le dernier `;` ou avant `// ─── BOOT`), colle le contenu de `03-suivi-mensuel.js`
- Dans la fonction `showTab(name)`, ajoute après `if(name==='imports')...` :
  ```js
  if (name === 'suivi') renderSuivi();
  ```
- Dans `renderAll()`, ajoute :
  ```js
  renderSuivi();
  ```

### 4. `style.css` — styles
- Ouvre `style.css`
- À la fin du fichier, colle le contenu de `04-suivi-mensuel.css`

### 5. Push GitHub
```bash
git add .
git commit -m "feat: ajout page Suivi mensuel (patrimoine + revenus + épargne)"
git push origin main
```

GitHub Pages se met à jour en 1-2 minutes.

## ✨ Ce que la page fait

- **Sélecteur d'année** (2021 → 2026)
- **Tableau** avec 12 lignes (1 par mois) × 3 sections :
  - 💎 Patrimoine (7 comptes + TOTAL + ÉVOLUTION)
  - 💰 Revenus (4 sources + TOTAL, auto depuis transactions si dispo)
  - 🎯 Épargne (cible + réel, réel auto si dispo)
- **Auto-save** debouncée à 1.5s (comme le reste de l'app)
- **Mobile** : vue cartes par mois (accordéon)
- **Couleurs** : vert si patrimoine en hausse / épargne ≥ cible, rouge sinon

## 🔄 Auto-fill depuis les transactions

Quand tu as importé des transactions et qu'elles sont dans `S.transactions` :
- **Revenus** se calculent automatiquement (filtre par catégorie + mois)
- **Épargne réelle** se calcule depuis les virements vers Livret A / PEA
- **Patrimoine** reste manuel (impossible à déduire des transactions seules)

Bouton 🔄 "Resync depuis transactions" pour recalculer un mois.

## 🛣️ Prochaines étapes (V2.1+)

- [ ] Page **Évolution** avec courbes interactives (patrimoine sur 5 ans)
- [ ] Page **Revenus** avec stack chart par source
- [ ] Page **Épargne** avec courbe cible vs réel
- [ ] Alertes : patrimoine baisse 2 mois consécutifs, épargne < cible 3 mois
- [ ] Export PDF du tableau de suivi
