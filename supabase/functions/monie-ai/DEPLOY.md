# 🤖 Déployer l'IA de Monie (fonction « monie-ai »)

L'app parle à Claude **via une fonction serveur** pour que la clé API **ne soit jamais**
dans le code du site (sinon n'importe qui pourrait la voler et la faire tourner sur ton compte).

## 1. Une seule fois : installer l'outil Supabase

```bash
# macOS (Homebrew)
brew install supabase/tap/supabase

# se connecter à ton compte Supabase
supabase login

# relier ce dossier à ton projet (ref = clcurpkixduhggefsilk)
cd "/Users/abayo/Downloads/Banque/monie-v3"
supabase link --project-ref clcurpkixduhggefsilk
```

## 2. Récupérer une clé API Anthropic (Claude)

- Va sur https://console.anthropic.com → **API Keys** → *Create key*.
- Copie la clé (commence par `sk-ant-...`). **Ne la mets nulle part dans le site.**

## 3. Enregistrer la clé comme SECRET serveur

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-ta-cle-ici
# (facultatif) choisir un autre modèle que Haiku par défaut :
# supabase secrets set MONIE_AI_MODEL=claude-sonnet-5
```

## 4. Déployer la fonction

```bash
supabase functions deploy monie-ai
```

C'est tout. Recharge l'app : le bouton 💬 en bas à droite et le bouton
**🤖 Analyse IA** de la page Analyse fonctionnent.

## Notes

- **Sécurité** : la fonction vérifie que l'appel vient d'un utilisateur connecté (ton JWT),
  et n'envoie à Claude qu'un **résumé chiffré** (totaux, budgets, objectifs) — jamais ton
  relevé bancaire brut.
- **Coût** : chaque message du chat et chaque clic sur « Analyse IA » consomme des tokens
  Anthropic (facturés sur ta clé). Haiku est le modèle par défaut (le moins cher).
- **Changer de modèle** : `supabase secrets set MONIE_AI_MODEL=claude-sonnet-5` puis
  `supabase functions deploy monie-ai`.
- **Voir les logs** : `supabase functions logs monie-ai`.
