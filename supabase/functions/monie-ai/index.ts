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
