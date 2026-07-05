// ═══════════════════════════════════════════════════════════════
// 🌸 MONIE — Edge Function « monie-ai »
// Proxy sécurisé vers l'API Anthropic (Claude).
//   • La clé ANTHROPIC_API_KEY reste côté serveur (jamais dans le front).
//   • Seuls les utilisateurs authentifiés (JWT Supabase) peuvent appeler.
//   • Le front envoie un CONTEXTE AGRÉGÉ (totaux, budgets) — pas le relevé brut.
//
// Déploiement :
//   supabase functions deploy monie-ai
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// ═══════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
// Modèle par défaut : rapide & économique. Surchargeable via secret MONIE_AI_MODEL.
const MODEL = Deno.env.get("MONIE_AI_MODEL") ?? "claude-haiku-4-5-20251001";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const SYSTEM_BASE = `Tu es « Monie », une conseillère budgétaire francophone, chaleureuse et concrète, intégrée à une app de budget perso.
Tu t'adresses à l'utilisatrice en la tutoyant, avec bienveillance et sans jargon.
Tu bases TOUJOURS tes réponses sur le CONTEXTE FINANCIER fourni (chiffres réels de l'utilisatrice).
Règles importantes :
- Sois brève et actionnable : des constats chiffrés, puis 1 à 3 pistes concrètes.
- Utilise l'euro (€) et le format français.
- Tu n'es PAS conseillère en investissement agréée : ne donne jamais de recommandation d'achat/vente de placements précis ; si on te le demande, explique-le gentiment et reste sur la gestion budgétaire.
- Ne réclame jamais de mot de passe, coordonnées bancaires ou informations d'identification.
- Si une donnée manque dans le contexte, dis-le simplement plutôt que d'inventer.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  if (!ANTHROPIC_API_KEY) return json({ error: "Clé IA non configurée côté serveur." }, 500);

  // Vérifie l'utilisateur via son JWT Supabase
  const authHeader = req.headers.get("Authorization") ?? "";
  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authErr } = await supa.auth.getUser();
  if (authErr || !user) return json({ error: "Non authentifié" }, 401);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "Corps invalide" }, 400); }

  // ─── MODE « ticket » : lecture d'une photo (liste de courses / ticket de caisse) ───
  // Le front envoie une image (base64) → on demande à Claude d'extraire les lignes en JSON.
  if (payload?.mode === "ticket") {
    const b64 = typeof payload?.image === "string" ? payload.image : "";
    if (!b64) return json({ error: "Aucune image reçue." }, 400);
    const mediaType = typeof payload?.media_type === "string" ? payload.media_type : "image/jpeg";
    const TICKET_SYS = `Tu extrais les produits d'une photo (liste de courses manuscrite OU ticket de caisse OU capture d'écran).
Réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour, sans balises Markdown.
Chaque élément : {"label": string, "brand": string|null, "price": number|null, "qty": number}.
- "label" : le nom du produit, propre et lisible (corrige les abréviations évidentes du ticket).
- "brand" : la marque si elle est visible dans le libellé (ex: "Ariel", "Nivea"), sinon null.
- "price" : le prix en euros (nombre, point décimal), sinon null si absent (liste manuscrite).
- "qty" : quantité si indiquée, sinon 1.
Ignore les lignes qui ne sont pas des produits (totaux, TVA, dates, remerciements, moyens de paiement, points de fidélité).
Si l'image est illisible ou ne contient aucun produit, réponds [].`;
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 2000,
          system: TICKET_SYS,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } },
              { type: "text", text: "Extrais tous les produits de cette image au format JSON demandé." },
            ],
          }],
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        console.error("Anthropic ticket error", r.status, t);
        return json({ error: "La lecture de la photo a échoué." }, 502);
      }
      const data = await r.json();
      const raw = Array.isArray(data?.content)
        ? data.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim()
        : "";
      // Robustesse : on récupère le tableau JSON même si le modèle a ajouté du texte
      let items: any[] = [];
      try {
        const m = raw.match(/\[[\s\S]*\]/);
        items = JSON.parse(m ? m[0] : raw);
      } catch { items = []; }
      if (!Array.isArray(items)) items = [];
      // Nettoyage/normalisation
      const clean = items.slice(0, 100).map((x: any) => ({
        label: typeof x?.label === "string" ? x.label.slice(0, 120).trim() : "",
        brand: typeof x?.brand === "string" && x.brand.trim() ? x.brand.slice(0, 60).trim() : null,
        price: (typeof x?.price === "number" && isFinite(x.price)) ? Math.round(x.price * 100) / 100 : null,
        qty: (typeof x?.qty === "number" && x.qty > 0) ? x.qty : 1,
      })).filter((x: any) => x.label);
      return json({ items: clean });
    } catch (e) {
      console.error(e);
      return json({ error: "Erreur réseau vers l'IA (lecture photo)." }, 502);
    }
  }

  const context: string = typeof payload?.context === "string" ? payload.context.slice(0, 12000) : "";
  const mode: string = payload?.mode === "conseils" ? "conseils" : "chat";
  // messages = [{role:'user'|'assistant', content:'...'}]
  const rawMsgs = Array.isArray(payload?.messages) ? payload.messages : [];
  const messages = rawMsgs
    .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
    .slice(-12)
    .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
  if (!messages.length) return json({ error: "Aucun message" }, 400);

  const system = SYSTEM_BASE +
    (mode === "conseils"
      ? `\n\nMODE ANALYSE : produis un bilan personnalisé de la période. Structure : 1) un résumé en une phrase, 2) 3 à 5 observations chiffrées marquantes, 3) 2 à 3 recommandations concrètes. Reste sous ~250 mots.`
      : `\n\nMODE CHAT : réponds à la question posée, en t'appuyant sur le contexte. Concis.`) +
    (context ? `\n\n════ CONTEXTE FINANCIER DE L'UTILISATRICE ════\n${context}` : "");

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: mode === "conseils" ? 700 : 600,
        system,
        messages,
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error("Anthropic error", r.status, t);
      return json({ error: "L'IA est indisponible pour le moment." }, 502);
    }
    const data = await r.json();
    const reply = Array.isArray(data?.content)
      ? data.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim()
      : "";
    return json({ reply: reply || "(réponse vide)" });
  } catch (e) {
    console.error(e);
    return json({ error: "Erreur réseau vers l'IA." }, 502);
  }
});
