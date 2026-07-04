# 🚀 Déployer Monie en 1 commande (fini les uploads manuels)

Ton dossier est maintenant un **dépôt Git**. Objectif : au lieu d'uploader 4 fichiers à la main,
tu tapes **une seule commande** et GitHub Pages se met à jour tout seul.

Tes données bancaires (`monie_import_v2.json`, sauvegardes, exports) sont **exclues automatiquement**
(fichier `.gitignore`) — elles ne partiront JAMAIS sur GitHub. ✅

---

## 1) Une seule fois : connecter ton dépôt GitHub

Ouvre le Terminal dans ce dossier, puis :

```bash
cd "/Users/abayo/Downloads/Banque/monie-v3"

# Remplace l'URL par celle de TON dépôt GitHub (celui qui sert Monie via Pages)
git remote add origin https://github.com/TON-PSEUDO/TON-REPO.git

# Envoie tout (ton dossier local = la version de référence)
git push -u origin main --force
```

- Si tu n'as pas encore de dépôt : crée-le sur github.com (bouton **New**), puis utilise son URL ci-dessus.
- GitHub va peut-être te demander de te connecter (identifiant + un « token » à la place du mot de passe).
  → github.com → Settings → Developer settings → Personal access tokens → *Generate* (coche `repo`).
- Vérifie que **GitHub Pages** est activé : dépôt → Settings → Pages → Branch `main` → `/ (root)`.

> ⚠️ Le `--force` de la 1re fois écrase le contenu distant par ton dossier local (c'est voulu :
> ton Mac a la bonne version). À ne faire QU'À LA PREMIÈRE connexion.

---

## 2) À chaque fois que tu veux déployer (les fois suivantes)

Juste ces 3 lignes (ou même une seule) :

```bash
cd "/Users/abayo/Downloads/Banque/monie-v3"
git add -A
git commit -m "maj Monie"
git push
```

⏱️ GitHub Pages se met à jour en ~1 minute. **Plus aucun upload de fichier à la main.**

Astuce : tu peux tout enchaîner en une ligne —
```bash
git add -A && git commit -m "maj" && git push
```

---

## En résumé

| Avant | Maintenant |
|---|---|
| Ouvrir GitHub, Upload files, glisser 4 fichiers, Commit | `git push` |
| Risque d'oublier un fichier / une version | Tout part ensemble, toujours cohérent |

Une fois la connexion faite (étape 1), dis-le moi : je pourrai même préparer les commits pour toi.
