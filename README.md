# Budget Assi — Site de gestion budgétaire

Application web personnelle de gestion de budget, déployée sur GitHub Pages.

## Fonctionnalités

- **Dashboard** — vue d'ensemble avec graphiques, KPIs et santé budgétaire
- **Patrimoine** — suivi de tous les comptes (libre / réservé / intouchable)
- **Revenus** — salaire CDI, tickets restaurant, revenus complémentaires, dîme automatique
- **Charges** — charges fixes, abonnements dynamiques, vie courante, graphique de répartition
- **Transactions** — saisie manuelle avec graphiques camembert et barres par catégorie
- **Épargne** — épargnes mensuelles, objectifs personnalisés avec projection et date d'atteinte

## Déploiement sur GitHub Pages

### Étape 1 — Créer le repository

```bash
# Crée un nouveau repo sur github.com appelé "budget" (ou ce que tu veux)
# Puis clone-le localement :
git clone https://github.com/TON_USERNAME/budget.git
cd budget
```

### Étape 2 — Copier les fichiers

Copie ces 3 fichiers dans le dossier :
- `index.html`
- `style.css`
- `app.js`

### Étape 3 — Push sur GitHub

```bash
git add .
git commit -m "Initial budget app"
git push origin main
```

### Étape 4 — Activer GitHub Pages

1. Va sur ton repo GitHub → **Settings**
2. Dans le menu gauche → **Pages**
3. Source : **Deploy from a branch**
4. Branch : **main** / **(root)**
5. Clique **Save**

Ton site sera disponible à : `https://TON_USERNAME.github.io/budget`

## Import de tes données existantes

1. Dans le widget Claude, clique **"Télécharger budget_data.json"**
2. Sur ton site GitHub, clique **"Importer données"** (sidebar en bas à gauche)
3. Sélectionne le fichier téléchargé
4. Toutes tes données apparaissent instantanément !

## Sauvegarde des données

Les données sont sauvegardées dans le `localStorage` de ton navigateur — elles persistent entre les sessions. Pour ne pas les perdre :
- Utilise le bouton **"Exporter"** régulièrement pour sauvegarder un fichier JSON
- Ne vide pas le cache de ton navigateur sans exporter d'abord

## Structure des fichiers

```
budget/
├── index.html    # Structure HTML de l'app
├── style.css     # Styles et design
├── app.js        # Logique JavaScript
└── README.md     # Ce fichier
```
