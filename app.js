// ═══════════════════════════════════════════════════════════════
// 🌸 MONIE V3 — App logic
// ═══════════════════════════════════════════════════════════════
const APP_VERSION = 'v114'; // ← doit correspondre à la version du service worker (sw.js). Sert de témoin de déploiement.
const SUPABASE_URL = 'https://clcurpkixduhggefsilk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsY3VycGtpeGR1aGdnZWZzaWxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4ODk1NDcsImV4cCI6MjA5ODQ2NTU0N30.ngTHdm87bpFn2N1jMHw2sEwJuelLM3woO1EM1skwk6k';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = id => document.getElementById(id);
const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };

// Compteur animé SÛR : requestAnimationFrame, annulable par token, aucun MutationObserver
// (donc aucune boucle possible). render(v) transforme le nombre courant en texte.
const _prefersReduce = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function animateNumber(el, to, render) {
  if (!el) return;
  to = Number(to) || 0;
  const token = (el.__animToken || 0) + 1;
  el.__animToken = token;
  const from = (typeof el.__animVal === 'number') ? el.__animVal : to; // 1re fois : pas d'animation
  el.__animVal = to;
  if (_prefersReduce() || from === to) { el.textContent = render(to); return; }
  el.classList.add('counting');
  const dur = 600, t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  function step(now) {
    if (el.__animToken !== token) return; // une valeur plus récente a pris le relais → on abandonne
    let p = Math.min(1, (now - t0) / dur);
    p = 1 - Math.pow(1 - p, 3);
    el.textContent = render(from + (to - from) * p);
    if (p < 1) requestAnimationFrame(step);
    else { el.textContent = render(to); el.classList.remove('counting'); }
  }
  requestAnimationFrame(step);
}
const fmt = n => (n < 0 ? '-' : '') + Math.abs(Math.round(n)).toLocaleString('fr-FR') + ' €';
const fmtD = n => (n < 0 ? '-' : '') + Math.abs(n).toLocaleString('fr-FR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' €';
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const MONTHS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];

// Catégorie → icône emoji + couleur
const CAT_META = {
  'Salaire': { emoji: '💰', color: '#7FB89E' },
  'Tickets restaurant': { emoji: '🎟️', color: '#7FB89E' },
  'Remboursements': { emoji: '↩️', color: '#7FB89E' },
  'Loyer': { emoji: '🏠', color: '#DD7B85' },
  'Alimentation': { emoji: '🛒', color: '#F4A993' },
  'Transport': { emoji: '🚗', color: '#7C3F58' },
  'Cosmétique': { emoji: '💄', color: '#E76F51' },
  'Mode': { emoji: '👗', color: '#D8B4DD' },
  'Santé': { emoji: '💊', color: '#E76F51' },
  'Administratif': { emoji: '📋', color: '#718096' },
  'Vie quotidienne': { emoji: '🛍️', color: '#D8B4DD' },
  'Abonnements': { emoji: '📱', color: '#F4A993' },
  'Dîme': { emoji: '⛪', color: '#7C3F58' },
  'Dons': { emoji: '💝', color: '#D8B4DD' },
  'Investissements': { emoji: '📈', color: '#7FB89E' },
  'Banque': { emoji: '🏦', color: '#718096' },
  'Impôts': { emoji: '🧾', color: '#DD7B85' },
  'Transactions': { emoji: '🔄', color: '#A0AEC0' },
  'Amis & Famille': { emoji: '💌', color: '#DD7B85' },
  'Éducation': { emoji: '🎓', color: '#7C3F58' },
  'Voyages': { emoji: '✈️', color: '#4FC3F7' },
  'Divertissement': { emoji: '🎬', color: '#E76F51' },
  'Tech & Électronique': { emoji: '💻', color: '#4A5568' },
  'Aide au logement': { emoji: '🏘️', color: '#7FB89E' },
  'Paiement échelonné': { emoji: '💳', color: '#B79CD6' },
  'Imprévus': { emoji: '⚡', color: '#E8A317' },
  'Épargne': { emoji: '🐷', color: '#7FB89E' },
  'Autres': { emoji: '📌', color: '#A0AEC0' }
};
// Sous-catégories prédéfinies par catégorie (proposées en liste déroulante ; extensibles)
const SUBCATS = {
  'Alimentation': ['Courses', 'Restos', 'Fast food', 'Livraison', 'Boulangerie', 'Café / Bar', 'Traiteur'],
  'Transport': ['Train', 'Bus / Métro', 'Essence', 'Uber / VTC', 'Péage', 'Parking', 'Avion', 'Vélo / Trottinette'],
  'Banque': ['Frais bancaires', 'Agios', 'Cotisation carte', 'Assurance', 'Virement'],
  'Abonnements': ['Téléphone', 'Internet', 'Streaming', 'Salle de sport', 'IA', 'Logiciels', 'Presse', 'Cloud'],
  'Santé': ['Médecin', 'Pharmacie', 'Mutuelle', 'Dentiste', 'Optique', 'Kiné', 'Analyses'],

  'Cosmétique': ['Soins', 'Coiffeur', 'Maquillage', 'Parfum', 'Ongles'],
  'Loyer': ['Loyer', 'Charges', 'Caution', 'Eau', 'Électricité', 'Gaz'],
  'Administratif': ['Papiers', 'Amendes', 'Assurance habitation', 'Timbres / Poste', 'Frais divers'],
  'Vie quotidienne': ['Hygiène & entretien', 'Maison & déco', 'Cuisine & ustensiles', 'Animaux', 'Bricolage & réparations', 'Papeterie & fournitures', 'Divers'],
  'Tech & Électronique': ['Téléphone', 'Ordinateur / Tablette', 'Audio / Casque', 'Écran / TV', 'Accessoires', 'Électroménager', 'Gaming', 'Objets connectés'],
  'Mode': ['Vêtements', 'Chaussures', 'Accessoires', 'Cheveux / perruques', 'Sous-vêtements', 'Sport'],
  'Divertissement': ['Cinéma', 'Sorties', 'Jeux', 'Concerts', 'Livres', 'Musées'],
  'Dons': ['Association', 'Caritatif', 'Cagnotte'],
  'Dîme': ['Église'],
  'Éducation': ['Scolarité', 'Fournitures', 'CVEC', 'Livres', 'Formation'],
  'Amis & Famille': ['Cadeaux', 'Famille', 'Prêt', 'Sorties'],
  'Voyages': ['Hébergement', 'Transport', 'Activités', 'Restauration'],
  'Impôts': ['Impôt sur le revenu', "Taxe d'habitation", 'Taxe foncière', 'CFE'],
  'Investissements': ['PEA', 'Livret A', 'LDDS', 'Assurance vie', 'Crypto', 'Bourse'],
  'Imprévus': ['Réparation', 'Médical', 'Panne', 'Autre'],
  'Salaire': ['Salaire', 'Prime', 'Heures sup'],
  'Remboursements': ['Ami', 'Administratif', 'Banque', 'Achat marchand', 'Santé']
};
// Sous-SOUS-catégories prédéfinies : SUBSUBCATS[catégorie][sous-catégorie] = [niveau 3]
// (listes déroulantes prêtes à l'emploi ; extensibles — les valeurs déjà utilisées s'ajoutent automatiquement)
const SUBSUBCATS = {
  'Alimentation': {
    'Courses': ['Fruits & légumes', 'Viande', 'Poisson', 'Produits laitiers', 'Épicerie salée', 'Épicerie sucrée', 'Boissons', 'Surgelés', 'Pain & petit-déj', 'Bébé', 'Bio / Vrac'],
    'Restos': ['Africain', 'Asiatique', 'Chinois', 'Italien / Pizza', 'Brunch', 'Poké / Healthy', 'Autre'],
    'Fast food': ['Burger', 'Tacos', 'Kebab', 'Sandwich', 'Poulet frit', 'Snack', 'Glaces / Desserts'],
    'Livraison': ['Uber Eats', 'Deliveroo', 'Autre'],
    'Boulangerie': ['Pain', 'Viennoiserie', 'Pâtisserie'],
    'Café / Bar': ['Café', 'Bar', 'Salon de thé']
  },
  'Vie quotidienne': {
    'Hygiène & entretien': ['Produits ménagers', 'Lessive', 'Vaisselle', 'Papier toilette / essuie-tout', 'Sacs poubelle', 'Désodorisant', 'Produits WC / salle de bain', 'Éponges / gants'],
    'Maison & déco': ['Décoration', 'Linge de maison', 'Luminaire', 'Rangement', 'Plantes', 'Bougies'],
    'Cuisine & ustensiles': ['Vaisselle', 'Ustensiles', 'Petit électroménager', 'Contenants / conservation'],
    'Animaux': ['Nourriture', 'Litière', 'Accessoires', 'Vétérinaire'],
    'Bricolage & réparations': ['Outils', 'Quincaillerie', 'Peinture', 'Électricité'],
    'Papeterie & fournitures': ['Papeterie', 'Fournitures bureau', 'Cartouches / encre', 'Livres', 'BD / Mangas', 'Romans', 'Développement perso']
  },
  'Cosmétique': {
    'Soins': ['Visage', 'Corps', 'Cheveux', 'Solaire', 'Mains & pieds'],
    'Maquillage': ['Teint', 'Yeux', 'Lèvres', 'Ongles'],
    'Coiffeur': ['Coupe', 'Couleur', 'Coiffure protectrice', 'Soin'],
    'Parfum': ['Femme', 'Homme', 'Maison'],
    'Ongles': ['Manucure', 'Pose', 'Vernis / matériel']
  },
  'Santé': {
    'Pharmacie': ['Médicaments', 'Parapharmacie', 'Compléments', 'Hygiène', 'Premiers soins'],
    'Médecin': ['Généraliste', 'Spécialiste', 'Gynéco', 'Dermato'],
    'Optique': ['Lunettes', 'Lentilles', 'Produits'],
    'Dentiste': ['Consultation', 'Soins', 'Orthodontie']
  },
  'Mode': {
    'Vêtements': ['Haut', 'Bas', 'Robe', 'Manteau / veste', 'Pyjama / nuit'],
    'Chaussures': ['Baskets', 'Talons', 'Bottes', 'Sandales'],
    'Accessoires': ['Sac', 'Bijoux', 'Ceinture', 'Écharpe / bonnet', 'Lunettes de soleil'],
    'Cheveux / perruques': ['Perruque', 'Tissage', 'Mèches / closure', 'Colle / entretien', 'Accessoires'],
    'Sous-vêtements': ['Lingerie', 'Chaussettes', 'Collants']
  },
  'Transport': {
    'Essence': ['Essence', 'Diesel', 'Recharge élec'],
    'Train': ['SNCF', 'TER', 'TGV', 'Abonnement'],
    'Bus / Métro': ['Ticket', 'Abonnement'],
    'Uber / VTC': ['Uber', 'Bolt', 'Taxi']
  },
  'Abonnements': {
    'Streaming': ['Netflix', 'Spotify', 'Disney+', 'Prime Video', 'YouTube', 'Canal+'],
    'Téléphone': ['Forfait mobile', 'Recharge'],
    'Internet': ['Box', 'Fibre'],
    'IA': ['ChatGPT', 'Claude', 'Perplexity', 'Autre'],
    'Salle de sport': ['Abonnement', 'Séance']
  },
  'Tech & Électronique': {
    'Téléphone': ['Smartphone', 'Coque / protection', 'Chargeur'],
    'Ordinateur / Tablette': ['PC portable', 'Tablette', 'Accessoires'],
    'Audio / Casque': ['Écouteurs', 'Casque', 'Enceinte'],
    'Accessoires': ['Câbles', 'Chargeur', 'Batterie externe', 'Stockage']
  },
  'Voyages': {
    'Hébergement': ['Hôtel', 'Airbnb', 'Auberge'],
    'Transport': ['Avion', 'Train', 'Location voiture', 'Bus'],
    'Activités': ['Excursion', 'Musée', 'Parc'],
    'Restauration': ['Restaurant', 'Snack']
  },
  'Amis & Famille': {
    'Cadeaux': ['Anniversaire', 'Noël', 'Mariage', 'Naissance'],
    'Famille': ['Aide', 'Envoi argent', 'Sortie']
  },
  'Divertissement': {
    'Cinéma': ['Place', 'Abonnement', 'Confiseries'],
    'Sorties': ['Bar', 'Boîte', 'Escape game', 'Bowling'],
    'Jeux': ['Jeu vidéo', 'Jeu de société', 'Appli']
  }
};
// Construit les <option> d'une sous-catégorie : prédéfinies + déjà utilisées + « Autre »
function subcatOptions(category, current) {
  const cur = (current || '').trim();
  const predef = SUBCATS[category] || [];
  const used = [...new Set(transactions.filter(t => t.category === category && t.sub_category).map(t => (t.sub_category || '').trim()))].filter(Boolean);
  const all = [...new Set([...predef, ...used])].sort();
  if (cur && !all.includes(cur)) all.unshift(cur);
  return `<option value="">— aucune —</option>`
    + all.map(s => `<option value="${esc(s)}" ${s === cur ? 'selected' : ''}>${esc(s)}</option>`).join('')
    + `<option value="__custom__">➕ Autre (saisir…)</option>`;
}
// Options d'un <datalist> (suggestions pour un champ texte)
function subcatDatalist(category) {
  const predef = SUBCATS[category] || [];
  const used = [...new Set(transactions.filter(t => t.category === category && t.sub_category).map(t => (t.sub_category || '').trim()))].filter(Boolean);
  return [...new Set([...predef, ...used])].sort().map(s => `<option value="${esc(s)}">`).join('');
}
// Gère le choix dans la liste (dont « Autre » → saisie libre)
function onSubcatSelect(id, val) {
  if (val === '__custom__') {
    const tx = transactions.find(t => t.id === id);
    const v = prompt('Nouvelle sous-catégorie :', tx ? (tx.sub_category || '') : '');
    if (v === null) { renderTransactionsList(); return; } // annulé → on remet le select
    updateTxSubcat(id, v);
    return;
  }
  updateTxSubcat(id, val);
}

// ── Niveau 3 : sous-sous-catégories (prédéfinies + déjà utilisées dans transactions & courses) ──
function subsubList(category, subcategory) {
  const sub = (subcategory || '').trim();
  const predef = (SUBSUBCATS[category] && SUBSUBCATS[category][sub]) || [];
  const src = [...(transactions || []), ...(coursesList || [])];
  const used = [...new Set(src
    .filter(t => t.category === category && (t.sub_category || '').trim() === sub)
    .map(t => (t.sub_sub_category || '').trim()).filter(Boolean))];
  return [...new Set([...predef, ...used])].sort();
}
function subsubOptions(category, subcategory, current) {
  const cur = (current || '').trim();
  const all = subsubList(category, subcategory);
  if (cur && !all.includes(cur)) all.unshift(cur);
  return `<option value="">— aucune —</option>`
    + all.map(s => `<option value="${esc(s)}" ${s === cur ? 'selected' : ''}>${esc(s)}</option>`).join('')
    + `<option value="__custom__">➕ Autre (saisir…)</option>`;
}
function subsubDatalist(category, subcategory) {
  return subsubList(category, subcategory).map(s => `<option value="${esc(s)}">`).join('');
}
function onSubsubSelect(id, val) {
  if (val === '__custom__') {
    const tx = transactions.find(t => t.id === id);
    const v = prompt('Nouvelle sous-sous-catégorie :', tx ? (tx.sub_sub_category || '') : '');
    if (v === null) { renderTransactionsList(); return; }
    updateTxSubsub(id, v);
    return;
  }
  updateTxSubsub(id, val);
}
async function updateTxSubsub(id, val) {
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;
  if (!_hasSubsubCol) { toast('Lance d\'abord le SQL-V321 pour activer la sous-sous-catégorie', 'error'); return; }
  const v = (val || '').trim() || null;
  if ((tx.sub_sub_category || null) === v) return;
  const { error } = await sb.from('transactions').update({ sub_sub_category: v }).eq('id', id);
  if (error) { toast('Erreur : ' + error.message, 'error'); return; }
  tx.sub_sub_category = v;
  renderTransactionsList();
}

// Métadonnées des banques source (pastilles LCL / BoursoBank)
const BANK_META = {
  'LCL':        { label: 'LCL',    color: '#0059A5', bg: '#E3EEFB' },
  'BoursoBank': { label: 'Bourso', color: '#E52A5A', bg: '#FCE4EC' },
  'Boursobank': { label: 'Bourso', color: '#E52A5A', bg: '#FCE4EC' }
};
const catIcon = c => (c === 'Restos & sorties' ? '🍽️' : (CAT_META[c]?.emoji || '📌'));
const catColor = c => (c === 'Restos & sorties' ? '#E76F51' : (CAT_META[c]?.color || '#A0AEC0'));
// Petite pastille pour indiquer la banque source (LCL / BoursoBank / autre)
function bankBadge(bs) {
  if (!bs) return '';
  const m = BANK_META[bs];
  if (m) return `<span class="bank-badge" style="color:${m.color};background:${m.bg}" title="Compte ${m.label}">${m.label}</span>`;
  // Banque non prédéfinie : pastille générique (pour qu'on voie TOUJOURS la banque)
  return `<span class="bank-badge" style="color:#5B6B7C;background:#EDF1F5" title="Compte ${esc(bs)}">${esc(bs)}</span>`;
}
// Pastille de provenance : saisi à la main / importé / photo / démo
function sourceBadge(src) {
  const s = src || '';
  if (s === 'manual') return `<span class="src-badge" style="color:#7C3F58;background:#F3E8EE" title="Saisie manuelle">✍️ Saisi</span>`;
  if (s === 'import_photo') return `<span class="src-badge" style="color:#C1553B;background:#FCE9E3" title="Ajouté depuis une photo">📸 Photo</span>`;
  if (s === 'demo') return `<span class="src-badge" style="color:#7A5CB0;background:#EEE8F6" title="Donnée de démonstration">🎲 Démo</span>`;
  if (s === 'reuse') return `<span class="src-badge" style="color:#4F8F72;background:#E8F3EE" title="Liste réutilisée">♻️ Réutilisé</span>`;
  if (s.startsWith('import')) return `<span class="src-badge" style="color:#4A5568;background:#EDF1F5" title="Importé d'un relevé">📥 Importé</span>`;
  return '';
}

// ─── STATE ────────────────────────────────────────────────────
let currentUser = null;
let transactions = [];
let rules = [];
let goals = [];
let suiviData = {};
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let dashYear = new Date().getFullYear();
let dashMonth = new Date().getMonth();
let selectedDay = null;
let charts = {};
let importPreviewData = [];
let importMatches = [];
let annuelleYear = new Date().getFullYear();
let budgetData = { revenu_mensuel: 0, pct_charges: 50, pct_plaisir: 30, pct_epargne: 20, sub_budget: null, events: [] };
let budgetByMonth = {};       // "YYYY-MM" -> ligne budget_mensuel
let budgetTemplate = { revenu_mensuel: 0, pct_charges: 50, pct_plaisir: 30, pct_epargne: 20 }; // ancien budget_prep = modèle par défaut
let budgetMonth = new Date().getMonth();
let budgetYear = new Date().getFullYear();
let investissements = [];
let goalsList = [];
let contribList = [];
let remboursementsList = [];
let enveloppesList = [];
let dettesList = [];
let coursesList = [];   // 🛒 liste de courses (table courses, SQL-V320)
let _hasSubsubCol = true; // colonne transactions.sub_sub_category présente ? (détecté au chargement, SQL-V321)
// Retire sub_sub_category d'un payload si la colonne n'existe pas encore (évite de casser avant le SQL-V321)
function _sanitizeTx(obj) {
  if (_hasSubsubCol || !obj || !('sub_sub_category' in obj)) return obj;
  const o = { ...obj }; delete o.sub_sub_category; return o;
}
let showAchieved = false;
let showAbandoned = false;
let epargneMonth = new Date().getMonth();
let epargneYear = new Date().getFullYear();

// ═══ MOBILE SIDEBAR ════════════════════════════════════════════
function toggleSidebar() {
  const sb = document.querySelector('.sidebar');
  const ov = $('sidebar-overlay');
  const isOpen = sb.classList.contains('open');
  if (isOpen) { sb.classList.remove('open'); ov.classList.remove('show'); document.body.style.overflow = ''; }
  else { sb.classList.add('open'); ov.classList.add('show'); document.body.style.overflow = 'hidden'; }
}
function closeSidebar() {
  const sb = document.querySelector('.sidebar');
  const ov = $('sidebar-overlay');
  sb.classList.remove('open');
  ov.classList.remove('show');
  document.body.style.overflow = '';
}
// Replier la barre latérale en rail d'icônes (desktop) — logo + icônes gardés, texte masqué
function toggleDesktopSidebar() {
  const mini = document.body.classList.toggle('sidebar-mini');
  try { localStorage.setItem('monie_sidebar_mini', mini ? '1' : '0'); } catch (e) {}
}
// Restaure l'état au chargement
(function initDesktopSidebar() {
  const apply = () => {
    let mini = false;
    try { mini = localStorage.getItem('monie_sidebar_mini') === '1'; } catch (e) {}
    if (mini) document.body.classList.add('sidebar-mini');
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();

// ═══ HELP BANNERS (accordéons) ═════════════════════════════════
function closeHelp(id, ev) {
  // stopper le clic pour ne pas déclencher toggleHelp du parent
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
  try {
    const hidden = JSON.parse(localStorage.getItem('monie_help_hidden') || '[]');
    if (!hidden.includes(id)) { hidden.push(id); localStorage.setItem('monie_help_hidden', JSON.stringify(hidden)); }
  } catch (e) {}
}
function toggleHelp(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('open');
  try {
    const openIds = JSON.parse(localStorage.getItem('monie_help_open') || '[]');
    const isOpen = el.classList.contains('open');
    const filtered = openIds.filter(x => x !== id);
    if (isOpen) filtered.push(id);
    localStorage.setItem('monie_help_open', JSON.stringify(filtered));
  } catch (e) {}
}
function restoreHelpBanners() {
  try {
    const hidden = JSON.parse(localStorage.getItem('monie_help_hidden') || '[]');
    hidden.forEach(id => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); });
    const openIds = JSON.parse(localStorage.getItem('monie_help_open') || '[]');
    openIds.forEach(id => { const el = document.getElementById(id); if (el) el.classList.add('open'); });
  } catch (e) {}
  // Injecter le chevron + rendre le header cliquable + créer la bulle info sœur
  document.querySelectorAll('.help-banner').forEach(banner => {
    const hd = banner.querySelector('.help-banner-hd');
    if (!hd || banner.dataset.wired) return;
    banner.dataset.wired = '1';

    // Récupérer titre pour tooltip
    const titleEl = banner.querySelector('.help-banner-title');
    const tooltipText = titleEl ? titleEl.textContent.trim() : 'Voir l\'aide';

    // Ajouter chevron si pas déjà présent — inséré AVANT la croix
    const closeBtn = hd.querySelector('.help-banner-close');
    if (!hd.querySelector('.help-banner-chevron')) {
      const chev = document.createElement('div');
      chev.className = 'help-banner-chevron';
      chev.textContent = '▾';
      if (closeBtn) hd.insertBefore(chev, closeBtn);
      else hd.appendChild(chev);
    }

    // Remplacer "J'ai compris ✓" par une croix × rouge en gras
    if (closeBtn && closeBtn.textContent.trim() !== '×') {
      closeBtn.innerHTML = '&times;';
      closeBtn.setAttribute('aria-label', 'Masquer cette aide');
      closeBtn.setAttribute('title', 'Masquer cette aide (bulle ℹ️ à gauche pour la rouvrir)');
    }

    hd.addEventListener('click', (e) => {
      if (e.target.closest('.help-banner-close')) return;
      toggleHelp(banner.id);
    });

    // Créer la bulle info sœur, insérée juste avant le banner
    if (!banner.previousElementSibling || !banner.previousElementSibling.classList.contains('help-bubble')) {
      const bubble = document.createElement('button');
      bubble.className = 'help-bubble';
      bubble.setAttribute('data-target', banner.id);
      bubble.setAttribute('aria-label', tooltipText);
      // SVG speech-bubble propre : cercle + queue intégrée + "i" blanc
      bubble.innerHTML = `
        <svg viewBox="0 0 42 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="hb-grad-${banner.id}" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#E76F51"/>
              <stop offset="1" stop-color="#DD7B85"/>
            </linearGradient>
          </defs>
          <path d="M21 2 C10 2 2 9 2 19 C2 27 8 33 15 34 L9 46 L22 33 C32 32 40 26 40 19 C40 9 32 2 21 2 Z" fill="url(#hb-grad-${banner.id})"/>
          <text x="21" y="26" text-anchor="middle" fill="white" font-family="Georgia, serif" font-weight="900" font-style="italic" font-size="22">i</text>
        </svg>
        <span class="help-bubble-tip">${tooltipText}</span>`;
      bubble.addEventListener('click', (ev) => {
        ev.preventDefault();
        const target = document.getElementById(banner.id);
        if (!target) return;
        const isVisible = !target.classList.contains('hidden') && target.classList.contains('open');
        if (isVisible) {
          // Fermer
          target.classList.remove('open');
          try {
            const openIds = JSON.parse(localStorage.getItem('monie_help_open') || '[]');
            localStorage.setItem('monie_help_open', JSON.stringify(openIds.filter(x => x !== banner.id)));
          } catch (e) {}
        } else {
          // Ouvrir (et démasquer si nécessaire)
          target.classList.remove('hidden');
          target.classList.add('open');
          try {
            const hidden = JSON.parse(localStorage.getItem('monie_help_hidden') || '[]');
            localStorage.setItem('monie_help_hidden', JSON.stringify(hidden.filter(x => x !== banner.id)));
            const openIds = JSON.parse(localStorage.getItem('monie_help_open') || '[]');
            if (!openIds.includes(banner.id)) {
              openIds.push(banner.id);
              localStorage.setItem('monie_help_open', JSON.stringify(openIds));
            }
          } catch (e) {}
          target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
      banner.parentNode.insertBefore(bubble, banner);
    }
  });
}

// ═══ HEADER AUTO-HIDE ══════════════════════════════════════════
let _lastScrollY = 0;
let _headerHidden = false;
let _headerAutoHideWired = false;
function initHeaderAutoHide() {
  // Éviter de wire-up plusieurs fois (loadAllData peut être appelé plusieurs fois)
  if (_headerAutoHideWired) return;
  const header = document.querySelector('.mobile-header') || document.querySelector('.header') || document.querySelector('header');
  if (!header) return;
  _headerAutoHideWired = true;

  const getY = () => window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  const threshold = 6; // pixels de tolérance

  const onScroll = () => {
    const y = getY();
    // En haut de page → toujours visible
    if (y < 60) {
      if (_headerHidden) { header.classList.remove('header-hidden'); _headerHidden = false; }
      _lastScrollY = y;
      return;
    }
    const dy = y - _lastScrollY;
    if (dy > threshold && !_headerHidden) {
      header.classList.add('header-hidden');
      _headerHidden = true;
    } else if (dy < -threshold && _headerHidden) {
      header.classList.remove('header-hidden');
      _headerHidden = false;
    }
    _lastScrollY = y;
  };

  // Throttle via requestAnimationFrame
  let ticking = false;
  const throttledScroll = () => {
    if (!ticking) {
      requestAnimationFrame(() => { onScroll(); ticking = false; });
      ticking = true;
    }
  };
  window.addEventListener('scroll', throttledScroll, { passive: true });
  document.addEventListener('scroll', throttledScroll, { passive: true });
  document.body.addEventListener('scroll', throttledScroll, { passive: true });

  // Show on hover (souris en haut d'écran) — desktop
  document.addEventListener('mousemove', (e) => {
    if (e.clientY < 60 && _headerHidden) {
      header.classList.remove('header-hidden');
      _headerHidden = false;
    }
  }, { passive: true });

  // Tap en haut d'écran (mobile) → réafficher le header
  document.addEventListener('touchstart', (e) => {
    if (_headerHidden && e.touches[0] && e.touches[0].clientY < 40) {
      header.classList.remove('header-hidden');
      _headerHidden = false;
    }
  }, { passive: true });
}

// ═══ TOAST + MODAL ═════════════════════════════════════════════
function toast(msg, type = '', dur = 3000) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' toast-' + type : '');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), dur);
}

// Garde générique pour les écritures Supabase : log console + toast rouge en cas d'échec.
// Usage : if (!(await dbGuard(sb.from('x').update(...).eq('id', id), 'Message')).ok) return;
async function dbGuard(query, errMsg = 'Échec de la sauvegarde. Vérifie ta connexion.') {
  try {
    const res = await query;
    if (res && res.error) {
      console.error('[dbGuard]', errMsg, res.error);
      toast(errMsg, 'error');
      return { ok: false, error: res.error, data: null };
    }
    return { ok: true, error: null, data: res ? res.data : null };
  } catch (e) {
    console.error('[dbGuard]', errMsg, e);
    toast(errMsg, 'error');
    return { ok: false, error: e, data: null };
  }
}

// Échappe le HTML pour tout texte venant de l'utilisateur ou d'un import (anti-XSS + évite de casser les attributs).
const _ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => _ESC[c]); }

// Toast avec bouton "Annuler" (undo). Auto-masqué après 5 s. Élément autonome, indépendant du toast classique.
let _undoTimer = null;
function showUndoToast(msg, onUndo) {
  let el = $('undo-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'undo-toast';
    el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;background:var(--ink,#1B2340);color:#fff;padding:11px 14px;border-radius:12px;display:flex;align-items:center;gap:14px;box-shadow:0 8px 24px rgba(0,0,0,.28);font-size:14px;max-width:92vw';
    document.body.appendChild(el);
  }
  el.innerHTML = '<span class="undo-msg"></span><button type="button" style="background:var(--rose,#E76F51);color:#fff;border:none;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer">Annuler</button>';
  el.querySelector('.undo-msg').textContent = msg;
  el.style.display = 'flex';
  const hide = () => { el.style.display = 'none'; };
  clearTimeout(_undoTimer);
  el.querySelector('button').onclick = () => { clearTimeout(_undoTimer); hide(); onUndo(); };
  _undoTimer = setTimeout(hide, 5000);
}

// Pagination + debounce de la liste de transactions
const TX_PAGE = 300;
let txRenderLimit = TX_PAGE;
let _txSearchTimer = null;
function onTxSearchInput() {
  clearTimeout(_txSearchTimer);
  _txSearchTimer = setTimeout(() => { txRenderLimit = TX_PAGE; renderTransactionsList(); }, 220);
}
function onTxFilterChange() { txRenderLimit = TX_PAGE; renderTransactionsList(); }
function loadMoreTx() { txRenderLimit += TX_PAGE; renderTransactionsList(); }

let _modalCb = null;
function openModal(title, msg, cb, bodyHtml = '') {
  set('modal-title', title);
  set('modal-msg', msg);
  $('modal-body').innerHTML = bodyHtml;
  _modalCb = cb;
  const m = $('modal');
  m.classList.add('show');
  m.style.display = 'flex';
  // Wire-up "clic dans le vide" pour fermer (une seule fois)
  if (!m.dataset.backdropWired) {
    m.dataset.backdropWired = '1';
    m.addEventListener('click', (e) => {
      // Ne ferme que si le clic est sur le fond (overlay), pas sur la modal box
      if (e.target === m) closeModal();
    });
  }
}
function closeModal() {
  const m = $('modal');
  m.classList.remove('show');
  m.style.display = 'none';
  _modalCb = null;
}
// Confirmation avant toute suppression définitive (à utiliser partout)
function confirmDelete(msg, onYes) {
  openModal('🗑 Supprimer ?', msg || 'Cette action est définitive. Confirmer la suppression ?', onYes);
}
// Fermeture au clavier (Échap)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const m = $('modal');
    if (m && m.style.display === 'flex') closeModal();
  }
});
async function confirmModal() {
  if (!_modalCb) { closeModal(); return; }
  const btn = $('modal-confirm');
  const originalTxt = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '⏳ ...'; }
  try {
    const result = await Promise.resolve(_modalCb());
    if (result === false) {
      // Callback demande à garder le modal ouvert (validation échouée)
      if (btn) { btn.disabled = false; btn.textContent = originalTxt; }
      return;
    }
    closeModal();
  } catch (err) {
    console.error('modal callback', err);
    toast('Erreur : ' + (err.message || err), 'error');
    if (btn) { btn.disabled = false; btn.textContent = originalTxt; }
  }
}

// Confirmation oui/non basée sur la modale : renvoie true si l'utilisateur confirme, false s'il annule/ferme.
function confirmDialog(title, bodyHtml) {
  return new Promise(resolve => {
    let done = false;
    const m = $('modal');
    const obs = new MutationObserver(() => { if (m.style.display === 'none') finish(false); });
    function finish(v) { if (!done) { done = true; obs.disconnect(); resolve(v); } }
    openModal(title, '', () => finish(true), bodyHtml);
    obs.observe(m, { attributes: true, attributeFilter: ['style', 'class'] });
  });
}

// ═══ AUTH ══════════════════════════════════════════════════════
function switchAuthTab(tab) {
  $('auth-login').style.display = tab === 'login' ? '' : 'none';
  $('auth-signup').style.display = tab === 'signup' ? '' : 'none';
  document.querySelectorAll('.auth-tab').forEach((b, i) => b.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'signup')));
}
async function login() {
  const email = $('login-email').value.trim();
  const pw = $('login-password').value;
  if (!email || !pw) { showAuthErr('login-error', 'Remplis tous les champs'); return; }
  $('btn-login').textContent = 'Connexion…';
  const { error } = await sb.auth.signInWithPassword({ email, password: pw });
  $('btn-login').textContent = 'Se connecter →';
  if (error) showAuthErr('login-error', error.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect' : error.message);
}
async function signup() {
  const email = $('signup-email').value.trim();
  const pw = $('signup-password').value;
  const conf = $('signup-confirm').value;
  if (!email || !pw) { showAuthErr('signup-error', 'Remplis tous les champs'); return; }
  if (pw.length < 6) { showAuthErr('signup-error', 'Mot de passe : 6 caractères minimum'); return; }
  if (pw !== conf) { showAuthErr('signup-error', 'Les mots de passe ne correspondent pas'); return; }
  $('btn-signup').textContent = 'Création…';
  const { error } = await sb.auth.signUp({ email, password: pw });
  $('btn-signup').textContent = 'Créer mon compte →';
  if (error) showAuthErr('signup-error', error.message);
  else { showAuthErr('signup-error', 'Compte créé ! Connecte-toi', 'success'); switchAuthTab('login'); }
}
function showAuthErr(id, msg, type = 'error') {
  const el = $(id);
  el.textContent = msg;
  el.className = 'auth-msg auth-msg-' + type + ' show';
}
async function logout() {
  await sb.auth.signOut();
  currentUser = null;
  transactions = [];
  rules = [];
  goals = [];
  suiviData = {};
  $('auth-screen').style.display = 'flex';
  $('app').style.display = 'none';
}

// ═══ BOOT ══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) await showApp(session.user);
  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user && !currentUser) await showApp(session.user);
    else if (event === 'SIGNED_OUT') {
      currentUser = null;
      $('auth-screen').style.display = 'flex';
      $('app').style.display = 'none';
    }
  });
  setupDragDrop();
});
async function showApp(user) {
  currentUser = user;
  $('auth-screen').style.display = 'none';
  $('app').style.display = 'block';
  const short = user.email.split('@')[0];
  set('user-avatar', short.charAt(0).toUpperCase());
  set('user-email', user.email);
  set('mobile-email', user.email);
  const h = new Date().getHours();
  const greet = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  const capitalized = short.charAt(0).toUpperCase() + short.slice(1);
  set('dash-greeting', `${greet}, ${capitalized} 🌸`);
  set('mobile-greeting', `${greet}, ${capitalized} 🌸`);
  await loadAllData();
  await loadBudgetPrep();
  await loadInvestissements();
  await loadGoals();
  await loadExtra();
  populateYearSelect();
  populateDateSelects();
  renderCalendar();
  renderDashboard();
  populateCategorySelects();
  restoreHelpBanners();
  initHeaderAutoHide();
  budgetStartupAlert();
}

async function loadGoals() {
  const { data, error } = await sb.from('epargne_objectifs').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
  if (error) { console.error('loadGoals', error); return; }
  goalsList = data || [];
  const { data: cdata } = await sb.from('epargne_contributions').select('*').eq('user_id', currentUser.id).order('date_contrib', { ascending: false });
  contribList = cdata || [];
}

async function loadBudgetPrep() {
  // Modèle par défaut = ancienne table budget_prep (utilisé pour pré-remplir un mois vierge)
  const { data: tpl } = await sb.from('budget_prep').select('*').eq('user_id', currentUser.id).maybeSingle();
  if (tpl) budgetTemplate = tpl;
  // Tous les budgets mensuels
  const { data } = await sb.from('budget_mensuel').select('*').eq('user_id', currentUser.id);
  budgetByMonth = {};
  (data || []).forEach(r => { budgetByMonth[r.month.slice(0, 7)] = r; });
  // Migration : l'ancienne ligne plaisir « Alimentation » (restos) devient « Restos & sorties »
  await _migratePlaisirAlim();
  // Positionne sur le mois en cours
  budgetMonth = new Date().getMonth();
  budgetYear = new Date().getFullYear();
  loadBudgetForMonth();
}
// Renomme la ligne budget « Alimentation » du bloc plaisir → « Restos & sorties » (une fois)
async function _migratePlaisirAlim() {
  if (budgetTemplate && budgetTemplate.sub_budget && Array.isArray(budgetTemplate.sub_budget.plaisir)) {
    budgetTemplate.sub_budget.plaisir.forEach(it => { if (it.cat === 'Alimentation') { it.cat = 'Restos & sorties'; delete it.note; } });
  }
  for (const key of Object.keys(budgetByMonth)) {
    const r = budgetByMonth[key];
    const sub = r && r.sub_budget;
    if (!sub || !Array.isArray(sub.plaisir)) continue;
    let changed = false;
    sub.plaisir.forEach(it => { if (it.cat === 'Alimentation') { it.cat = 'Restos & sorties'; if (it.note) delete it.note; changed = true; } });
    if (changed) {
      try { await sb.from('budget_mensuel').update({ sub_budget: sub }).eq('user_id', currentUser.id).eq('month', r.month); } catch (e) { console.error('migration budget', e); }
    }
  }
}
function budgetKey() { return `${budgetYear}-${String(budgetMonth + 1).padStart(2, '0')}`; }
// Charge budgetData depuis le mois sélectionné (ou pré-remplit avec le modèle si vierge)
function loadBudgetForMonth() {
  const saved = budgetByMonth[budgetKey()];
  if (saved) {
    budgetData = { ...saved, events: saved.events || [] };
    const sb2 = budgetData.sub_budget;
    budgetData.pct_imprevus = (sb2 && sb2._pctImprevus) || 0;
    // % décimaux exacts stockés dans le jsonb (les colonnes SQL sont arrondies)
    if (sb2) {
      if (sb2._pctCharges != null) budgetData.pct_charges = Number(sb2._pctCharges);
      if (sb2._pctPlaisir != null) budgetData.pct_plaisir = Number(sb2._pctPlaisir);
      if (sb2._pctEpargne != null) budgetData.pct_epargne = Number(sb2._pctEpargne);
    }
  } else {
    budgetData = {
      revenu_mensuel: budgetTemplate.revenu_mensuel || 0,
      pct_charges: budgetTemplate.pct_charges || 50,
      pct_plaisir: budgetTemplate.pct_plaisir || 30,
      pct_epargne: budgetTemplate.pct_epargne || 20,
      pct_imprevus: 0,
      sub_budget: null,
      events: []
    };
  }
}
// Changement de mois/année via les sélecteurs
function setBudgetMonth() {
  budgetMonth = parseInt($('budget-month-select').value);
  budgetYear = parseInt($('budget-year-select').value);
  loadBudgetForMonth();
  $('bud-revenu').value = budgetData.revenu_mensuel || '';
  $('bud-pct-charges').value = budgetData.pct_charges;
  $('bud-pct-plaisir').value = budgetData.pct_plaisir;
  $('bud-pct-epargne').value = budgetData.pct_epargne;
  if ($('bud-pct-imprevus')) $('bud-pct-imprevus').value = budgetData.pct_imprevus || 0;
  renderBudget();
}
// Copie tout le budget du mois précédent dans le mois affiché
function copyPrevBudget() {
  const pd = new Date(budgetYear, budgetMonth - 1, 1);
  const prevKey = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, '0')}`;
  const prev = budgetByMonth[prevKey];
  if (!prev) { toast('Aucun budget enregistré le mois précédent', 'error'); return; }
  budgetData = {
    revenu_mensuel: prev.revenu_mensuel,
    pct_charges: prev.pct_charges, pct_plaisir: prev.pct_plaisir, pct_epargne: prev.pct_epargne,
    sub_budget: prev.sub_budget ? JSON.parse(JSON.stringify(prev.sub_budget)) : null,
    events: prev.events ? JSON.parse(JSON.stringify(prev.events)) : []
  };
  $('bud-revenu').value = budgetData.revenu_mensuel || '';
  $('bud-pct-charges').value = budgetData.pct_charges;
  $('bud-pct-plaisir').value = budgetData.pct_plaisir;
  $('bud-pct-epargne').value = budgetData.pct_epargne;
  saveBudgetPrepNow();
  renderBudget();
  toast(`Budget de ${prevKey} copié — ajuste si besoin`, 'success');
}
// Supprime le budget enregistré du mois affiché
function deleteBudgetMonth() {
  const key = budgetKey();
  if (!budgetByMonth[key]) { toast('Aucun budget enregistré pour ce mois', 'error'); return; }
  const monthLabel = `${MONTHS[budgetMonth]} ${budgetYear}`;
  openModal('Supprimer ce budget ?', `Le budget de ${monthLabel} sera supprimé définitivement.`, async () => {
    const r = await dbGuard(sb.from('budget_mensuel').delete().eq('user_id', currentUser.id).eq('month', key + '-01'), 'Suppression échouée.');
    if (!r.ok) return;
    delete budgetByMonth[key];
    loadBudgetForMonth(); // repart sur le modèle par défaut
    $('bud-revenu').value = budgetData.revenu_mensuel || '';
    $('bud-pct-charges').value = budgetData.pct_charges;
    $('bud-pct-plaisir').value = budgetData.pct_plaisir;
    $('bud-pct-epargne').value = budgetData.pct_epargne;
    renderBudget();
    toast(`Budget de ${monthLabel} supprimé`, 'success');
  });
}

async function loadInvestissements() {
  const { data } = await sb.from('investissements').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
  investissements = data || [];
}
async function loadAllData() {
  // Supabase limite à 1000 rows par requête → on paginate en batches
  const BATCH = 1000;
  let allTx = [];
  let from = 0;
  while (true) {
    const { data, error } = await sb.from('transactions')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('date_op', { ascending: false })
      .range(from, from + BATCH - 1);
    if (error) { console.error('loadAllData batch', error); break; }
    if (!data || data.length === 0) break;
    allTx = allTx.concat(data);
    if (data.length < BATCH) break; // dernier batch atteint
    from += BATCH;
  }
  transactions = allTx;
  // La colonne sub_sub_category existe-t-elle ? (SQL-V321). Si non, le front s'adapte au lieu de casser.
  try { const c = await sb.from('transactions').select('sub_sub_category').limit(1); _hasSubsubCol = !c.error; } catch (e) { _hasSubsubCol = false; }
  const rulesRes = await sb.from('merchant_rules').select('*').or(`user_id.eq.${currentUser.id},user_id.is.null`).order('priority', { ascending: false });
  rules = rulesRes.data || [];
  await loadProfile();
  console.log(`📊 ${transactions.length} transactions, ${rules.length} règles, profil chargé`);
}
// Charge remboursements / enveloppes / dettes (défensif : si les tables n'existent pas encore, on ignore)
async function loadExtra() {
  try { const r = await sb.from('remboursements').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }); if (!r.error) remboursementsList = r.data || []; } catch (e) {}
  try { const r = await sb.from('enveloppes').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }); if (!r.error) enveloppesList = r.data || []; } catch (e) {}
  try { const r = await sb.from('dettes').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }); if (!r.error) dettesList = r.data || []; } catch (e) {}
  try { const r = await sb.from('courses').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }); if (!r.error) coursesList = r.data || []; } catch (e) {}
}

// 🔄 Force la mise à jour : vide tous les caches + désinscrit le service worker + recharge
async function forceUpdate() {
  try { toast('🔄 Mise à jour…'); } catch (e) {}
  try { if ('caches' in window) { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } } catch (e) {}
  try { if ('serviceWorker' in navigator) { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.unregister())); } } catch (e) {}
  // Recharge en cassant le cache
  location.href = location.pathname + '?v=' + Date.now();
}
// Affiche la version de l'app (témoin de déploiement) dès que possible
(function showAppVersion() {
  const apply = () => { const el = document.getElementById('app-version'); if (el) el.textContent = 'Monie ' + APP_VERSION; };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();

// Appliquer immédiatement le thème mémorisé en localStorage (évite le flash rose)
(function initThemeEarly() {
  try {
    const saved = localStorage.getItem('monie_theme');
    if (saved && ['rose','ocean','foret','nuit','sobre'].includes(saved)) {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch (e) {}
})();

// ═══ TABS ══════════════════════════════════════════════════════
function showTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn, .bnav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  const el = $('tab-' + name);
  if (el) el.classList.add('active');
  // Ferme la sidebar mobile après avoir choisi un onglet
  closeSidebar();
  if (name === 'calendar') renderCalendar();
  if (name === 'dashboard') renderDashboard();
  if (name === 'analyse') renderAnalyse();
  if (name === 'transactions') renderTransactionsList();
  if (name === 'suivi') renderSuivi();
  if (name === 'epargne') renderEpargne();
  if (name === 'annuelle') renderVueAnnuelle();
  if (name === 'budget') renderBudget();
  if (name === 'courses') renderCourses();
  if (name === 'invest') renderInvestissements();
  if (name === 'import') { $('import-preview').style.display = 'none'; }
  if (name === 'profile') renderProfile();
}

// ═══ PROFIL & THÈMES ═══════════════════════════════════════════
let userProfile = null;
const VALID_THEMES = ['rose', 'ocean', 'foret', 'nuit', 'sobre'];

function applyTheme(theme) {
  if (!VALID_THEMES.includes(theme)) theme = 'rose';
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem('monie_theme', theme); } catch (e) {}
  // MAJ theme-color mobile (barre iOS)
  const tc = document.querySelector('meta[name="theme-color"]');
  if (tc) {
    const colors = { rose:'#FDFAF8', ocean:'#F5FAFC', foret:'#FAF9F4', nuit:'#0F172A', sobre:'#F8FAFC' };
    tc.setAttribute('content', colors[theme] || '#FDFAF8');
  }
  // MAJ visuelle du picker
  document.querySelectorAll('.theme-card').forEach(c =>
    c.classList.toggle('selected', c.dataset.theme === theme)
  );
}

async function setTheme(theme) {
  applyTheme(theme);
  if (userProfile) userProfile.theme = theme;
  if (currentUser) {
    await sb.from('profiles').upsert({
      user_id: currentUser.id,
      theme: theme
    }, { onConflict: 'user_id' });
  }
  toast('✓ Thème mis à jour', 'success');
}

async function loadProfile() {
  const { data, error } = await sb.from('profiles').select('*').eq('user_id', currentUser.id).maybeSingle();
  if (error) { console.error('loadProfile', error); return; }
  if (!data) {
    // Créer le profil par défaut à la 1ère connexion
    const defaultName = currentUser.email ? currentUser.email.split('@')[0] : 'Ami·e';
    const { data: newProf } = await sb.from('profiles').insert({
      user_id: currentUser.id,
      display_name: defaultName,
      avatar_emoji: '🌸',
      theme: 'rose',
      show_emojis: true
    }).select().single();
    userProfile = newProf || { display_name: defaultName, avatar_emoji: '🌸', theme: 'rose', show_emojis: true };
  } else {
    userProfile = data;
  }
  applyTheme(userProfile.theme || 'rose');
  renderUserPill();
}

// MAJ visuelle de l'avatar dans la sidebar + le header mobile
function renderUserPill() {
  if (!userProfile) return;
  const nameEl = $('user-name');
  if (nameEl) nameEl.textContent = userProfile.display_name || 'Mon compte';
  const av = $('user-avatar');
  if (av) {
    if (userProfile.avatar_url) {
      av.innerHTML = `<img src="${userProfile.avatar_url}?t=${Date.now()}" alt="avatar">`;
      av.classList.add('has-photo');
    } else {
      av.textContent = userProfile.avatar_emoji || '🌸';
      av.classList.remove('has-photo');
    }
  }
  const greet = $('mobile-greeting');
  if (greet) greet.textContent = `Bonjour, ${userProfile.display_name || ''}`.trim();
}

function renderProfile() {
  if (!userProfile) return;
  const nameInput = $('profile-name');
  if (nameInput) nameInput.value = userProfile.display_name || '';
  const emailInput = $('profile-email');
  if (emailInput && currentUser) emailInput.value = currentUser.email || '';
  const showEmojis = $('profile-show-emojis');
  if (showEmojis) showEmojis.checked = userProfile.show_emojis !== false;

  // Grand preview de l'avatar (photo ou emoji)
  const bigPreview = $('avatar-big-preview');
  const removeBtn = $('avatar-remove-btn');
  if (bigPreview) {
    if (userProfile.avatar_url) {
      bigPreview.innerHTML = `<img src="${userProfile.avatar_url}?t=${Date.now()}" alt="avatar">`;
      if (removeBtn) removeBtn.style.display = '';
    } else {
      bigPreview.textContent = userProfile.avatar_emoji || '🌸';
      if (removeBtn) removeBtn.style.display = 'none';
    }
  }

  // Avatar picker : mettre en selected celui du user
  document.querySelectorAll('.avatar-pick').forEach(b => {
    b.classList.toggle('selected', b.dataset.emoji === (userProfile.avatar_emoji || '🌸'));
    b.onclick = async () => {
      document.querySelectorAll('.avatar-pick').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      userProfile.avatar_emoji = b.dataset.emoji;
      // Si un emoji est sélectionné manuellement et qu'une photo existe → on garde la photo
      // La photo prend priorité tant qu'elle est là.
      if (!userProfile.avatar_url) {
        bigPreview.textContent = b.dataset.emoji;
      }
    };
  });

  // Theme picker : marquer le courant
  document.querySelectorAll('.theme-card').forEach(c =>
    c.classList.toggle('selected', c.dataset.theme === (userProfile.theme || 'rose'))
  );
}

// Redimensionne l'image côté client (canvas) avant upload
function resizeImage(file, maxSize = 400) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        // Contenir dans un carré maxSize x maxSize
        if (width > height) {
          if (width > maxSize) { height *= maxSize / width; width = maxSize; }
        } else {
          if (height > maxSize) { width *= maxSize / height; height = maxSize; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.85);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Recadrage interactif de la photo de profil (pan + zoom → carré 400×400) ───
const _crop = { nw: 0, nh: 0, base: 0, zoom: 1, tx: 0, ty: 0, dragging: false, startX: 0, startY: 0, startTx: 0, startTy: 0, VP: 260 };

function openAvatarCropper(file) {
  if (!file) return;
  if (!currentUser) return;
  if (!file.type.startsWith('image/')) { toast('Ce n\'est pas une image', 'error'); return; }
  if (file.size > 12 * 1024 * 1024) { toast('Image trop lourde (>12 Mo)', 'error'); return; }
  _wireCropper();
  const reader = new FileReader();
  reader.onload = e => {
    const img = $('crop-img');
    img.onload = () => {
      _crop.nw = img.naturalWidth;
      _crop.nh = img.naturalHeight;
      // VP réel = largeur rendue du viewport (peut être réduit sur petit écran)
      const vpEl = $('crop-viewport');
      _crop.VP = vpEl ? vpEl.clientWidth : 260;
      // « cover » : l'image remplit toujours le carré
      _crop.base = Math.max(_crop.VP / _crop.nw, _crop.VP / _crop.nh);
      _crop.zoom = 1;
      const zin = $('crop-zoom');
      if (zin) zin.value = '1';
      // centrer
      const s = _crop.base;
      _crop.tx = (_crop.VP - _crop.nw * s) / 2;
      _crop.ty = (_crop.VP - _crop.nh * s) / 2;
      _applyCropTransform();
    };
    img.src = e.target.result;
    $('crop-modal').style.display = 'flex';
  };
  reader.onerror = () => toast('Lecture de l\'image impossible', 'error');
  reader.readAsDataURL(file);
}

function _applyCropTransform() {
  const s = _crop.base * _crop.zoom;
  const w = _crop.nw * s, h = _crop.nh * s;
  // borner pour que l'image couvre toujours le viewport
  _crop.tx = Math.min(0, Math.max(_crop.VP - w, _crop.tx));
  _crop.ty = Math.min(0, Math.max(_crop.VP - h, _crop.ty));
  const img = $('crop-img');
  if (img) img.style.transform = `translate(${_crop.tx}px, ${_crop.ty}px) scale(${s})`;
}

function _cropPointerDown(ev) {
  _crop.dragging = true;
  const p = ev.touches ? ev.touches[0] : ev;
  _crop.startX = p.clientX; _crop.startY = p.clientY;
  _crop.startTx = _crop.tx; _crop.startTy = _crop.ty;
}
function _cropPointerMove(ev) {
  if (!_crop.dragging) return;
  const p = ev.touches ? ev.touches[0] : ev;
  _crop.tx = _crop.startTx + (p.clientX - _crop.startX);
  _crop.ty = _crop.startTy + (p.clientY - _crop.startY);
  _applyCropTransform();
  if (ev.cancelable) ev.preventDefault();
}
function _cropPointerUp() { _crop.dragging = false; }

// Câblage des évènements (une seule fois)
function _wireCropper() {
  const vp = $('crop-viewport');
  if (!vp || vp.dataset.wired) return;
  vp.dataset.wired = '1';
  vp.addEventListener('mousedown', _cropPointerDown);
  window.addEventListener('mousemove', _cropPointerMove);
  window.addEventListener('mouseup', _cropPointerUp);
  vp.addEventListener('touchstart', _cropPointerDown, { passive: true });
  vp.addEventListener('touchmove', _cropPointerMove, { passive: false });
  vp.addEventListener('touchend', _cropPointerUp);
  const zin = $('crop-zoom');
  if (zin) zin.addEventListener('input', () => {
    // zoom centré sur le milieu du viewport
    const oldS = _crop.base * _crop.zoom;
    const newZoom = parseFloat(zin.value);
    const newS = _crop.base * newZoom;
    const cx = _crop.VP / 2, cy = _crop.VP / 2;
    // garder le point central fixe
    _crop.tx = cx - ((cx - _crop.tx) / oldS) * newS;
    _crop.ty = cy - ((cy - _crop.ty) / oldS) * newS;
    _crop.zoom = newZoom;
    _applyCropTransform();
  });
}

function closeAvatarCropper() {
  const m = $('crop-modal');
  if (m) m.style.display = 'none';
  const inp = $('avatar-file');
  if (inp) inp.value = '';
}

async function confirmAvatarCrop() {
  const OUT = 400;
  const canvas = document.createElement('canvas');
  canvas.width = OUT; canvas.height = OUT;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  const s = _crop.base * _crop.zoom;
  // zone source (en px image) correspondant au carré viewport
  const sx = -_crop.tx / s;
  const sy = -_crop.ty / s;
  const sSize = _crop.VP / s;
  const img = $('crop-img');
  try {
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUT, OUT);
  } catch (e) { toast('Recadrage impossible', 'error'); return; }
  closeAvatarCropper();
  canvas.toBlob(blob => { if (blob) uploadAvatarBlob(blob); }, 'image/jpeg', 0.88);
}

async function uploadAvatarBlob(blob) {
  if (!currentUser || !blob) return;
  toast('📷 Envoi de la photo…');
  try {
    const ext = 'jpg';
    const path = `${currentUser.id}/avatar-${Date.now()}.${ext}`;
    // Supprimer l'ancien avatar avant d'uploader (économise le stockage)
    if (userProfile.avatar_url) {
      try {
        const oldPath = userProfile.avatar_url.split('/avatars/')[1];
        if (oldPath) await sb.storage.from('avatars').remove([oldPath]);
      } catch (e) { console.warn('Cleanup ancien avatar', e); }
    }
    const { error: upErr } = await sb.storage.from('avatars').upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: true
    });
    if (upErr) { toast('Erreur upload : ' + upErr.message, 'error'); return; }
    // Récupérer l'URL publique
    const { data: urlData } = sb.storage.from('avatars').getPublicUrl(path);
    const publicUrl = urlData.publicUrl;
    // Sauvegarder dans le profil
    const { error: profErr } = await sb.from('profiles').upsert({
      user_id: currentUser.id,
      avatar_url: publicUrl
    }, { onConflict: 'user_id' });
    if (profErr) { toast('Erreur profil : ' + profErr.message, 'error'); return; }
    userProfile.avatar_url = publicUrl;
    renderProfile();
    renderUserPill();
    toast('✓ Photo mise à jour', 'success');
  } catch (e) {
    console.error(e);
    toast('Erreur : ' + (e.message || e), 'error');
  } finally {
    const inp = $('avatar-file');
    if (inp) inp.value = ''; // reset pour permettre de re-uploader la même image
  }
}

async function removeAvatar() {
  if (!userProfile || !userProfile.avatar_url) return;
  openModal(
    'Retirer ta photo ?',
    'Ton emoji reprendra sa place. Tu pourras toujours réuploader une nouvelle photo plus tard.',
    async () => {
      try {
        const oldPath = userProfile.avatar_url.split('/avatars/')[1];
        if (oldPath) await sb.storage.from('avatars').remove([oldPath]);
      } catch (e) { console.warn(e); }
      await sb.from('profiles').update({ avatar_url: null }).eq('user_id', currentUser.id);
      userProfile.avatar_url = null;
      renderProfile();
      renderUserPill();
      toast('✓ Photo retirée', 'success');
    }
  );
}

async function saveProfile() {
  if (!currentUser) return;
  const name = $('profile-name').value.trim();
  const showEmojis = $('profile-show-emojis').checked;
  const avatar = userProfile.avatar_emoji || '🌸';
  const { error } = await sb.from('profiles').upsert({
    user_id: currentUser.id,
    display_name: name || null,
    avatar_emoji: avatar,
    show_emojis: showEmojis
  }, { onConflict: 'user_id' });
  if (error) { toast('Erreur : ' + error.message, 'error'); return; }
  userProfile.display_name = name;
  userProfile.avatar_emoji = avatar;
  userProfile.show_emojis = showEmojis;
  // Refresh header
  const nameEl = $('user-name');
  if (nameEl) nameEl.textContent = name || 'Mon compte';
  const av = $('user-avatar');
  if (av) av.textContent = avatar;
  const greet = $('mobile-greeting');
  if (greet) greet.textContent = `Bonjour, ${name}`.trim();
  toast('✓ Profil enregistré', 'success');
}

async function changeEmail() {
  const newEmail = $('profile-email').value.trim();
  if (!newEmail || !newEmail.includes('@')) { toast('Email invalide', 'error'); return; }
  if (newEmail === currentUser.email) { toast('C\'est déjà ton email actuel', 'error'); return; }
  const { error } = await sb.auth.updateUser({ email: newEmail });
  if (error) { toast('Erreur : ' + error.message, 'error'); return; }
  toast('📩 Email de confirmation envoyé — vérifie tes 2 boîtes mail', 'success');
}

async function changePassword() {
  const p1 = $('profile-new-pwd').value;
  const p2 = $('profile-new-pwd2').value;
  if (!p1 || p1.length < 6) { toast('Min. 6 caractères', 'error'); return; }
  if (p1 !== p2) { toast('Les 2 mots de passe ne correspondent pas', 'error'); return; }
  const { error } = await sb.auth.updateUser({ password: p1 });
  if (error) { toast('Erreur : ' + error.message, 'error'); return; }
  $('profile-new-pwd').value = '';
  $('profile-new-pwd2').value = '';
  toast('✓ Mot de passe modifié', 'success');
}

async function requestDeleteAccount() {
  openModal(
    '⚠ Supprimer mon compte',
    'Toutes tes données (transactions, règles, objectifs, investissements) seront effacées définitivement. Cette action est irréversible.',
    async () => {
      // Supprime toutes les données du user (grâce aux ON DELETE CASCADE, l'auth delete ferait tout, mais on ne peut pas delete l'auth user depuis le front)
      const uid = currentUser.id;
      const tables = ['transactions', 'merchant_rules', 'epargne_objectifs', 'epargne_contributions', 'investissements', 'budget_prep', 'tracker_mensuel', 'profiles'];
      for (const tbl of tables) {
        if (!(await dbGuard(sb.from(tbl).delete().eq('user_id', uid), 'Suppression interrompue. Certaines données subsistent, réessaie.')).ok) return;
      }
      await sb.auth.signOut();
      toast('Compte vidé et déconnecté. Contacte-moi pour supprimer définitivement l\'accès.', 'success');
      location.reload();
    }
  );
}

// ─── Populate sélecteurs Calendrier/Dashboard/Annuelle ────────
function populateDateSelects() {
  const years = [];
  const now = new Date().getFullYear();
  for (let y = now + 1; y >= 2020; y--) years.push(y);

  // "-1" = Global (toutes années)
  const buildMonthOpts = (selected) => `<option value="-1" ${selected === -1 ? 'selected' : ''}>🌍 Tous mois</option>` +
    MONTHS.map((m, i) => `<option value="${i}" ${i === selected ? 'selected' : ''}>${m}</option>`).join('');
  const buildYearOpts = (selected) => `<option value="-1" ${selected === -1 ? 'selected' : ''}>🌍 Global (toutes)</option>` +
    years.map(y => `<option value="${y}" ${y === selected ? 'selected' : ''}>${y}</option>`).join('');

  if ($('cal-month-select')) $('cal-month-select').innerHTML = buildMonthOpts(calMonth);
  if ($('cal-year-select')) $('cal-year-select').innerHTML = buildYearOpts(calYear);
  if ($('dash-month-select')) $('dash-month-select').innerHTML = buildMonthOpts(dashMonth);
  if ($('dash-year-select')) $('dash-year-select').innerHTML = buildYearOpts(dashYear);
  if ($('ep-month-select')) $('ep-month-select').innerHTML = buildMonthOpts(epargneMonth);
  if ($('ep-year-select')) $('ep-year-select').innerHTML = buildYearOpts(epargneYear);
  if ($('annuelle-year')) {
    $('annuelle-year').innerHTML = `<option value="-1" ${annuelleYear === -1 ? 'selected' : ''}>🌍 Global (toutes)</option>`;
    years.forEach(y => {
      const o = document.createElement('option');
      o.value = y; o.textContent = y;
      if (y === annuelleYear) o.selected = true;
      $('annuelle-year').appendChild(o);
    });
  }
}

function setCalDate() {
  calMonth = parseInt($('cal-month-select').value);
  calYear = parseInt($('cal-year-select').value);
  selectedDay = null;
  $('day-detail-card').style.display = 'none';
  renderCalendar();
}

function setDashDate() {
  dashMonth = parseInt($('dash-month-select').value);
  dashYear = parseInt($('dash-year-select').value);
  renderDashboard();
}

function setEpDate() {
  epargneMonth = parseInt($('ep-month-select').value);
  epargneYear = parseInt($('ep-year-select').value);
  renderEpargne();
}

// ═══ CATEGORIZE ════════════════════════════════════════════════
const GENERIC = new Set(['prlv sepa', 'vir sepa', 'vir inst', 'virement', 'retrait', 'versement', 'prelevement']);
function categorize(label, amount) {
  if (!label) return { category: 'Autres', sub_category: null };
  const L = label.toLowerCase();
  const L_ns = L.replace(/\s/g, '');
  // Auto virements internes
  if (currentUser && (L.includes(currentUser.email.split('@')[0].toLowerCase()))) {
    return { category: 'Transactions', sub_category: 'Virement interne' };
  }
  // Patterns connus mal classés auparavant
  if (L.includes('action logement') || /versement\s+als/.test(L) || /\bals\d/.test(L)) {
    return { category: 'Aide au logement', sub_category: null };
  }
  if (L.includes('crous') || L.includes('cvec')) {
    return { category: 'Éducation', sub_category: 'CVEC' };
  }
  // Marchands connus (fiabilise les imports + corrige les erreurs récurrentes)
  if (L.includes('aboitie') || L.includes('colombe')) return { category: 'Amis & Famille', sub_category: 'Famille' };
  if (/\bassi\b/.test(L)) return { category: 'Transactions', sub_category: 'Virement interne' };
  if (L.includes('pety')) return { category: 'Loyer', sub_category: null };
  if (L.includes('predica') || L.includes('option system')) return { category: 'Investissements', sub_category: null };
  if (L.includes('direction generale des finances') || L.includes('dgfip') || L.includes('finances pub')) return { category: 'Impôts', sub_category: null };
  if (L.includes('caf du nord') || L.includes('caf nord')) return { category: 'Aide au logement', sub_category: 'CAF' };
  if (L.includes('shein') || L.includes('zalando') || L.includes('asos') || L.includes('na-kd')) return { category: 'Mode', sub_category: null };
  if (L.includes('aliexpress') || L.includes('alibaba')) return { category: 'Mode', sub_category: 'Cheveux / perruques' };
  if (L.includes('apple')) return { category: 'Tech & Électronique', sub_category: null };
  if (L.includes('fnac')) return { category: 'Vie quotidienne', sub_category: 'Papeterie & fournitures' };
  if (L.includes('klarna') || L.includes('scalapay')) return { category: 'Paiement échelonné', sub_category: null };
  if (L.includes('sfr') || L.includes('bouygues telecom')) return { category: 'Abonnements', sub_category: 'Téléphone' };
  if (L.includes('claude') || L.includes('anthropic') || L.includes('perplexity') || L.includes('openai') || L.includes('chatgpt') || L.includes('midjourney')) return { category: 'Abonnements', sub_category: 'IA' };
  if (L.includes('amouan') || L.includes('gnagne') || L.includes('mame diouf') || L.includes('saffo')) return { category: 'Amis & Famille', sub_category: null };
  // Restos / Fast food (marchands connus de Twady)
  if (L.includes('chouchane') || L.includes('snack') || L.includes('djam burger') || L.includes('otacos') || L.includes('burger')) return { category: 'Alimentation', sub_category: 'Fast food' };
  if (L.includes('gelato') || L.includes('philom')) return { category: 'Alimentation', sub_category: 'Restos' };
  if (L.includes('uber eats') || L.includes('deliveroo') || L.includes('franprix') || L.includes('distrifives') || L.includes('legrand primeur') || L.includes('delices exotic') || L.includes('delicesexotic') || L.includes('ovalys') || L.includes('minimarket') || L.includes('boulange')) return { category: 'Alimentation', sub_category: null };
  if (L.includes('flixbus') || L.includes('transpole') || L.includes('ubr') || L.includes('pending.ube')) return { category: 'Transport', sub_category: null };
  // Pass 1: rules spécifiques
  const specifics = rules.filter(r => !r.is_generic).sort((a, b) => b.priority - a.priority || b.pattern.length - a.pattern.length);
  for (const r of specifics) {
    if (L.includes(r.pattern)) {
      if (amount > 0 && r.category === 'Administratif') return { category: 'Remboursements', sub_category: 'Administratif' };
      if (amount > 0 && r.category === 'Banque') return { category: 'Remboursements', sub_category: 'Banque' };
      return { category: r.category, sub_category: r.sub_category };
    }
  }
  // Heuristiques positives
  if (amount > 0) {
    if (/avoir|regul|annul/.test(L)) return { category: 'Remboursements', sub_category: 'Achat marchand' };
    if (/wero|lydia|paylib/.test(L)) return { category: 'Remboursements', sub_category: 'Ami' };
    if (amount >= 500) return { category: 'Salaire', sub_category: null };
    return { category: 'Remboursements', sub_category: 'Ami' };
  }
  // Pass 2: génériques
  const generics = rules.filter(r => r.is_generic);
  for (const r of generics) {
    if (L.includes(r.pattern)) return { category: r.category, sub_category: r.sub_category };
  }
  return { category: 'Autres', sub_category: null };
}
function merchantKey(label) {
  return String(label || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().substring(0, 40);
}
// Détecte le moyen de paiement depuis le libellé (retourne null si indéterminé)
function detectPaymentMethod(label) {
  const L = (label || '').toLowerCase();
  if (/swile|edenred|bimpli|ticket rest|titre.?resto|resto flash|up d\b|sodexo|pluxee/.test(L)) return 'ticket_resto';
  if (/retrait|\bdab\b|distributeur|gab /.test(L)) return 'especes';
  if (/prlv|prelevement|prélèvement/.test(L)) return 'prelevement';
  if (/vir sepa|virement|vir inst|vir\.perm|vir\b/.test(L)) return 'virement';
  if (/ch[eè]que/.test(L)) return 'cheque';
  if (/^carte|\bcb\b|cb\*|paiement cb/.test(L)) return 'carte';
  return null;
}

// ═══ CALENDRIER ════════════════════════════════════════════════
function changeCalMonth(dir) {
  calMonth += dir;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0) { calMonth = 11; calYear--; }
  selectedDay = null;
  $('day-detail-card').style.display = 'none';
  renderCalendar();
}
function renderCalendar() {
  set('cal-month-lbl', MONTHS[calMonth] + ' ' + calYear);
  if ($('cal-month-select')) $('cal-month-select').value = calMonth;
  if ($('cal-year-select')) $('cal-year-select').value = calYear;
  const first = new Date(calYear, calMonth, 1);
  const last = new Date(calYear, calMonth + 1, 0);
  const startDow = (first.getDay() + 6) % 7; // Lundi = 0
  const daysInMonth = last.getDate();
  const grid = $('cal-grid');
  grid.innerHTML = '';

  const today = new Date();
  const monthPrefix = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;
  const monthTx = transactions.filter(t => t.date_op.startsWith(monthPrefix));
  const totalIn = monthTx.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = monthTx.filter(t => t.type === 'sortie').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  set('cal-month-in', '+' + fmt(totalIn));
  set('cal-month-out', '-' + fmt(totalOut));
  const bal = totalIn - totalOut;
  const balEl = $('cal-month-bal');
  balEl.textContent = (bal >= 0 ? '+' : '') + fmt(bal);
  balEl.style.color = bal >= 0 ? 'var(--sage)' : 'var(--tender-rose)';

  // Empty cells before
  for (let i = 0; i < startDow; i++) {
    const d = document.createElement('div');
    d.className = 'cal-day empty';
    grid.appendChild(d);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${monthPrefix}-${String(day).padStart(2, '0')}`;
    const dayTx = monthTx.filter(t => t.date_op === dateStr);
    const dIn = dayTx.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.amount), 0);
    const dOut = dayTx.filter(t => t.type === 'sortie').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
    const d = document.createElement('div');
    d.className = 'cal-day' + (isToday ? ' today' : '') + (selectedDay === dateStr ? ' selected' : '');
    d.dataset.date = dateStr;
    d.onclick = () => selectDay(dateStr);
    d.innerHTML = `<div class="cal-day-num">${day}</div>` +
      (dIn > 0 ? `<div class="cal-day-in">+${Math.round(dIn)}</div>` : '') +
      (dOut > 0 ? `<div class="cal-day-out">-${Math.round(dOut)}</div>` : '');
    grid.appendChild(d);
  }
}
function selectDay(dateStr) {
  selectedDay = dateStr;
  renderCalendar();
  // Petit « pop » sur le jour fraîchement sélectionné (après re-render)
  const cell = document.querySelector(`.cal-day[data-date="${dateStr}"]`);
  if (cell) { cell.classList.remove('day-pop'); void cell.offsetWidth; cell.classList.add('day-pop'); }
  const [y, m, d] = dateStr.split('-');
  const dayLbl = `${parseInt(d)} ${MONTHS[parseInt(m) - 1]} ${y}`;
  set('day-detail-date', dayLbl);
  const dayTx = transactions.filter(t => t.date_op === dateStr);
  const dIn = dayTx.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.amount), 0);
  const dOut = dayTx.filter(t => t.type === 'sortie').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  set('day-detail-summary', `${dayTx.length} opération(s) · +${fmt(dIn)} · -${fmt(dOut)}`);
  const list = $('day-tx-list');
  list.innerHTML = '';
  if (!dayTx.length) {
    list.innerHTML = '<div class="empty"><div class="empty-title">Aucune opération ce jour</div><div class="empty-sub">Ajoute-en une ci-dessous 👇</div></div>';
  } else {
    dayTx.forEach(t => {
      const el = document.createElement('div');
      el.className = 'day-tx-item';
      el.style.cursor = 'pointer';
      el.title = 'Cliquer pour modifier';
      el.onclick = () => openTxEdit(t.id);
      const badge = t.source === 'manual' ? '<span class="tx-source-badge badge-manual">saisi</span>' : '<span class="tx-source-badge badge-import">import</span>';
      const sign = t.type === 'entree' ? '+' : (t.type === 'epargne' ? '' : '-');
      el.innerHTML = `
        <div class="day-tx-icon" style="background:${catColor(t.category)}15;color:${catColor(t.category)}" title="${esc(t.payment_method || 'moyen non précisé')}">${payMethodIcon(t.payment_method) || catIcon(t.category)}</div>
        <div class="day-tx-info">
          <div class="day-tx-label">${esc(t.label)}${badge}</div>
          <div class="day-tx-cat">${esc(t.category)}${t.sub_category ? ' · ' + esc(t.sub_category) : ''}${t.sub_sub_category ? ' · ' + esc(t.sub_sub_category) : ''}</div>
        </div>
        <div class="day-tx-amt ${t.type === 'entree' ? 'amt-in' : t.type === 'epargne' ? 'amt-save' : 'amt-out'}">${sign}${fmtD(Math.abs(Number(t.amount)))}</div>
        <span style="color:var(--rose);font-size:14px;margin-left:6px">✏️</span>
      `;
      list.appendChild(el);
    });
  }
  $('day-detail-card').style.display = 'block';
  document.querySelector('input[name="qa-type"][value="sortie"]').checked = true;
  populateCategorySelects();
  $('day-detail-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ═══ QUICK ADD ═════════════════════════════════════════════════
function populateCategorySelects() {
  const cats = Object.keys(CAT_META).filter(c => c !== 'Salaire' && c !== 'Tickets restaurant' && c !== 'Remboursements');
  const catsEnt = ['Salaire', 'Tickets restaurant', 'Remboursements', 'Autres'];
  const type = document.querySelector('input[name="qa-type"]:checked')?.value || 'sortie';
  const opts = (type === 'sortie' ? cats : catsEnt).map(c => `<option value="${c}">${catIcon(c)} ${c}</option>`).join('');
  $('qa-cat').innerHTML = opts;
  if (typeof updateQaSubcats === 'function') updateQaSubcats();
  updatePayMethodOptions();
  // Filter select
  const catsAll = Object.keys(CAT_META).sort();
  const filtCur = $('tx-filter-cat').value;
  const nTodo = transactions.filter(_txNeedsCat).length;
  $('tx-filter-cat').innerHTML = '<option value="all">Toutes catégories</option>'
    + `<option value="__todo__" ${filtCur === '__todo__' ? 'selected' : ''}>🏷️ À catégoriser${nTodo ? ' (' + nTodo + ')' : ''}</option>`
    + catsAll.map(c => `<option value="${c}" ${filtCur === c ? 'selected' : ''}>${c}</option>`).join('');
}
// ─── 🔔 Alertes intelligentes (dépense inhabituelle, budget dépassé) ───
function computeAlerts() {
  const alerts = [];
  const now = new Date();
  const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  // 1) Dépense inhabituelle ce mois (bien au-dessus de la moyenne de sa catégorie)
  const catSum = {}, catN = {};
  transactions.filter(t => t.type === 'sortie').forEach(t => { catSum[t.category] = (catSum[t.category] || 0) + Math.abs(Number(t.amount)); catN[t.category] = (catN[t.category] || 0) + 1; });
  let big = null;
  transactions.filter(t => t.date_op.startsWith(curKey) && t.type === 'sortie').forEach(t => {
    const a = Math.abs(Number(t.amount));
    const avg = catN[t.category] > 2 ? catSum[t.category] / catN[t.category] : a;
    if (a > 50 && a > avg * 2.5 && (!big || a > big.a)) big = { t, a, avg };
  });
  if (big) alerts.push({ icon: '👀', tone: 'warn', text: `Dépense inhabituelle : <b>${esc(big.t.label)}</b> à ${fmt(big.a)} — d'habitude ~${fmt(big.avg)} en ${esc(big.t.category)}.` });
  // 2) Budget de famille dépassé ce mois
  try {
    const b = computeBudgetStatus();
    if (b && b.rev) {
      [['charges', 'Charges'], ['plaisir', 'Plaisir'], ['imprevus', 'Imprévus']].forEach(([k, lbl]) => {
        if (b.budget[k] > 0 && b.spent[k] > b.budget[k]) alerts.push({ icon: '⚠️', tone: 'danger', text: `Budget <b>${lbl}</b> dépassé : ${fmt(b.spent[k])} / ${fmt(b.budget[k])}.` });
      });
    }
  } catch (e) {}
  return alerts.slice(0, 3);
}
function renderDashAlerts() {
  const el = $('dash-alerts'); if (!el) return;
  let dismissed = false;
  try { dismissed = localStorage.getItem('monie_alerts_dismissed') === new Date().toISOString().slice(0, 10); } catch (e) {}
  if (dismissed) { el.innerHTML = ''; return; }
  const alerts = computeAlerts();
  if (!alerts.length) { el.innerHTML = ''; return; }
  const bg = { warn: 'rgba(232,163,23,0.12)', danger: 'rgba(229,57,53,0.10)', info: 'rgba(127,184,158,0.12)' };
  el.innerHTML = `<div class="card" style="margin-bottom:16px;padding:14px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b style="font-size:13px">🔔 À surveiller</b><button class="btn-ghost" style="padding:4px 10px;font-size:11px" onclick="dismissDashAlerts()">Masquer aujourd'hui</button></div>
    ${alerts.map(a => `<div style="display:flex;gap:10px;padding:8px 10px;border-radius:10px;background:${bg[a.tone] || bg.info};font-size:13px;line-height:1.5;margin-bottom:6px"><span>${a.icon}</span><span>${a.text}</span></div>`).join('')}
  </div>`;
}
function dismissDashAlerts() {
  try { localStorage.setItem('monie_alerts_dismissed', new Date().toISOString().slice(0, 10)); } catch (e) {}
  const el = $('dash-alerts'); if (el) el.innerHTML = '';
}

// ─── 📅 Récap mensuel : on DEMANDE d'abord si le mois est prêt (transactions complètes) ───
let _recapSnoozed = false; // "pas encore" → caché pour la session, reproposé au prochain lancement
function _getRecaps() { try { return JSON.parse(localStorage.getItem('monie_recaps') || '{}'); } catch (e) { return {}; } }
function _recapDone(key) { return !!_getRecaps()[key]; }
function _saveRecap(key, text) {
  try { const r = _getRecaps(); r[key] = { text, date: new Date().toISOString() }; localStorage.setItem('monie_recaps', JSON.stringify(r)); } catch (e) {}
}
function renderDashRecap() {
  const el = $('dash-recap'); if (!el) return;
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastKey = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}`;
  const hasData = transactions.some(t => t.date_op.startsWith(lastKey));
  if (!hasData || _recapDone(lastKey) || _recapSnoozed) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="card" id="dash-recap-card" style="margin-bottom:16px;background:linear-gradient(135deg,var(--lavender-soft),var(--sage-soft));border:none">
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
      <div style="font-size:28px">📅</div>
      <div style="flex:1;min-width:180px">
        <div style="font-weight:800;font-size:15px">${MONTHS[last.getMonth()]} ${last.getFullYear()} est terminé</div>
        <div style="font-size:12px;color:var(--muted)">Tes transactions de ce mois sont-elles <b>complètes et à jour</b> (relevés reçus) ? Si oui, je te fais le récap.</div>
      </div>
      <button class="btn-primary" onclick="generateMonthlyRecap('${lastKey}')">✅ Oui, fais le récap</button>
      <button class="btn-ghost" style="padding:6px 10px;font-size:12px" onclick="snoozeRecap()">⏳ Pas encore</button>
    </div>
    <div id="dash-recap-out" style="margin-top:14px"></div>
  </div>`;
}
function snoozeRecap() { _recapSnoozed = true; const el = $('dash-recap'); if (el) el.innerHTML = ''; toast('Ok, je te reposerai la question plus tard 🌸'); }
// Liste des récaps sauvegardés (page Analyse, en bas)
function renderAnalyseRecaps() {
  const el = $('analyse-recaps'); if (!el) return;
  const recaps = _getRecaps();
  const keys = Object.keys(recaps).sort().reverse();
  if (!keys.length) { el.innerHTML = '<div class="empty-sub">Aucun récap encore. Quand un mois est complet, valide-le depuis le tableau de bord et ton récap s\'enregistrera ici.</div>'; return; }
  el.innerHTML = keys.map(k => {
    const r = recaps[k];
    const lbl = `${MONTHS[parseInt(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;
    return `<details style="border:1px solid var(--border-soft);border-radius:12px;padding:10px 14px;margin-bottom:10px">
      <summary style="cursor:pointer;font-weight:700;font-size:14px;display:flex;justify-content:space-between;align-items:center">
        <span>📅 ${lbl}</span>
        <span style="font-size:11px;color:var(--muted);font-weight:400">enregistré le ${new Date(r.date).toLocaleDateString('fr-FR')}</span>
      </summary>
      <div class="ai-conseils-card" style="margin-top:10px">${aiFmt(r.text)}</div>
      <div style="text-align:right;margin-top:8px"><button class="goal-btn danger" onclick="deleteRecap('${k}')" style="font-size:12px">🗑 Supprimer</button></div>
    </details>`;
  }).join('');
}
function deleteRecap(key) {
  const lbl = `${MONTHS[parseInt(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
  confirmDelete(`Supprimer le récap de ${lbl} ?`, () => {
    try { const r = _getRecaps(); delete r[key]; localStorage.setItem('monie_recaps', JSON.stringify(r)); } catch (e) {}
    renderAnalyseRecaps();
    toast('✓ Récap supprimé', 'success');
  });
}

// ─── 💎 Suivi de patrimoine (net worth, à partir du suivi mensuel) ───
const _NW_FIELDS = ['lcl', 'bourso', 'especes', 'banque_postale', 'autre', 'livret_a', 'ldds', 'assurance_vie', 'esalia', 'investissements'];
function computeNetWorth() {
  if (typeof suiviData !== 'object' || !suiviData) return null;
  const months = Object.keys(suiviData).sort();
  if (!months.length) return null;
  const sumMonth = k => _NW_FIELDS.reduce((s, f) => s + Number((suiviData[k] || {})[f] || 0), 0);
  const cur = months[months.length - 1];
  const prev = months.length > 1 ? months[months.length - 2] : null;
  return { cur, curVal: sumMonth(cur), prevVal: prev != null ? sumMonth(prev) : null, months, sumMonth };
}
function renderPatrimoine() {
  const el = $('dash-patrimoine'); if (!el) return;
  const nw = computeNetWorth();
  if (!nw || !nw.curVal) { el.innerHTML = ''; return; }
  const delta = nw.prevVal != null ? nw.curVal - nw.prevVal : 0;
  const series = nw.months.slice(-12).map(m => Math.round(nw.sumMonth(m)));
  el.innerHTML = `<div class="card" style="margin-bottom:16px;cursor:pointer" onclick="showTab('suivi')" title="Voir le détail dans Suivi mensuel">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <div>
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">💎 Ton patrimoine</div>
        <div style="font-size:26px;font-weight:900;font-family:var(--fm)">${fmt(nw.curVal)}</div>
        <div style="font-size:12px;color:${delta >= 0 ? 'var(--sage)' : 'var(--tender-rose)'}">${nw.prevVal != null ? (delta >= 0 ? '▲ +' : '▼ ') + fmt(delta) + ' vs mois dernier' : 'comptes + épargne + placements'}</div>
      </div>
      <div style="width:170px;height:60px"><canvas id="patrimoine-spark"></canvas></div>
    </div></div>`;
  if (series.length > 1) updateChart('patrimoine-spark', 'line', { labels: series.map(() => ''), datasets: [{ data: series, borderColor: '#7C3F58', backgroundColor: 'rgba(124,63,88,0.12)', borderWidth: 2, tension: 0.4, fill: true, pointRadius: 0 }] }, { scales: { x: { display: false }, y: { display: false } }, plugins: { legend: { display: false }, tooltip: { enabled: false } } });
}
async function generateMonthlyRecap(monthKey) {
  const out = $('dash-recap-out'); if (!out || aiBusy) return;
  aiBusy = true;
  out.innerHTML = '<div class="ai-msg ai-msg-bot ai-typing">Monie prépare ton récap…</div>';
  try {
    const reply = await callMonieAI(
      [{ role: 'user', content: `Fais-moi un récap chaleureux et concret de mon mois : ce qui s'est bien passé, les points de vigilance, et 2 conseils pour le mois prochain. Reste sous 200 mots.` }],
      'conseils',
      { periodType: 'month', month: monthKey }
    );
    out.innerHTML = `<div class="ai-conseils-card">${aiFmt(reply)}</div>`;
    _saveRecap(monthKey, reply);              // sauvegarde → visible dans Analyse
    if (typeof renderAnalyseRecaps === 'function') renderAnalyseRecaps();
  } catch (e) {
    out.innerHTML = `<div class="ai-msg ai-msg-bot">⚠️ ${esc(e.message || 'IA indisponible')}</div>`;
  } finally { aiBusy = false; }
}

// Une opération « à catégoriser » = sans catégorie ou rangée dans « Autres »
function _txNeedsCat(t) { return !t.category || t.category === 'Autres'; }
function showTodoTx() {
  if ($('tx-filter-cat')) $('tx-filter-cat').value = '__todo__';
  if (typeof txRenderLimit !== 'undefined') txRenderLimit = TX_PAGE;
  renderTransactionsList();
}

// Moyens de paiement adaptés selon Sortie / Entrée
const PAY_METHODS_SORTIE = [
  { v: 'carte',       l: '💳 Carte bancaire' },
  { v: 'especes',     l: '💵 Espèces' },
  { v: 'cheque',      l: '📃 Chèque' },
  { v: 'prelevement', l: '🔁 Prélèvement' },
  { v: 'virement',    l: '➡️ Virement' },
  { v: 'ticket_resto',l: '🎫 Titre-restaurant' },
  { v: 'autre',       l: '❔ Autre' }
];
const PAY_METHODS_ENTREE = [
  { v: 'virement',     l: '➡️ Virement (salaire, remboursement…)' },
  { v: 'especes',      l: '💵 Espèces' },
  { v: 'cheque',       l: '📃 Chèque' },
  { v: 'ticket_resto', l: '🎫 Titre-restaurant' },
  { v: 'autre',        l: '❔ Autre' }
];
function updatePayMethodOptions() {
  const sel = $('qa-paymethod');
  if (!sel) return;
  const type = document.querySelector('input[name="qa-type"]:checked')?.value || 'sortie';
  const methods = type === 'entree' ? PAY_METHODS_ENTREE : PAY_METHODS_SORTIE;
  const currentValue = sel.value;
  sel.innerHTML = methods.map(m => `<option value="${m.v}">${m.l}</option>`).join('');
  if (methods.find(m => m.v === currentValue)) {
    sel.value = currentValue;
  } else {
    sel.value = type === 'entree' ? 'virement' : type === 'epargne' ? 'virement' : 'carte';
  }
  const lbl = $('qa-paymethod-label');
  if (lbl) lbl.textContent = type === 'entree' ? 'Reçu par' : type === 'epargne' ? 'Mis de côté via' : 'Payé avec';
  // Type Épargne → afficher le choix « classique / pour un objectif »
  const epBox = $('qa-epargne-box');
  if (epBox) {
    epBox.style.display = type === 'epargne' ? '' : 'none';
    if (type === 'epargne') {
      const sel2 = $('qa-epargne-goal');
      if (sel2 && sel2.options.length <= 1) {
        const actifs = (typeof goalsList !== 'undefined' ? goalsList : []).filter(g => g.statut === 'en_cours');
        sel2.innerHTML = '<option value="">💰 Épargne classique (sans objectif)</option>' +
          actifs.map(g => `<option value="${g.id}">${g.emoji || '🎯'} ${esc(g.nom)}</option>`).join('');
      }
    }
  }
}
document.addEventListener('change', e => {
  if (e.target.matches('input[name="qa-type"]')) populateCategorySelects();
});
// Met à jour le menu déroulant de sous-catégorie du formulaire selon la catégorie choisie
function updateQaSubcats() {
  const cat = $('qa-cat') ? $('qa-cat').value : '';
  const sel = $('qa-subcat');
  if (sel) sel.innerHTML = subcatOptions(cat, '');   // reset : la sous-cat n'a plus de sens si la catégorie change
  updateQaSubsubs();
}
function updateQaSubsubs() {
  const cat = $('qa-cat') ? $('qa-cat').value : '';
  const sub = $('qa-subcat') ? $('qa-subcat').value : '';
  const sel = $('qa-subsub');
  if (sel) sel.innerHTML = subsubOptions(cat, sub, '');
}
// Choix dans le menu sous-catégorie (gère « ➕ Autre… » → saisie libre)
function onQaSubcatChange() {
  const sel = $('qa-subcat'); if (!sel) return;
  if (sel.value === '__custom__') {
    const v = prompt('Nouvelle sous-catégorie :', '');
    const cat = $('qa-cat') ? $('qa-cat').value : '';
    sel.innerHTML = subcatOptions(cat, (v || '').trim());
    if (v) sel.value = v.trim();
  }
  updateQaSubsubs();
}
function onQaBankChange() {
  const sel = $('qa-bank'); if (!sel) return;
  if (sel.value === '__custom__') {
    const v = prompt('Nom de la banque / du compte :', '');
    if (v && v.trim()) {
      const val = v.trim();
      if (![...sel.options].some(o => o.value === val)) {
        const opt = document.createElement('option'); opt.value = val; opt.textContent = val;
        sel.insertBefore(opt, sel.querySelector('option[value="__custom__"]'));
      }
      sel.value = val;
    } else { sel.value = ''; }
  }
}
function onQaSubsubChange() {
  const sel = $('qa-subsub'); if (!sel) return;
  if (sel.value === '__custom__') {
    const v = prompt('Nouvelle sous-sous-catégorie :', '');
    const cat = $('qa-cat') ? $('qa-cat').value : '';
    const sub = $('qa-subcat') ? $('qa-subcat').value : '';
    sel.innerHTML = subsubOptions(cat, sub, (v || '').trim());
    if (v) sel.value = v.trim();
  }
}
async function quickAddTx() {
  if (!selectedDay) { toast('Sélectionne un jour d\'abord', 'error'); return; }
  const label = $('qa-label').value.trim();
  const amount = parseFloat($('qa-amount').value);
  const type = document.querySelector('input[name="qa-type"]:checked').value;
  const category = $('qa-cat').value;
  const subcat = ($('qa-subcat') && $('qa-subcat').value || '').trim() || null;
  const subsubcat = ($('qa-subsub') && $('qa-subsub').value || '').trim() || null;
  const payMethod = $('qa-paymethod') ? $('qa-paymethod').value : null;
  if (!label || !amount || amount <= 0) { toast('Description et montant requis', 'error'); return; }
  // ⚠️ Alerte doublon : une opération du même montant existe déjà à ±3 jours ?
  const absAmt = Math.abs(amount);
  const dup = transactions.find(t => {
    const daysDiff = Math.abs((new Date(t.date_op) - new Date(selectedDay)) / 86400000);
    return Math.abs(Number(t.amount)) === absAmt && daysDiff <= 3;
  });
  if (dup) {
    const ok = await confirmDialog('⚠️ Doublon possible', `
      <div style="font-size:14px;line-height:1.6">
        Une opération de <b>${fmtD(absAmt)}</b> existe déjà le <b>${dup.date_op}</b> :<br>
        <span style="color:var(--muted)">« ${esc(dup.label)} »</span><br><br>
        Ajouter quand même cette nouvelle opération ?
      </div>`);
    if (!ok) { toast('Ajout annulé'); return; }
  }
  const newTx = {
    user_id: currentUser.id,
    date_op: selectedDay,
    label: label,
    amount: type === 'entree' ? amount : -amount,
    type: type,
    category: category,
    sub_category: subcat,
    sub_sub_category: subsubcat,
    source: 'manual',
    merchant_key: merchantKey(label),
    payment_method: payMethod || null,
    bank_source: ($('qa-bank') && $('qa-bank').value) || null
  };
  const { data, error } = await sb.from('transactions').insert(_sanitizeTx(newTx)).select().single();
  if (error) { toast('Erreur : ' + error.message, 'error'); return; }
  transactions.unshift(data);
  // Épargne pour un objectif → alimente la jauge de la page Épargne
  if (type === 'epargne') {
    const goalId = $('qa-epargne-goal') ? $('qa-epargne-goal').value : '';
    if (goalId) { await contributeToGoal(goalId, absAmt); }
  }
  $('qa-label').value = '';
  $('qa-amount').value = '';
  if ($('qa-subcat')) $('qa-subcat').value = '';
  if ($('qa-subsub')) $('qa-subsub').value = '';
  if ($('qa-bank')) $('qa-bank').value = '';
  toast('✓ Ajouté dans le calendrier et les transactions', 'success');
  renderCalendar();
  selectDay(selectedDay);
  if (typeof renderTransactionsList === 'function') renderTransactionsList();
  if (typeof renderDashboard === 'function') renderDashboard();
  if (typeof renderBudgetStatus === 'function') renderBudgetStatus('budget-alert-page', false, (typeof budgetKey === 'function' ? budgetKey() : undefined));
  if (typeof renderEpargne === 'function') renderEpargne();
}
// Ajoute un montant à un objectif d'épargne (met à jour la jauge + trace la contribution)
async function contributeToGoal(goalId, montant) {
  const g = goalsList.find(x => x.id === goalId);
  if (!g) return;
  const oldDeja = Number(g.deja_epargne || 0);
  const newDeja = oldDeja + montant;
  const r = await dbGuard(sb.from('epargne_objectifs').update({ deja_epargne: newDeja }).eq('id', goalId), 'Maj objectif échouée');
  if (!r.ok) return;
  await sb.from('epargne_contributions').insert({ objectif_id: goalId, user_id: currentUser.id, montant });
  g.deja_epargne = newDeja;
  _goalMilestone(g, oldDeja, newDeja);
}
// Retirer / utiliser de l'argent épargné sur un objectif (quand tu dépenses ce que tu as mis de côté)
async function withdrawFromGoal(id) {
  const g = goalsList.find(x => x.id === id); if (!g) return;
  const dispo = Number(g.deja_epargne || 0);
  const v = prompt(`Combien utiliser / retirer de « ${g.nom} » ? (disponible : ${Math.round(dispo)} €)`, '');
  if (v === null) return;
  let montant = parseFloat((v || '').replace(',', '.'));
  if (!(montant > 0)) { toast('Montant invalide', 'error'); return; }
  montant = Math.min(montant, dispo);
  const newDeja = Math.max(0, dispo - montant);
  const r = await dbGuard(sb.from('epargne_objectifs').update({ deja_epargne: newDeja }).eq('id', id), 'Retrait impossible');
  if (!r.ok) return;
  try { await sb.from('epargne_contributions').insert({ objectif_id: id, user_id: currentUser.id, montant: -montant }); } catch (e) {}
  g.deja_epargne = newDeja;
  await loadGoals();
  renderEpargne();
  toast(`✓ ${fmt(montant)} utilisés depuis « ${g.nom} »`, 'success');
}
// Célèbre le franchissement d'un palier (25/50/75/100 %) d'un objectif
function _goalMilestone(g, oldD, newD) {
  const cible = Number(g.cible || 0);
  if (cible <= 0) return;
  const oldPct = oldD / cible * 100, newPct = newD / cible * 100;
  const hit = [25, 50, 75, 100].filter(m => oldPct < m && newPct >= m).pop();
  if (!hit) return;
  toast(hit >= 100 ? `🎉 Objectif « ${g.nom} » ATTEINT ! Bravo 👏` : `🎊 ${hit}% de « ${g.nom} » atteint ! Continue 🌱`, 'success');
  _confettiBurst();
}
function _confettiBurst() {
  try {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#E76F51', '#7FB89E', '#E8B84D', '#9B7FC0', '#DD7B85', '#4FC3F7'];
    for (let i = 0; i < 26; i++) {
      const c = document.createElement('div');
      c.style.cssText = `position:fixed;top:38%;left:50%;width:9px;height:9px;background:${colors[i % colors.length]};border-radius:2px;z-index:99999;pointer-events:none`;
      document.body.appendChild(c);
      const ang = Math.random() * Math.PI * 2, dist = 120 + Math.random() * 200;
      const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 130;
      c.animate([{ transform: 'translate(-50%,-50%) rotate(0)', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) rotate(${Math.random() * 720}deg)`, opacity: 0 }], { duration: 900 + Math.random() * 600, easing: 'cubic-bezier(.2,.6,.4,1)' });
      setTimeout(() => c.remove(), 1600);
    }
  } catch (e) {}
}

// Switch entre les 3 vues du Dashboard : Global / Mensuel / Annuel
function setDashView(view) {
  document.querySelectorAll('.dash-view-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.view === view));
  ['global','mensuel','annuel'].forEach(v => {
    const el = document.getElementById('dash-view-' + v);
    if (el) el.style.display = v === view ? '' : 'none';
  });
  // Si Mensuel ou Annuel choisi : redirige direct vers la vraie page
  if (view === 'mensuel') showTab('suivi');
  else if (view === 'annuel') showTab('annuelle');
}

// Masque/affiche la liste des opérations du jour (pour ne pas occuper toute la place)
function toggleDayList() {
  const list = $('day-tx-list');
  const btn = $('day-tx-toggle');
  if (!list) return;
  const hidden = list.style.display === 'none';
  list.style.display = hidden ? '' : 'none';
  if (btn) btn.textContent = hidden ? 'Masquer la liste' : 'Afficher la liste';
}
// Toggle affichage/masquage du formulaire de saisie rapide (calendrier)
function toggleQuickAdd() {
  const box = document.getElementById('quick-add-box');
  const btn = box ? box.querySelector('.quick-add-toggle') : null;
  if (!box) return;
  const nowCollapsed = box.classList.toggle('collapsed');
  if (btn) btn.setAttribute('aria-expanded', String(!nowCollapsed));
  try { localStorage.setItem('monie_quick_add_open', nowCollapsed ? '0' : '1'); } catch (e) {}
}
// Applique l'état sauvegardé au chargement
(function restoreQuickAddState() {
  const apply = () => {
    try {
      const open = localStorage.getItem('monie_quick_add_open');
      const box = document.getElementById('quick-add-box');
      if (box && open === '0') {
        box.classList.add('collapsed');
        const btn = box.querySelector('.quick-add-toggle');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      }
    } catch (e) {}
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();

// Helper : icône pour un moyen de paiement (utilisé aussi dans Transactions)
function payMethodIcon(pm) {
  const map = {
    carte: '💳', especes: '💵', cheque: '📃',
    prelevement: '🔁', virement: '➡️',
    ticket_resto: '🎫', autre: '❔'
  };
  return map[pm] || '';
}

// ═══ DASHBOARD ═════════════════════════════════════════════════
function changeDashMonth(dir) {
  dashMonth += dir;
  if (dashMonth > 11) { dashMonth = 0; dashYear++; }
  if (dashMonth < 0) { dashMonth = 11; dashYear--; }
  const now = new Date();
  // Empêche futur
  if (dashYear > now.getFullYear() || (dashYear === now.getFullYear() && dashMonth > now.getMonth())) {
    dashMonth = now.getMonth();
    dashYear = now.getFullYear();
  }
  renderDashboard();
}
// Renvoie les transactions dans le périmètre courant du dashboard (même logique que renderDashboard)
function getDashScopeTx() {
  const isGlobalYear = dashYear === -1;
  const isGlobalMonth = dashMonth === -1;
  if (isGlobalYear && isGlobalMonth) return transactions.slice();
  if (isGlobalYear) return transactions.filter(t => parseInt(t.date_op.slice(5, 7)) === dashMonth + 1);
  if (isGlobalMonth) return transactions.filter(t => t.date_op.startsWith(String(dashYear)));
  const monthPrefix = `${dashYear}-${String(dashMonth + 1).padStart(2, '0')}`;
  return transactions.filter(t => t.date_op.startsWith(monthPrefix));
}

// ─── Navigation « fil d'Ariane » dans la fenêtre modale (poste → catégorie → transactions) ───
let _navStack = [];
// nav : 'root' (ou omis) = nouvelle ouverture (réinitialise) · 'push' = on descend d'un niveau · 'back' = retour
function _navEnter(selfThunk, nav) {
  if (nav === 'push') _navStack.push(selfThunk);
  else if (nav === 'back') { /* déjà géré par navBack */ }
  else _navStack = [selfThunk]; // racine
}
function _backBtnHtml() {
  if (_navStack.length <= 1) return '';
  return `<button onclick="navBack()" style="background:transparent;border:1.5px solid var(--border);border-radius:100px;padding:6px 14px;font-size:13px;font-weight:600;color:var(--muted);cursor:pointer;margin-bottom:12px">‹ Précédent</button>`;
}
function navBack() {
  _navStack.pop();
  const prev = _navStack[_navStack.length - 1];
  if (prev) prev(); else closeKpiList();
}
// Ré-affiche la vue courante de la fenêtre (après une modif « réglé »/note, sans changer de niveau)
function _navRefresh() {
  const top = _navStack[_navStack.length - 1];
  const m = $('kpi-modal');
  if (top && m && m.style.display !== 'none') top();
}

// ─── État « réglé ✓ » + note par catégorie (partagé liste ↔ box), stocké dans le budget du mois ───
function _ensureSubBudget() {
  if (!budgetData.sub_budget) budgetData.sub_budget = JSON.parse(JSON.stringify(DEFAULT_SUB_PCT));
  if (!budgetData.sub_budget._catStatus) budgetData.sub_budget._catStatus = {};
  return budgetData.sub_budget;
}
function catStat(cat) {
  const s = budgetData.sub_budget;
  return (s && s._catStatus && s._catStatus[cat]) || {};
}
function toggleCatDone(cat) {
  const sub = _ensureSubBudget();
  const cur = sub._catStatus[cat] || {};
  cur.done = !cur.done;
  sub._catStatus[cat] = cur;
  saveBudgetPrep();
  if (typeof renderBudget === 'function') renderBudget();
  _navRefresh();
}
function editCatNote(cat) {
  const note = prompt(`Petite note pour « ${cat} » :`, catStat(cat).note || '');
  if (note === null) return; // annulé
  const sub = _ensureSubBudget();
  const cur = sub._catStatus[cat] || {};
  cur.note = note.trim();
  sub._catStatus[cat] = cur;
  saveBudgetPrep();
  if (typeof renderBudget === 'function') renderBudget();
  _navRefresh();
}

// ─── Liste éditable des opérations derrière une carte KPI ───
function openKpiList(kind, nav) {
  _navEnter(() => openKpiList(kind, 'back'), nav);
  let scope = getDashScopeTx();
  const titles = { entree: '💚 Entrées', sortie: '🌹 Dépenses', epargne: '🐷 Épargne', all: '📋 Toutes les opérations' };
  if (kind !== 'all') scope = scope.filter(t => t.type === kind);
  scope = scope.slice().sort((a, b) => (a.date_op < b.date_op ? 1 : a.date_op > b.date_op ? -1 : 0));
  const isGlobal = dashYear === -1 || dashMonth === -1;
  const periodLbl = isGlobal ? 'Global (tout l\'historique)' : `${MONTHS[dashMonth]} ${dashYear}`;
  const total = scope.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  set('kpi-modal-title', titles[kind] || 'Opérations');
  set('kpi-modal-sub', `${periodLbl} · ${scope.length} opération${scope.length > 1 ? 's' : ''} · ${fmt(total)}`);
  const list = $('kpi-modal-list');
  if (!scope.length) {
    list.innerHTML = _backBtnHtml() + '<div class="empty-sub" style="padding:20px;text-align:center">Aucune opération sur cette période.</div>';
  } else {
    list.innerHTML = _backBtnHtml() + scope.map(t => {
      const sign = t.type === 'entree' ? '+' : (t.type === 'epargne' ? '' : '-');
      const amtCls = t.type === 'entree' ? 'amt-in' : t.type === 'epargne' ? 'amt-save' : 'amt-out';
      return `<div class="day-tx-item" style="cursor:pointer" onclick="closeKpiList();openTxEdit('${t.id}')" title="Cliquer pour modifier">
        <div class="day-tx-icon" style="background:${catColor(t.category)}18;color:${catColor(t.category)}">${catIcon(t.category)}</div>
        <div class="day-tx-info"><div class="tx-label">${esc(t.label)}</div><div class="tx-cat">${t.date_op.slice(8)}/${t.date_op.slice(5, 7)} · ${esc(t.category || 'Sans catégorie')}</div></div>
        <div class="day-tx-amt ${amtCls}">${sign}${fmtD(Math.abs(Number(t.amount)))}</div>
        <span style="color:var(--rose);font-size:14px;margin-left:6px">✏️</span>
      </div>`;
    }).join('');
  }
  $('kpi-modal').style.display = 'flex';
}
function closeKpiList() { const m = $('kpi-modal'); if (m) m.style.display = 'none'; _navStack = []; }

// ─── 3e bloc « Réel dépensé par postes » (Gestion du budget) : Charges / Plaisir / Épargne ───
function renderRealBlocks() {
  const el = $('bud-real-blocks');
  if (!el) return;
  const key = budgetKey();
  const { spent, budget, especesPrevu, especesSpent } = computeBudgetStatus(key);
  const blocks = [
    { k: 'charges', emoji: '🏠', label: 'Charges & Nécessités', bg: 'var(--tender-rose-soft)', real: spent.charges, bud: budget.charges, isEp: false },
    { k: 'plaisir', emoji: '🌸', label: 'Plaisir & Envies', bg: 'var(--peach-soft)', real: spent.plaisir, bud: budget.plaisir, isEp: false },
    { k: 'imprevus', emoji: '⚡', label: 'Imprévus', bg: 'rgba(232,163,23,0.12)', real: spent.imprevus || 0, bud: budget.imprevus || 0, isEp: false },
    { k: 'epargne', emoji: '🌱', label: 'Épargne & Investissement', bg: 'var(--sage-soft)', real: spent.epargne, bud: budget.epargne, isEp: true }
  ];
  el.innerHTML = blocks.filter(b => b.bud > 0 || b.real > 0).map(b => {
    const pct = b.bud > 0 ? Math.round(b.real / b.bud * 100) : (b.real > 0 ? 100 : 0);
    const over = !b.isEp && b.bud > 0 && b.real > b.bud;
    const barColor = over ? '#E53935' : 'var(--sage)';
    const w = Math.min(100, pct);
    const verb = b.isEp ? 'mis de côté' : 'dépensé';
    const cmp = b.isEp
      ? (b.real >= b.bud ? '🎉 cible atteinte' : `cible ${fmt(b.bud)}`)
      : (over ? `⚠️ dépassé de ${fmt(b.real - b.bud)}` : `reste ${fmt(b.bud - b.real)}`);
    return `<div onclick="openBlockDetail('${b.k}','${key}')" style="cursor:pointer;padding:12px 14px;border-radius:12px;background:${b.bg};margin-bottom:10px" title="Voir le détail de ${b.label}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-weight:800;font-size:14px">${b.emoji} ${b.label} ›</span>
        <span style="font-family:var(--fm);font-weight:800;color:${barColor}">${fmt(b.real)} / ${fmt(b.bud)}</span>
      </div>
      <div style="height:7px;background:rgba(0,0,0,0.07);border-radius:100px;overflow:hidden">
        <div style="height:100%;width:${w}%;background:${barColor};border-radius:100px"></div>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-top:3px">${b.real === 0 ? 'Rien ' + verb + ' pour l\'instant' : cmp}</div>
    </div>`;
  }).join('');
  // 💵 Poche espèces (liquide) — suivi à part, n'affecte pas le budget du compte
  if (especesPrevu > 0 || especesSpent > 0) {
    const resteC = especesPrevu - especesSpent;
    const overC = especesPrevu > 0 && especesSpent > especesPrevu;
    const pctC = especesPrevu > 0 ? Math.round(especesSpent / especesPrevu * 100) : (especesSpent > 0 ? 100 : 0);
    const wC = Math.min(100, pctC);
    const colC = overC ? '#E53935' : 'var(--sage)';
    const noteC = especesPrevu > 0
      ? (overC ? `⚠️ dépassé de ${fmt(especesSpent - especesPrevu)} de liquide` : `reste ${fmt(resteC)} en liquide`)
      : `${fmt(especesSpent)} dépensés en liquide (aucune enveloppe prévue)`;
    el.innerHTML += `<div style="padding:12px 14px;border-radius:12px;background:rgba(127,184,158,0.10);margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-weight:800;font-size:14px">💵 Poche espèces</span>
        <span style="font-family:var(--fm);font-weight:800;color:${colC}">${fmt(especesSpent)} / ${fmt(especesPrevu)}</span>
      </div>
      <div style="height:7px;background:rgba(0,0,0,0.07);border-radius:100px;overflow:hidden">
        <div style="height:100%;width:${wC}%;background:${colC};border-radius:100px"></div>
      </div>
      <div style="font-size:11px;color:${overC ? '#E53935' : 'var(--muted)'};margin-top:3px">${noteC}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px">Suivi à part — ça ne touche pas ton reste à dépenser du compte.</div>
    </div>`;
  }
}

// Détail d'un poste : liste des catégories (charges/plaisir) ou des opérations d'épargne
function openBlockDetail(blockKey, monthKey, nav) {
  _navEnter(() => openBlockDetail(blockKey, monthKey, 'back'), nav);
  const status = computeBudgetStatus(monthKey);
  const meta = { charges: { emoji: '🏠', label: 'Charges' }, plaisir: { emoji: '🌸', label: 'Plaisir' }, epargne: { emoji: '🌱', label: 'Épargne' } }[blockKey] || { emoji: '📊', label: blockKey };
  const mLbl = monthKey ? `${MONTHS[parseInt(monthKey.slice(5, 7)) - 1]} ${monthKey.slice(0, 4)}` : 'toutes périodes';
  const list = $('kpi-modal-list');
  set('kpi-modal-title', `${meta.emoji} ${meta.label}`);

  if (blockKey === 'epargne') {
    let scope = transactions.filter(t => t.type === 'epargne' && (!monthKey || t.date_op.startsWith(monthKey)));
    scope = scope.slice().sort((a, b) => (a.date_op < b.date_op ? 1 : a.date_op > b.date_op ? -1 : 0));
    const total = scope.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    set('kpi-modal-sub', `${mLbl} · ${scope.length} opération(s) · ${fmt(total)} mis de côté`);
    list.innerHTML = _backBtnHtml() + (scope.length ? scope.map(t => `<div class="day-tx-item" style="cursor:pointer" onclick="closeKpiList();openTxEdit('${t.id}')" title="Cliquer pour modifier">
        <div class="day-tx-icon" style="background:${catColor(t.category)}18;color:${catColor(t.category)}">${catIcon(t.category)}</div>
        <div class="day-tx-info"><div class="tx-label">${esc(t.label)}</div><div class="tx-cat">${t.date_op.slice(8)}/${t.date_op.slice(5, 7)} · ${esc(t.category || '')}</div></div>
        <div class="day-tx-amt amt-save">${fmtD(Math.abs(Number(t.amount)))}</div>
      </div>`).join('') : '<div class="empty-sub" style="padding:20px;text-align:center">Aucune épargne enregistrée ce mois.</div>');
    $('kpi-modal').style.display = 'flex';
    return;
  }

  const cats = Object.keys(status.spentByCat).filter(c => BUDGET_BLOCK[c] === blockKey && status.spentByCat[c] > 0);
  const overOf = c => { const b = Math.round(status.budgetByCat[c] || 0); return b > 0 ? Math.round(status.spentByCat[c]) - b : 0; };
  // Les postes EN DÉPASSEMENT d'abord (le plus dépassé en haut), puis le reste par montant
  cats.sort((a, b) => (overOf(b) - overOf(a)) || (status.spentByCat[b] - status.spentByCat[a]));
  const total = cats.reduce((s, c) => s + status.spentByCat[c], 0);
  const overCats = cats.filter(c => overOf(c) > 0);
  const totalOver = overCats.reduce((s, c) => s + overOf(c), 0);
  const noBudCats = cats.filter(c => Math.round(status.budgetByCat[c] || 0) === 0);   // dépensé mais sans ligne de budget
  const totalNoBud = noBudCats.reduce((s, c) => s + Math.round(status.spentByCat[c]), 0);
  set('kpi-modal-sub', `${mLbl} · ${cats.length} catégorie(s) · ${fmt(total)} dépensés`);
  // Bandeau : où ça dépasse
  const overBanner = overCats.length ? `<div style="background:rgba(229,57,53,0.10);border:1px solid #E53935;border-radius:10px;padding:10px 12px;margin-bottom:10px;font-size:13px;line-height:1.5">
      ⚠ <b>Dépassement de ${fmt(totalOver)}</b> sur ce bloc — à cause de : ${overCats.map(c => `<b>${esc(c)}</b> (+${fmt(overOf(c))})`).join(', ')}. Touche un poste rouge pour voir/ajuster.
    </div>` : '';
  // Bandeau : postes HORS BUDGET (dépensé sans ligne prévue)
  const noBudBanner = noBudCats.length ? `<div style="background:rgba(232,184,77,0.18);border:1px solid #E8B84D;border-radius:10px;padding:10px 12px;margin-bottom:10px;font-size:13px;line-height:1.5">
      🟡 <b>Hors budget : ${fmt(totalNoBud)}</b> — pas de ligne prévue pour : ${noBudCats.map(c => `<b>${esc(c)}</b> (${fmt(Math.round(status.spentByCat[c]))})`).join(', ')}. Ajoute-leur une ligne dans « Ta répartition ».
    </div>` : '';
  list.innerHTML = _backBtnHtml() + overBanner + noBudBanner + (cats.length ? cats.map(c => {
    const sp = Math.round(status.spentByCat[c]);
    const bud = Math.round(status.budgetByCat[c] || 0);
    const over = bud > 0 ? sp - bud : 0;
    const noBud = bud === 0;
    const st = catStat(c);
    const cE = esc(c);
    const info = noBud ? '<span style="background:#E8B84D;color:#fff;padding:1px 8px;border-radius:100px;font-weight:700;font-size:11px">🟡 HORS BUDGET</span>'
      : over > 0 ? `<span style="color:#E53935;font-weight:700">⚠ dépassé de ${fmt(over)}</span> · budget ${fmt(bud)}`
      : `${fmt(sp)} / ${fmt(bud)} ✓`;
    const bg = over > 0 ? ';background:rgba(229,57,53,0.05)' : (noBud ? ';background:rgba(232,184,77,0.08)' : '');
    return `<div class="day-tx-item${st.done ? ' done' : ''}" style="cursor:pointer${bg}" onclick="openCatMonthList('${cE}','${monthKey}','push')" title="Voir les opérations ${cE}">
      <div class="day-tx-icon" style="background:${catColor(c)}18;color:${catColor(c)}">${catIcon(c)}</div>
      <div class="day-tx-info"><div class="tx-label">${cE} ›</div><div class="tx-cat">${info}${st.note ? ` · 📝 ${esc(st.note)}` : ''}</div></div>
      <div class="day-tx-amt amt-out"${over > 0 ? ' style="color:#E53935"' : ''}>${fmt(sp)}</div>
      <span onclick="event.stopPropagation();editCatNote('${cE}')" title="Ajouter / modifier une note" style="cursor:pointer;font-size:15px;margin-left:8px;opacity:.7">📝</span>
      <input type="checkbox" class="bud-sub-check" ${st.done ? 'checked' : ''} onclick="event.stopPropagation()" onchange="toggleCatDone('${cE}')" title="C'est réglé ✓" aria-label="Marquer ${cE} comme réglé" style="margin-left:10px">
    </div>`;
  }).join('') : '<div class="empty-sub" style="padding:20px;text-align:center">Aucune dépense dans ce poste ce mois.</div>');
  $('kpi-modal').style.display = 'flex';
}

// Liste éditable des dépenses d'UNE catégorie sur UN mois (clic sur une barre du budget)
function openCatMonthList(cat, monthKey, nav) {
  _navEnter(() => openCatMonthList(cat, monthKey, 'back'), nav);
  let scope = transactions.filter(t => t.type === 'sortie' && t.category === cat && (!monthKey || t.date_op.startsWith(monthKey)));
  scope = scope.slice().sort((a, b) => (a.date_op < b.date_op ? 1 : a.date_op > b.date_op ? -1 : 0));
  const total = scope.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const mLbl = monthKey ? `${MONTHS[parseInt(monthKey.slice(5, 7)) - 1]} ${monthKey.slice(0, 4)}` : 'toutes périodes';
  set('kpi-modal-title', `${catIcon(cat)} ${cat}`);
  set('kpi-modal-sub', `${mLbl} · ${scope.length} opération(s) · ${fmt(total)} dépensés`);

  // Composition du BUDGET de cette catégorie (peut venir de plusieurs sous-lignes)
  const bsrc = (monthKey && budgetByMonth[monthKey]) ? budgetByMonth[monthKey] : (typeof budgetData !== 'undefined' ? budgetData : null);
  const sub = (bsrc && bsrc.sub_budget) ? bsrc.sub_budget : DEFAULT_SUB_PCT;
  const brev = (bsrc && bsrc.revenu_mensuel) ? bsrc.revenu_mensuel : 0;
  const budLines = [];
  let postes = [];
  ['charges', 'plaisir', 'epargne', 'imprevus'].forEach(blk => (sub[blk] || []).forEach(it => {
    if (it.cat === cat) { budLines.push(it); if (Array.isArray(it.subs)) postes = postes.concat(it.subs); }
  }));
  // Réel par sous-catégorie (ce que tu as vraiment dépensé, ventilé)
  const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();  // ignore accents & casse (hygiène = hygiene)
  const realBySub = {}; let realNoSub = 0;
  scope.forEach(t => { const s = (t.sub_category || '').trim(); const a = Math.abs(Number(t.amount)); if (s) realBySub[norm(s)] = (realBySub[norm(s)] || 0) + a; else realNoSub += a; });
  let budHtml = '';
  if (postes.length && brev > 0) {
    // 🎯 Postes budgétés → réel (matché par sous-catégorie) vs budget
    const budNames = new Set(postes.map(p => norm(p.name)));
    const rows = postes.map(p => {
      const bud = Math.round(brev * (p.pct || 0) / 100);
      const real = Math.round(realBySub[norm(p.name)] || 0);
      const over = bud > 0 && real > bud;
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:12px"><span>${esc(p.name || '(poste)')}</span><span style="font-family:var(--fm);font-weight:700;color:${over ? '#E53935' : 'var(--sage)'}">${fmt(real)} / ${fmt(bud)}${over ? ' ⚠' : ''}</span></div>`;
    }).join('');
    const orphans = Object.entries(realBySub).filter(([k]) => k && !budNames.has(k))
      .map(([k, v]) => `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:var(--muted)"><span>${esc(k)} <span style="font-size:10px">· pas de budget</span></span><span style="font-family:var(--fm)">${fmt(Math.round(v))}</span></div>`).join('');
    const noSub = realNoSub > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#B7791F"><span>⚠ sans sous-catégorie</span><span style="font-family:var(--fm)">${fmt(Math.round(realNoSub))}</span></div>` : '';
    budHtml = `<div style="background:var(--peach-soft);border-radius:12px;padding:10px 12px;margin-bottom:12px;font-size:12px">
      <div style="font-weight:800;margin-bottom:5px">🎯 Postes de ${esc(cat)} — réel / budget</div>
      ${rows}${orphans}${noSub}
    </div>`;
  } else if (budLines.length > 1 && brev > 0) {
    const budTotal = budLines.reduce((s, it) => s + brev * (it.pct || 0) / 100, 0);
    budHtml = `<div style="background:var(--peach-soft);border-radius:12px;padding:10px 12px;margin-bottom:12px;font-size:12px;line-height:1.6">
      <div style="font-weight:800;margin-bottom:3px">💡 Ton budget ${esc(cat)} = ${budLines.length} lignes additionnées :</div>
      ${budLines.map(it => `<div style="display:flex;justify-content:space-between"><span>• ${it.note ? esc(it.note) : 'ligne principale'} (${it.pct}%)</span><b style="font-family:var(--fm)">${fmt(brev * it.pct / 100)}</b></div>`).join('')}
      <div style="display:flex;justify-content:space-between;border-top:1px solid rgba(0,0,0,0.08);margin-top:4px;padding-top:4px"><b>Total budget ${esc(cat)}</b><b style="font-family:var(--fm)">${fmt(budTotal)}</b></div>
    </div>`;
  }

  const list = $('kpi-modal-list');
  if (!scope.length) {
    list.innerHTML = _backBtnHtml() + budHtml + '<div class="empty-sub" style="padding:20px;text-align:center">Aucune dépense dans cette catégorie ce mois.</div>';
  } else {
    list.innerHTML = _backBtnHtml() + budHtml + `<div style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin:4px 2px 8px">Dépenses réelles (${fmt(total)})</div>` + scope.map(t => `<div class="day-tx-item" style="cursor:pointer" onclick="closeKpiList();openTxEdit('${t.id}')" title="Cliquer pour modifier / recatégoriser">
        <div class="day-tx-icon" style="background:${catColor(t.category)}18;color:${catColor(t.category)}">${catIcon(t.category)}</div>
        <div class="day-tx-info"><div class="tx-label">${esc(t.label)}</div><div class="tx-cat">${t.date_op.slice(8)}/${t.date_op.slice(5, 7)} · ${esc(t.sub_category || 'sans sous-catégorie')}</div></div>
        <div class="day-tx-amt amt-out">-${fmtD(Math.abs(Number(t.amount)))}</div>
        <span style="color:var(--rose);font-size:14px;margin-left:6px">✏️</span>
      </div>`).join('');
  }
  $('kpi-modal').style.display = 'flex';
}

function renderDashboard() {
  const isGlobalYear = dashYear === -1;
  const isGlobalMonth = dashMonth === -1;
  const isGlobal = isGlobalYear || isGlobalMonth;
  if (typeof renderDashAlerts === 'function') renderDashAlerts();
  if (typeof renderDashRecap === 'function') renderDashRecap();
  if (typeof renderPatrimoine === 'function') renderPatrimoine();
  if (typeof renderGamification === 'function') renderGamification();
  if (typeof applyDashHidden === 'function') applyDashHidden();

  set('dash-month-lbl', isGlobal
    ? '🌍 Global (toutes tes tx)'
    : MONTHS[dashMonth] + ' ' + dashYear);
  if ($('dash-month-select')) $('dash-month-select').value = dashMonth;
  if ($('dash-year-select')) $('dash-year-select').value = dashYear;

  // Indicateurs d'année/période affichés dans les titres des graphes
  if ($('dash-evo-year')) set('dash-evo-year', isGlobalYear ? '· toutes années' : '· ' + dashYear);
  if ($('dash-cat-period')) set('dash-cat-period', isGlobal ? '· Global' : '· ' + MONTHS[dashMonth] + ' ' + dashYear);

  // En mode global : on prend TOUTES les transactions
  let monthTx;
  if (isGlobalYear && isGlobalMonth) {
    monthTx = transactions.slice(); // tout
  } else if (isGlobalYear) {
    monthTx = transactions.filter(t => parseInt(t.date_op.slice(5, 7)) === dashMonth + 1);
  } else if (isGlobalMonth) {
    monthTx = transactions.filter(t => t.date_op.startsWith(String(dashYear)));
  } else {
    const monthPrefix = `${dashYear}-${String(dashMonth + 1).padStart(2, '0')}`;
    monthTx = transactions.filter(t => t.date_op.startsWith(monthPrefix));
  }
  const totalIn = monthTx.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = monthTx.filter(t => t.type === 'sortie').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const bal = totalIn - totalOut;
  animateNumber($('dash-rev'), totalIn, v => fmt(v));
  animateNumber($('dash-dep'), totalOut, v => fmt(v));
  const balEl = $('dash-bal');
  animateNumber(balEl, bal, v => (v >= 0 ? '+' : '') + fmt(v));
  balEl.style.color = bal >= 0 ? 'var(--sage)' : 'var(--tender-rose)';
  set('dash-bal-hint', isGlobal ? (bal >= 0 ? 'Global positif' : 'Global négatif') : (bal >= 0 ? 'Positif ce mois' : 'Négatif ce mois'));
  animateNumber($('dash-count'), monthTx.length, v => String(Math.round(v)));
  set('dash-rev-hint', `${monthTx.filter(t => t.type === 'entree').length} entrées`);
  set('dash-dep-hint', `${monthTx.filter(t => t.type === 'sortie').length} sorties`);

  // ═══ Performance vs M-1 ═══ (désactivée en global)
  const monthPrefix = isGlobal ? '' : `${dashYear}-${String(dashMonth + 1).padStart(2, '0')}`;
  if (!isGlobal) renderPerfCards(monthPrefix, totalIn, totalOut, bal);

  // ═══ Widget "Prochain objectif" ═══
  renderDashGoalWidget();

  // ═══ Suivi du budget du mois ═══
  renderBudgetStatus('budget-alert-dash', true);

  // Évolution : filtre PROPRE au graphe (30j / 6 mois / 12 mois), indépendant du filtre de page.
  const { evoLabels, evoIn, evoOut } = buildEvoSeries(evoRange);
  if ($('dash-evo-range')) $('dash-evo-range').value = evoRange;
  if ($('dash-evo-year')) set('dash-evo-year', evoRange === '30d' ? '· 30 derniers jours' : evoRange === '12m' ? '· 12 derniers mois' : '· 6 derniers mois');
  // Totaux annuels (ou globaux si année=all)
  const yearTx = isGlobalYear ? transactions.slice() : transactions.filter(t => t.date_op.startsWith(String(dashYear)));
  const yearIn = yearTx.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.amount), 0);
  const yearOut = yearTx.filter(t => t.type === 'sortie').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const yearBal = yearIn - yearOut;
  if ($('dash-year-total-rev')) set('dash-year-total-rev', fmt(yearIn));
  if ($('dash-year-total-dep')) set('dash-year-total-dep', fmt(yearOut));
  if ($('dash-year-total-bal')) {
    const el = $('dash-year-total-bal');
    el.textContent = (yearBal >= 0 ? '+' : '') + fmt(yearBal);
    el.style.color = yearBal >= 0 ? 'var(--sage)' : 'var(--tender-rose)';
  }
  if ($('dash-year-display')) set('dash-year-display', isGlobalYear ? '🌍 Global' : dashYear);
  updateChart('chart-evolution', 'line', {
    labels: evoLabels,
    datasets: [
      { label: 'Revenus', data: evoIn, borderColor: '#7FB89E', backgroundColor: 'rgba(127,184,158,0.1)', borderWidth: 2, tension: 0.35, fill: true },
      { label: 'Dépenses', data: evoOut, borderColor: '#DD7B85', backgroundColor: 'rgba(221,123,133,0.1)', borderWidth: 2, tension: 0.35, fill: true }
    ]
  }, {
    plugins: { legend: { display: true, position: 'top', labels: { color: '#718096', font: { size: 11 } } } },
    scales: { x: { ticks: { color: '#A0AEC0' }, grid: { display: false } }, y: { ticks: { color: '#A0AEC0', callback: v => v.toLocaleString('fr-FR') + ' €' }, grid: { color: '#F5E7EA' } } }
  });

  // Répartition (mois courant) — 2 vues : Blocs (Charges/Plaisir/Épargne) ou Détail catégories
  if ($('dash-cat-view')) $('dash-cat-view').value = catChartView;
  const leg = $('cat-legend');
  if (catChartView === 'blocks') {
    const BLK_COL = { charges: '#DD7B85', plaisir: '#E8B84D', imprevus: '#E8A317', epargne: '#9B7FC0' };
    const BLK_LBL = { charges: '🏠 Charges', plaisir: '🎈 Plaisir', imprevus: '⚡ Imprévus', epargne: '🐷 Épargne' };
    const blk = { charges: 0, plaisir: 0, imprevus: 0, epargne: 0 };
    monthTx.forEach(t => {
      const a = Math.abs(Number(t.amount));
      if (t.type === 'epargne') { blk.epargne += a; return; }
      if (t.type !== 'sortie') return;
      const b = txBlock(t);
      if (b === 'charges') blk.charges += a;
      else if (b === 'plaisir') blk.plaisir += a;
      else if (b === 'imprevus') blk.imprevus += a;
      else if (b === 'epargne') blk.epargne += a;
      else blk.charges += a; // catégories non mappées → considérées comme charges
    });
    const order = ['charges', 'plaisir', 'imprevus', 'epargne'].filter(k => blk[k] > 0);
    const totalBlk = order.reduce((s, k) => s + blk[k], 0);
    updateChart('chart-categories', 'doughnut', {
      labels: order.map(k => BLK_LBL[k]),
      datasets: [{ data: order.map(k => blk[k]), backgroundColor: order.map(k => BLK_COL[k]), borderWidth: 0 }]
    }, { plugins: { legend: { display: false } }, cutout: '65%' });
    leg.innerHTML = order.map(k => {
      const pct = totalBlk ? Math.round(blk[k] / totalBlk * 100) : 0;
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:12px;border-bottom:1px solid var(--border-soft)">
        <span style="width:10px;height:10px;border-radius:2px;background:${BLK_COL[k]}"></span>
        <span style="flex:1">${BLK_LBL[k]}</span>
        <span style="font-family:var(--fm);color:var(--muted)">${fmt(blk[k])} · ${pct}%</span>
      </div>`;
    }).join('') || '<div class="empty-sub">Aucun mouvement ce mois</div>';
  } else {
    const catTotals = {};
    monthTx.filter(t => t.type === 'sortie').forEach(t => {
      catTotals[t.category] = (catTotals[t.category] || 0) + Math.abs(Number(t.amount));
    });
    const entries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    updateChart('chart-categories', 'doughnut', {
      labels: entries.map(e => e[0]),
      datasets: [{ data: entries.map(e => e[1]), backgroundColor: entries.map(e => catColor(e[0])), borderWidth: 0 }]
    }, { plugins: { legend: { display: false } }, cutout: '65%' });
    leg.innerHTML = entries.slice(0, 6).map(([cat, val]) => `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:12px;border-bottom:1px solid var(--border-soft)">
        <span style="width:10px;height:10px;border-radius:2px;background:${catColor(cat)}"></span>
        <span style="flex:1">${catIcon(cat)} ${cat}</span>
        <span style="font-family:var(--fm);color:var(--muted)">${fmt(val)}</span>
      </div>
    `).join('') || '<div class="empty-sub">Aucune sortie ce mois</div>';
  }

  // ═══ Tendance des dépenses par catégorie (catégories choisies par l'utilisateur) ═══
  renderCatTrend();

  // Top dépenses — tableau avec drapeau budget (dans le budget / dépassement du poste)
  const topExp = $('top-expenses');
  const deps = monthTx.filter(t => t.type === 'sortie');
  const sortedTx = deps.slice().sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 10);
  if (!sortedTx.length) {
    topExp.innerHTML = '<div class="empty"><div class="empty-title">Aucune dépense ce mois</div></div>';
  } else {
    // Budget par poste : uniquement pertinent sur un mois précis (pas en mode global)
    const budgetByCat = isGlobal ? {} : computeBudgetStatus(monthPrefix).budgetByCat;
    // Dépenses du mois triées chronologiquement → pour le cumul par catégorie « au moment de l'ajout »
    const chrono = deps.slice().sort((a, b) => (a.date_op < b.date_op ? -1 : a.date_op > b.date_op ? 1 : (a.id > b.id ? 1 : -1)));
    const cumBefore = {}; // cumul par catégorie AVANT chaque tx (dans l'ordre chrono)
    const cumAt = {};     // cumul incluant la tx, mémorisé par id
    chrono.forEach(t => {
      const c = txBudgetCat(t);
      const before = cumBefore[c] || 0;
      const after = before + Math.abs(Number(t.amount));
      cumAt[t.id] = after;
      cumBefore[c] = after;
    });
    const rows = sortedTx.map(t => {
      const bud = budgetByCat[txBudgetCat(t)];
      let flag = '<span style="color:var(--muted)">—</span>';
      if (bud && bud > 0) {
        const over = cumAt[t.id] > bud;
        flag = over
          ? `<span title="Poste dépassé (budget ${fmtD(bud)})" style="color:var(--tender-rose);font-weight:700">↑ dépassé</span>`
          : `<span title="Dans le budget (${fmtD(bud)})" style="color:var(--sage);font-weight:700">↓ ok</span>`;
      }
      return `<tr onclick="openTxEdit('${t.id}')" style="cursor:pointer">
        <td style="color:var(--muted);white-space:nowrap">${t.date_op.slice(8)}/${t.date_op.slice(5, 7)}</td>
        <td><span style="display:inline-flex;align-items:center;gap:6px"><span style="color:${catColor(t.category)}">${catIcon(t.category)}</span> ${esc(t.label)}</span></td>
        <td style="color:var(--muted);white-space:nowrap">${esc(t.category)}</td>
        <td class="amt-out" style="text-align:right;font-family:var(--fm);white-space:nowrap">-${fmtD(Math.abs(Number(t.amount)))}</td>
        <td style="text-align:right;white-space:nowrap">${flag}</td>
      </tr>`;
    }).join('');
    topExp.innerHTML = `<table class="mini-table">
      <thead><tr>
        <th>Date</th><th>Libellé</th><th>Catégorie</th><th style="text-align:right">Montant</th><th style="text-align:right">Budget</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }
}
function updateChart(id, type, data, opts = {}) {
  const canvas = $(id);
  if (!canvas) return;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(canvas, { type, data, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, ...opts.plugins }, ...opts } });
}

// ─── Évolution : filtre propre au graphe (rolling, indépendant du filtre de page) ───
let evoRange = (() => { try { return localStorage.getItem('monie_evo_range') || '6m'; } catch (e) { return '6m'; } })();
function setEvoRange(r) {
  evoRange = r;
  try { localStorage.setItem('monie_evo_range', r); } catch (e) {}
  renderDashboard();
}
function _sumIn(arr) { return arr.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.amount), 0); }
function _sumOut(arr) { return arr.filter(t => t.type === 'sortie').reduce((s, t) => s + Math.abs(Number(t.amount)), 0); }
function buildEvoSeries(range) {
  const evoLabels = [], evoIn = [], evoOut = [];
  const now = new Date();
  if (range === '30d') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      evoLabels.push(`${d.getDate()}/${d.getMonth() + 1}`);
      const dtx = transactions.filter(t => t.date_op === key);
      evoIn.push(_sumIn(dtx)); evoOut.push(_sumOut(dtx));
    }
  } else {
    const n = range === '12m' ? 12 : 6;
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      evoLabels.push(MONTHS_SHORT[d.getMonth()] + (n === 12 ? ' ' + String(d.getFullYear()).slice(2) : ''));
      const mtx = transactions.filter(t => t.date_op.startsWith(key));
      evoIn.push(_sumIn(mtx)); evoOut.push(_sumOut(mtx));
    }
  }
  return { evoLabels, evoIn, evoOut };
}

// ─── Graphe « Par catégorie » : bascule Blocs (Charges/Plaisir/Épargne) ↔ Détail ───
let catChartView = (() => { try { return localStorage.getItem('monie_cat_view') || 'blocks'; } catch (e) { return 'blocks'; } })();
function setCatView(v) {
  catChartView = v;
  try { localStorage.setItem('monie_cat_view', v); } catch (e) {}
  renderDashboard();
}

// ─── Graphe « Tendance des dépenses » : menu déroulant, 1 catégorie (défaut Alimentation) ───
let catTrendCat = (() => { try { return localStorage.getItem('monie_cat_trend_cat') || 'Alimentation'; } catch (e) { return 'Alimentation'; } })();
function setCatTrend(cat) {
  catTrendCat = cat;
  try { localStorage.setItem('monie_cat_trend_cat', cat); } catch (e) {}
  renderCatTrend();
}
function renderCatTrend() {
  const isGlobalYear = (typeof dashYear !== 'undefined') && dashYear === -1;
  // Périodes = 12 mois de l'année, ou par année en mode Global (comme le graphe d'évolution)
  const periods = [];
  if (isGlobalYear) {
    [...new Set(transactions.map(t => t.date_op.slice(0, 4)))].sort().forEach(y => periods.push({ label: y, match: t => t.date_op.startsWith(y) }));
  } else {
    for (let m = 0; m < 12; m++) {
      const key = `${dashYear}-${String(m + 1).padStart(2, '0')}`;
      periods.push({ label: MONTHS_SHORT[m], match: t => t.date_op.startsWith(key) });
    }
  }
  const scope = isGlobalYear ? transactions : transactions.filter(t => t.date_op.startsWith(String(dashYear)));
  const spend = scope.filter(t => t.type === 'sortie');
  if ($('cat-trend-year')) set('cat-trend-year', isGlobalYear ? '· toutes années' : '· ' + dashYear);

  // Toutes les catégories de dépense (sur tout l'historique) → options stables du menu
  const allTotals = {};
  transactions.filter(t => t.type === 'sortie').forEach(t => { allTotals[t.category] = (allTotals[t.category] || 0) + Math.abs(Number(t.amount)); });
  const allSpendCats = Object.entries(allTotals).sort((a, b) => b[1] - a[1]).map(e => e[0]).filter(Boolean);

  // Catégorie sélectionnée : celle mémorisée si elle existe, sinon Alimentation, sinon la 1re
  let cat = catTrendCat;
  if (!allSpendCats.includes(cat)) cat = allSpendCats.includes('Alimentation') ? 'Alimentation' : (allSpendCats[0] || '');
  catTrendCat = cat;

  // Menu déroulant
  const selEl = $('cat-trend-select');
  if (selEl) {
    selEl.innerHTML = allSpendCats.map(c => `<option value="${esc(c)}" ${c === cat ? 'selected' : ''}>${catIcon(c)} ${esc(c)}</option>`).join('');
    selEl.value = cat;
  }

  const col = catColor(cat);
  const datasets = cat ? [{
    label: cat,
    data: periods.map(p => spend.filter(t => t.category === cat && p.match(t)).reduce((s, t) => s + Math.abs(Number(t.amount)), 0)),
    borderColor: col, backgroundColor: col + '18', borderWidth: 2.5, tension: 0.35, pointRadius: 2, pointHoverRadius: 4, fill: true
  }] : [];
  updateChart('chart-cat-trend', 'line', {
    labels: periods.map(p => p.label),
    datasets
  }, {
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#A0AEC0' }, grid: { display: false } },
      y: { ticks: { color: '#A0AEC0', callback: v => v.toLocaleString('fr-FR') + ' €' }, grid: { color: '#F5E7EA' } }
    }
  });
}

// ═══ PAGE ANALYSE ══════════════════════════════════════════════
const ANALYSE_PALETTE = ['#E76F51', '#7FB89E', '#F4A993', '#7C3F58', '#E8B84D', '#DD7B85', '#B79CD6', '#4FC3F7', '#A0AEC0', '#D8B4DD'];
function _populateAnalyseMonths() {
  const mSel = $('analyse-month'); if (!mSel) return;
  const cur = mSel.value;
  mSel.innerHTML = '<option value="-1">Toute l\'année</option>' + MONTHS.map((m, i) => `<option value="${String(i + 1).padStart(2, '0')}">${m}</option>`).join('');
  mSel.value = [...mSel.options].some(o => o.value === cur) ? cur : '-1';
}
function onAnalyseYearChange() { _populateAnalyseMonths(); renderAnalyse(); }
function renderAnalyse() {
  const ySel = $('analyse-year');
  if (ySel && ySel.options.length === 0) {
    const years = [...new Set(transactions.map(t => t.date_op.slice(0, 4)))].sort().reverse();
    ySel.innerHTML = '<option value="-1">🌍 Toutes années</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
    ySel.value = years[0] || '-1';
    _populateAnalyseMonths();
  }
  const yr = ySel ? ySel.value : '-1';
  const isGlobal = yr === '-1';
  const mSel = $('analyse-month');
  let mo = mSel ? mSel.value : '-1';
  // Le mois n'a de sens que sur une année précise
  if (mSel) { mSel.disabled = isGlobal; if (isGlobal) { mo = '-1'; mSel.value = '-1'; } }
  const singleMonth = !isGlobal && mo !== '-1';
  const scope = isGlobal ? transactions
    : (singleMonth ? transactions.filter(t => t.date_op.startsWith(`${yr}-${mo}`)) : transactions.filter(t => t.date_op.startsWith(yr)));
  const exp = scope.filter(t => t.type === 'sortie' && t.category !== 'Transactions');
  const totalIn = scope.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = exp.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const months = new Set(scope.map(t => t.date_op.slice(0, 7))).size || 1;

  // ── KPIs éducatifs ──
  // Épargne = les transactions de TYPE « épargne » (ce qui rentre vraiment en épargne). Ni dépense, ni revenu.
  const epargne = scope.filter(t => t.type === 'epargne').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const solde = totalIn - totalOut - epargne;
  const tauxEp = totalIn > 0 ? Math.round(epargne / totalIn * 100) : 0;
  // 1 · Taux d'épargne
  set('an-taux', tauxEp + '%');
  set('an-taux-hint', tauxEp >= 20 ? 'Excellent 🎯' : tauxEp >= 10 ? 'Correct' : 'À muscler');
  // Nombre de jours de référence si un mois précis est choisi
  let dref = 0;
  if (singleMonth) {
    const y = parseInt(yr), m = parseInt(mo);
    const now = new Date();
    const isCur = y === now.getFullYear() && (m - 1) === now.getMonth();
    dref = isCur ? now.getDate() : new Date(y, m, 0).getDate();
  }
  // 2 · Épargné sur la période
  set('an-ep', fmt(Math.round(epargne)));
  set('an-ep-hint', singleMonth ? 'ce mois-ci' : `${fmt(Math.round(epargne / months))}/mois`);
  // 3 · Reste à vivre (adapte le libellé si mois précis)
  if (singleMonth) { set('an-rav-label', 'Reste ce mois'); set('an-rav', fmt(Math.round(solde))); set('an-rav-hint', 'revenus − dépenses − épargne'); }
  else { set('an-rav-label', 'Reste à vivre /mois'); set('an-rav', fmt(Math.round(solde / months))); set('an-rav-hint', 'en moyenne'); }
  // 4 · Dépense moyenne /mois OU /jour (si un mois précis est sélectionné)
  if (singleMonth) { set('an-depmoy-label', 'Dépense moy. /jour'); set('an-depmoy', fmt(Math.round(totalOut / Math.max(1, dref)))); set('an-depmoy-hint', `sur ${dref} jour(s)`); }
  else { set('an-depmoy-label', 'Dépense moy. /mois'); set('an-depmoy', fmt(Math.round(totalOut / months))); set('an-depmoy-hint', `sur ${months} mois`); }
  // 5 · Poste n°1 (catégorie de dépense la plus lourde)
  const catTot = {};
  exp.forEach(t => { catTot[t.category] = (catTot[t.category] || 0) + Math.abs(Number(t.amount)); });
  const top1 = Object.entries(catTot).sort((a, b) => b[1] - a[1])[0];
  if (top1) { set('an-top', `${catIcon(top1[0])} ${top1[0]}`); set('an-top-hint', `${fmt(Math.round(top1[1]))} · ${totalOut > 0 ? Math.round(top1[1] / totalOut * 100) : 0}% des dépenses`); }
  else { set('an-top', '—'); set('an-top-hint', 'aucune dépense'); }
  // 6 · Part « plaisir »
  let ch = 0, pl = 0;
  exp.forEach(t => { const b = txBlock(t); if (b === 'charges') ch += Math.abs(Number(t.amount)); if (b === 'plaisir') pl += Math.abs(Number(t.amount)); });
  const plPct = (ch + pl) > 0 ? Math.round(pl / (ch + pl) * 100) : 0;
  set('an-ratio', plPct + '%');
  const abo = exp.filter(t => t.category === 'Abonnements').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  // ── Zoom catégorie → sous-catégories ──
  const cSel = $('analyse-cat');
  const expCats = [...new Set(exp.map(t => t.category))];
  if (cSel && cSel.options.length === 0) {
    cSel.innerHTML = EXP_CATS.filter(c => expCats.includes(c)).map(c => `<option value="${c}">${catIcon(c)} ${c}</option>`).join('');
    cSel.value = expCats.includes('Alimentation') ? 'Alimentation' : (cSel.options[0] ? cSel.options[0].value : '');
  }
  const cat = cSel ? cSel.value : 'Alimentation';
  const catTx = exp.filter(t => t.category === cat);
  const subTotals = {};
  catTx.forEach(t => { const s = t.sub_category || '(sans sous-catégorie)'; subTotals[s] = (subTotals[s] || 0) + Math.abs(Number(t.amount)); });
  const subEntries = Object.entries(subTotals).sort((a, b) => b[1] - a[1]);
  const catTotal = subEntries.reduce((s, e) => s + e[1], 0);
  // Répartition par moyen de paiement (pour cette catégorie)
  const PM_FR = { carte: '💳 Carte', especes: '💵 Espèces', ticket_resto: '🎫 Ticket resto', cheque: '📃 Chèque', prelevement: '🔁 Prélèvement', virement: '➡️ Virement', autre: '❔ Non précisé' };
  const pmTotals = {};
  catTx.forEach(t => { const pm = t.payment_method || 'autre'; pmTotals[pm] = (pmTotals[pm] || 0) + Math.abs(Number(t.amount)); });
  const pmEntries = Object.entries(pmTotals).sort((a, b) => b[1] - a[1]);
  updateChart('analyse-donut', 'doughnut', {
    labels: subEntries.map(e => e[0]),
    datasets: [{ data: subEntries.map(e => e[1]), backgroundColor: subEntries.map((e, i) => ANALYSE_PALETTE[i % ANALYSE_PALETTE.length]), borderWidth: 0 }]
  }, { plugins: { legend: { display: false } }, cutout: '60%' });
  const subHtml = subEntries.map(([s, v], i) => `
      <div style="display:flex;align-items:center;gap:8px;padding:7px 0;font-size:13px;border-bottom:1px solid var(--border-soft)">
        <span style="width:10px;height:10px;border-radius:2px;background:${ANALYSE_PALETTE[i % ANALYSE_PALETTE.length]};flex-shrink:0"></span>
        <span style="flex:1">${esc(s)}</span>
        <span style="font-family:var(--fm);font-weight:700">${fmt(v)}</span>
        <span style="color:var(--muted);font-size:11px;min-width:40px;text-align:right">${catTotal > 0 ? Math.round(v / catTotal * 100) : 0}%</span>
      </div>`).join('') || '<div class="empty-sub">Aucune dépense sur cette période</div>';
  const pmHtml = pmEntries.length ? `<div style="font-weight:800;font-size:13px;margin:16px 0 6px">💳 Par moyen de paiement</div>` + pmEntries.map(([pm, v]) => `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px;border-bottom:1px solid var(--border-soft)">
        <span style="flex:1">${PM_FR[pm] || ('❔ ' + esc(pm))}</span>
        <span style="font-family:var(--fm);font-weight:700">${fmt(v)}</span>
        <span style="color:var(--muted);font-size:11px;min-width:40px;text-align:right">${catTotal > 0 ? Math.round(v / catTotal * 100) : 0}%</span>
      </div>`).join('') : '';
  $('analyse-sublist').innerHTML = `<div style="font-weight:800;font-size:15px;margin-bottom:10px">${catIcon(cat)} ${esc(cat)} — ${fmt(catTotal)}</div>` + subHtml + pmHtml;

  // ── 📊 Graphe : répartition par famille (donut) ──
  const FAM_COL = { charges: '#DD7B85', plaisir: '#E8B84D', imprevus: '#E8A317', epargne: '#9B7FC0' };
  const FAM_LBL = { charges: '🏠 Charges', plaisir: '🎈 Plaisir', imprevus: '⚡ Imprévus', epargne: '🐷 Épargne' };
  const famTot = { charges: 0, plaisir: 0, imprevus: 0, epargne: 0 };
  scope.forEach(t => {
    const a = Math.abs(Number(t.amount));
    if (t.type === 'epargne') { famTot.epargne += a; return; }
    if (t.type !== 'sortie' || t.category === 'Transactions') return;
    const b = txBlock(t);
    if (famTot[b] !== undefined) famTot[b] += a; else famTot.charges += a;
  });
  const famOrder = ['charges', 'plaisir', 'imprevus', 'epargne'].filter(k => famTot[k] > 0);
  const famTotal = famOrder.reduce((s, k) => s + famTot[k], 0);
  if (typeof updateChart === 'function') updateChart('an-family-chart', 'doughnut', { labels: famOrder.map(k => FAM_LBL[k]), datasets: [{ data: famOrder.map(k => famTot[k]), backgroundColor: famOrder.map(k => FAM_COL[k]), borderWidth: 0 }] }, { plugins: { legend: { display: false } }, cutout: '62%' });
  if ($('an-family-legend')) $('an-family-legend').innerHTML = famOrder.map(k => { const pct = famTotal ? Math.round(famTot[k] / famTotal * 100) : 0; return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:12px;border-bottom:1px solid var(--border-soft)"><span style="width:10px;height:10px;border-radius:2px;background:${FAM_COL[k]}"></span><span style="flex:1">${FAM_LBL[k]}</span><span style="font-family:var(--fm);color:var(--muted)">${fmt(famTot[k])} · ${pct}%</span></div>`; }).join('') || '<div class="empty-sub">Aucun mouvement</div>';

  // ── 📈 Graphe : dépenses dans le temps (par an / mois / jour selon la sélection) ──
  const evoLabels = [], evoData = [];
  const sumOutKey = key => Math.round(transactions.filter(t => t.type === 'sortie' && t.category !== 'Transactions' && t.date_op.startsWith(key)).reduce((s, t) => s + Math.abs(Number(t.amount)), 0));
  if (isGlobal) {
    [...new Set(transactions.map(t => t.date_op.slice(0, 4)))].sort().forEach(y => { evoLabels.push(y); evoData.push(sumOutKey(y)); });
    set('an-evo-lbl', '· par année');
  } else if (singleMonth) {
    const y = parseInt(yr), m = parseInt(mo), days = new Date(y, m, 0).getDate();
    for (let d = 1; d <= days; d++) { evoLabels.push(String(d)); evoData.push(sumOutKey(`${yr}-${mo}-${String(d).padStart(2, '0')}`)); }
    set('an-evo-lbl', '· par jour');
  } else {
    for (let m = 0; m < 12; m++) { evoLabels.push(MONTHS_SHORT[m]); evoData.push(sumOutKey(`${yr}-${String(m + 1).padStart(2, '0')}`)); }
    set('an-evo-lbl', '· par mois');
  }
  if (typeof updateChart === 'function') updateChart('an-evo-chart', 'bar', { labels: evoLabels, datasets: [{ data: evoData, backgroundColor: '#E76F51', borderRadius: 4, borderSkipped: false }] }, { plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#A0AEC0', autoSkip: true, maxRotation: 0 }, grid: { display: false } }, y: { ticks: { color: '#A0AEC0', callback: v => v.toLocaleString('fr-FR') + ' €' }, grid: { color: '#F5E7EA' } } } });

  // Les conseils sont désormais générés par l'IA (bouton « 🤖 Analyse IA »).
  renderRulesList();
  if (typeof renderAnalyseRecaps === 'function') renderAnalyseRecaps();
  if (typeof _populateBrandDatalist === 'function') _populateBrandDatalist();
  if (typeof renderBrandFocus === 'function') renderBrandFocus();
}

// ─── Éditeur de règles de catégorisation (marchand → catégorie) ───
function renderRulesList() {
  const el = $('rules-list');
  if (!el) return;
  const mine = (rules || []).filter(r => r.user_id === currentUser.id && r.id).sort((a, b) => (b.priority || 0) - (a.priority || 0));
  if (!mine.length) {
    el.innerHTML = '<div class="empty-sub" style="padding:16px 0">Aucune règle perso pour l\'instant. Crée-en une, ou ré-catégorise une opération depuis la page Transactions — une règle sera proposée automatiquement.</div>';
    return;
  }
  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px">` + mine.map(r => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border-soft);border-radius:12px;background:var(--card)">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600">« ${esc(r.pattern)} » → <span style="color:${catColor(r.category)}">${catIcon(r.category)} ${esc(r.category)}</span>${r.sub_category ? ` · ${esc(r.sub_category)}` : ''}</div>
        <div style="font-size:11px;color:var(--muted)">${r.is_generic ? 'générique' : 'prioritaire'} · priorité ${r.priority || 0}</div>
      </div>
      <button class="goal-btn" onclick="openRuleForm('${r.id}')" title="Modifier">✏️</button>
      <button class="goal-btn danger" onclick="deleteRule('${r.id}')" title="Supprimer">🗑️</button>
    </div>`).join('') + `</div>
    <button class="btn-ghost" onclick="recategorizeAllTx()" style="margin-top:14px">🔄 Ré-appliquer mes règles à tout l'historique</button>`;
}

function openRuleForm(id) {
  const catSel = $('rule-category');
  if (catSel) catSel.innerHTML = Object.keys(CAT_META).sort().map(c => `<option value="${c}">${catIcon(c)} ${c}</option>`).join('');
  const r = id ? (rules || []).find(x => x.id === id) : null;
  set('rule-modal-title', r ? 'Modifier la règle' : 'Nouvelle règle');
  $('rule-id').value = r ? r.id : '';
  $('rule-pattern').value = r ? r.pattern : '';
  if (catSel) catSel.value = r ? r.category : 'Alimentation';
  $('rule-subcat').value = r && r.sub_category ? r.sub_category : '';
  $('rule-generic').checked = r ? !!r.is_generic : false;
  $('rule-modal').style.display = 'flex';
}
function closeRuleForm() { const m = $('rule-modal'); if (m) m.style.display = 'none'; }

async function saveRuleForm() {
  const id = $('rule-id').value;
  const pattern = ($('rule-pattern').value || '').trim().toLowerCase();
  const category = $('rule-category').value;
  const sub_category = ($('rule-subcat').value || '').trim() || null;
  const is_generic = $('rule-generic').checked;
  if (pattern.length < 3) { toast('Le texte à repérer doit faire au moins 3 caractères', 'error'); return; }
  const payload = { user_id: currentUser.id, pattern, category, sub_category, is_generic, priority: is_generic ? 50 : 200 };
  let res;
  if (id) res = await dbGuard(sb.from('merchant_rules').update(payload).eq('id', id).select(), 'Maj règle échouée');
  else res = await dbGuard(sb.from('merchant_rules').upsert(payload, { onConflict: 'pattern' }).select(), 'Création règle échouée');
  if (!res.ok) return;
  const row = res.data && res.data[0];
  if (row) {
    rules = (rules || []).filter(r => r.id !== row.id && r.pattern !== row.pattern);
    rules.push(row);
  }
  closeRuleForm();
  toast('✓ Règle enregistrée', 'success');
  renderRulesList();
}

async function deleteRule(id) {
  const r = (rules || []).find(x => x.id === id);
  openModal('Supprimer cette règle ?', r ? `« ${r.pattern} » → ${r.category}` : '', async () => {
    const res = await dbGuard(sb.from('merchant_rules').delete().eq('id', id), 'Suppression échouée');
    if (!res.ok) return;
    rules = (rules || []).filter(x => x.id !== id);
    toast('✓ Règle supprimée', 'success');
    renderRulesList();
  });
}

// Ré-applique la catégorisation (règles incluses) à tout l'historique — ne met à jour que ce qui change.
async function recategorizeAllTx() {
  openModal('Ré-appliquer les règles ?', 'Toutes tes opérations seront reclassées selon tes règles actuelles. Les catégories que tu as fixées à la main seront elles aussi recalculées.', async () => {
    const changed = [];
    transactions.forEach(t => {
      if (t.type !== 'sortie') return; // on ne reclasse que les dépenses (les revenus/épargne gardent leur poste)
      const { category, sub_category } = categorize(t.label, Number(t.amount));
      if (category !== t.category || (sub_category || null) !== (t.sub_category || null)) {
        changed.push({ id: t.id, category, sub_category: sub_category || null });
      }
    });
    if (!changed.length) { toast('Rien à changer — tout est déjà à jour', 'success'); return; }
    toast(`🔄 Mise à jour de ${changed.length} opération(s)…`);
    let ok = 0;
    for (let i = 0; i < changed.length; i += 40) {
      const chunk = changed.slice(i, i + 40);
      await Promise.all(chunk.map(async c => {
        const r = await sb.from('transactions').update({ category: c.category, sub_category: c.sub_category }).eq('id', c.id);
        if (!r.error) {
          ok++;
          const tx = transactions.find(x => x.id === c.id);
          if (tx) { tx.category = c.category; tx.sub_category = c.sub_category; }
        }
      }));
    }
    toast(`✓ ${ok} opération(s) reclassée(s)`, 'success');
    renderAnalyse();
    if (typeof renderDashboard === 'function') renderDashboard();
  });
}

// ═══ TRANSACTIONS LIST ═════════════════════════════════════════
// ═══ ÉDITION DES TRANSACTIONS (page "Transactions") ═════════════
let txSelectedIds = new Set();

function renderTransactionsList() {
  set('tx-total-count', transactions.length);
  const search = $('tx-search') ? $('tx-search').value.toLowerCase() : '';
  const filtCat = $('tx-filter-cat') ? $('tx-filter-cat').value : 'all';
  const filtYear = $('tx-filter-year') ? $('tx-filter-year').value : 'all';
  const filtMonth = $('tx-filter-month') ? $('tx-filter-month').value : 'all';
  const filtDate = $('tx-filter-date') ? $('tx-filter-date').value : '';
  const filtSub = $('tx-filter-subcat') ? $('tx-filter-subcat').value : 'all';

  // Peuple les selects year/month à partir des données réelles
  if ($('tx-filter-year') && $('tx-filter-year').options.length <= 1) {
    const years = [...new Set(transactions.map(t => t.date_op.slice(0, 4)))].sort().reverse();
    $('tx-filter-year').innerHTML = '<option value="all">Toutes années</option>' +
      years.map(y => `<option value="${y}">${y}</option>`).join('');
  }
  if ($('tx-filter-month') && $('tx-filter-month').options.length <= 1) {
    $('tx-filter-month').innerHTML = '<option value="all">Tous mois</option>' +
      MONTHS.map((m, i) => `<option value="${String(i + 1).padStart(2, '0')}">${m}</option>`).join('');
  }
  // Peuple le filtre sous-catégorie à partir des données réelles (dépend de la catégorie choisie)
  if ($('tx-filter-subcat')) {
    const subs = [...new Set(transactions
      .filter(t => filtCat === 'all' || t.category === filtCat)
      .map(t => (t.sub_category || '').trim()).filter(Boolean))].sort();
    const cur = $('tx-filter-subcat').value;
    $('tx-filter-subcat').innerHTML = '<option value="all">Toutes sous-cat.</option><option value="__none__">— sans sous-catégorie —</option>' +
      subs.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
    if ([...$('tx-filter-subcat').options].some(o => o.value === cur)) $('tx-filter-subcat').value = cur;
  }

  const allFiltered = transactions.filter(t => {
    if (filtCat === '__todo__') { if (!_txNeedsCat(t)) return false; }
    else if (filtCat !== 'all' && t.category !== filtCat) return false;
    if (filtYear !== 'all' && !t.date_op.startsWith(filtYear)) return false;
    if (filtMonth !== 'all' && t.date_op.slice(5, 7) !== filtMonth) return false;
    if (filtDate && t.date_op !== filtDate) return false;
    if (filtSub === '__none__' && (t.sub_category || '').trim()) return false;
    if (filtSub !== 'all' && filtSub !== '__none__' && (t.sub_category || '').trim() !== filtSub) return false;
    if (search && !(t.label.toLowerCase().includes(search) || (t.sub_category || '').toLowerCase().includes(search))) return false;
    return true;
  });
  const filtered = allFiltered.slice(0, txRenderLimit);
  // Sync compteur : combien de tx correspondent aux filtres
  set('tx-filter-count', `${allFiltered.length} tx filtrée(s)`);
  const list = $('tx-list-all');
  const cats = Object.keys(CAT_META);
  const catOptions = cats.map(c => `<option value="${c}">${catIcon(c)} ${c}</option>`).join('');

  // Bulk bar si sélection
  let bulkHtml = '';
  if (txSelectedIds.size > 0) {
    bulkHtml = `
      <div class="bulk-bar floating">
        <span class="bulk-bar-count">${txSelectedIds.size}</span>
        <span class="bulk-bar-label">sélectionnée(s)</span>
        <div class="bulk-bar-actions">
          <select class="bulk-select" id="tx-bulk-cat">
            <option value="">Choisir une catégorie…</option>
            ${catOptions}
          </select>
          <button class="bulk-btn" onclick="applyTxBulkCategory()">✓ Appliquer</button>
          <input type="date" class="bulk-select" id="tx-bulk-date" title="Nouvelle date pour la sélection" style="min-width:auto">
          <button class="bulk-btn" onclick="applyTxBulkDate()">📅 Dater</button>
          <button class="bulk-btn" onclick="mergeTxSelection()" title="Fusionner en une seule transaction (ex: Courses Leclerc)">🔀 Fusionner</button>
          <button class="bulk-btn danger" onclick="deleteTxBulkSelection()">🗑 Supprimer</button>
          <button class="bulk-btn" onclick="clearTxSelection()">Annuler</button>
        </div>
      </div>`;
  }

  // Bandeau « file à catégoriser »
  const nTodo = transactions.filter(_txNeedsCat).length;
  let todoBanner = '';
  if (nTodo > 0 && filtCat !== '__todo__') {
    todoBanner = `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:12px;background:rgba(232,163,23,0.12);margin-bottom:12px;font-size:13px">
      <span>🏷️</span><span style="flex:1"><b>${nTodo}</b> opération(s) à catégoriser (rangées dans « Autres »).</span>
      <button class="btn-ghost" style="padding:6px 12px;font-size:12px" onclick="showTodoTx()">Traiter →</button>
    </div>`;
  } else if (filtCat === '__todo__') {
    todoBanner = `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:12px;background:rgba(127,184,158,0.12);margin-bottom:12px;font-size:13px">
      <span>🏷️</span><span style="flex:1">${nTodo ? `File à catégoriser — ${nTodo} restante(s). Change la catégorie de chaque ligne.` : '🎉 Rien à catégoriser, tout est rangé !'}</span>
      <button class="btn-ghost" style="padding:6px 12px;font-size:12px" onclick="clearTxFilters()">Voir tout</button>
    </div>`;
  }

  if (!filtered.length) { list.innerHTML = bulkHtml + todoBanner + '<div class="empty"><div class="empty-title">Aucune transaction</div></div>'; return; }

  const allChecked = filtered.every(t => txSelectedIds.has(t.id));
  const PM_SHORT = { carte: 'Carte', especes: 'Espèces', ticket_resto: 'Ticket resto', cheque: 'Chèque', prelevement: 'Prélèvement', virement: 'Virement' };
  const typeSign = t => t.type === 'entree' ? '+' : (t.type === 'epargne' ? '' : '-');
  const typeCls = t => t.type === 'entree' ? 'amt-in' : (t.type === 'epargne' ? 'amt-save' : 'amt-out');
  list.innerHTML = bulkHtml + todoBanner + `
    <div class="tx-table-wrap">
    <table class="tx-table">
      <thead><tr>
        <th style="width:34px"><input type="checkbox" class="tx-checkbox" onchange="toggleAllTxVisible(this.checked)" ${allChecked ? 'checked' : ''} title="${allChecked ? 'Tout désélectionner' : 'Tout sélectionner'}"></th>
        <th style="width:88px">Date</th>
        <th>Libellé</th>
        <th style="width:190px">Catégorie</th>
        <th style="width:150px">Sous-catégorie</th>
        <th style="width:150px">Sous-sous-cat.</th>
        <th style="width:110px">Moyen</th>
        <th style="width:110px;text-align:right">Montant</th>
        <th style="width:74px;text-align:right">Actions</th>
      </tr></thead>
      <tbody>
      ${filtered.map(t => {
        const isSelected = txSelectedIds.has(t.id);
        const catsSel = catOptionsGrouped(t.category);
        const famT = catFamily(t.category);
        return `
        <tr class="${isSelected ? 'selected' : ''}">
          <td><input type="checkbox" class="tx-checkbox" ${isSelected ? 'checked' : ''} onchange="toggleTxSelect('${t.id}', this.checked)"></td>
          <td style="white-space:nowrap;color:var(--muted)">${t.date_op.slice(8)}/${t.date_op.slice(5, 7)}/${t.date_op.slice(2, 4)}</td>
          <td><div class="tx-cell-label">${esc(t.label)} ${bankBadge(t.bank_source)}${sourceBadge(t.source)}</div></td>
          <td>
            <select class="select tx-cat-select" onchange="recategorizeTx('${t.id}', this.value)">${catsSel}</select>
            <div style="font-size:10px;color:var(--muted);margin-top:2px">${famT ? 'famille : ' + FAMILY_LABEL[famT] : ''}</div>
          </td>
          <td><select class="select tx-subcat-select" onchange="onSubcatSelect('${t.id}', this.value)" title="Choisis ou ajoute une sous-catégorie" style="width:100%;padding:5px 8px;font-size:12px">${subcatOptions(t.category, t.sub_category)}</select></td>
          <td><select class="select tx-subsub-select" onchange="onSubsubSelect('${t.id}', this.value)" title="Choisis ou ajoute une sous-sous-catégorie" style="width:100%;padding:5px 8px;font-size:12px" ${(t.sub_category || '').trim() ? '' : 'disabled'}>${subsubOptions(t.category, t.sub_category, t.sub_sub_category)}</select></td>
          <td style="white-space:nowrap;color:var(--muted);font-size:12px" title="${esc(t.payment_method || 'non précisé')}">${payMethodIcon(t.payment_method) || ''} ${PM_SHORT[t.payment_method] || '—'}</td>
          <td class="${typeCls(t)}" style="text-align:right;font-family:var(--fm);white-space:nowrap">${typeSign(t)}${fmtD(Math.abs(Number(t.amount)))}</td>
          <td style="text-align:right;white-space:nowrap">
            <button class="import-del-btn" onclick="openTxEdit('${t.id}')" title="Modifier" style="color:var(--rose)">✏️</button>
            <button class="import-del-btn" onclick="deleteTx('${t.id}')" title="Supprimer">✕</button>
          </td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>
    </div>
    ${allFiltered.length > txRenderLimit ? `<button type="button" onclick="loadMoreTx()" style="display:block;margin:16px auto;padding:10px 22px;border:none;border-radius:10px;background:var(--rose,#E76F51);color:#fff;font-weight:700;cursor:pointer">Charger plus (${allFiltered.length - txRenderLimit} restantes)</button>` : ''}`;
}

function toggleTxSelect(id, checked) {
  if (checked) txSelectedIds.add(id);
  else txSelectedIds.delete(id);
  renderTransactionsList();
}
function toggleAllTxVisible(checked) {
  const search = $('tx-search') ? $('tx-search').value.toLowerCase() : '';
  const filtCat = $('tx-filter-cat') ? $('tx-filter-cat').value : 'all';
  const filtYear = $('tx-filter-year') ? $('tx-filter-year').value : 'all';
  const filtMonth = $('tx-filter-month') ? $('tx-filter-month').value : 'all';
  const filtDate = $('tx-filter-date') ? $('tx-filter-date').value : '';
  const filtered = transactions.filter(t => {
    if (filtCat !== 'all' && t.category !== filtCat) return false;
    if (filtYear !== 'all' && !t.date_op.startsWith(filtYear)) return false;
    if (filtMonth !== 'all' && t.date_op.slice(5, 7) !== filtMonth) return false;
    if (filtDate && t.date_op !== filtDate) return false;
    if (search && !t.label.toLowerCase().includes(search)) return false;
    return true;
  }).slice(0, 300);
  filtered.forEach(t => checked ? txSelectedIds.add(t.id) : txSelectedIds.delete(t.id));
  renderTransactionsList();
}
function clearTxSelection() { txSelectedIds.clear(); renderTransactionsList(); }

function clearTxFilters() {
  ['tx-search','tx-filter-date'].forEach(id => { if ($(id)) $(id).value = ''; });
  ['tx-filter-cat','tx-filter-subcat','tx-filter-year','tx-filter-month'].forEach(id => { if ($(id)) $(id).value = 'all'; });
  txRenderLimit = TX_PAGE;
  renderTransactionsList();
  toast('✓ Filtres réinitialisés');
}

function exportTxCsv() {
  const search = $('tx-search') ? $('tx-search').value.toLowerCase() : '';
  const filtCat = $('tx-filter-cat') ? $('tx-filter-cat').value : 'all';
  const filtYear = $('tx-filter-year') ? $('tx-filter-year').value : 'all';
  const filtMonth = $('tx-filter-month') ? $('tx-filter-month').value : 'all';
  const filtDate = $('tx-filter-date') ? $('tx-filter-date').value : '';
  const filtered = transactions.filter(t => {
    if (filtCat !== 'all' && t.category !== filtCat) return false;
    if (filtYear !== 'all' && !t.date_op.startsWith(filtYear)) return false;
    if (filtMonth !== 'all' && t.date_op.slice(5, 7) !== filtMonth) return false;
    if (filtDate && t.date_op !== filtDate) return false;
    if (search && !t.label.toLowerCase().includes(search)) return false;
    return true;
  });
  if (!filtered.length) { toast('Aucune transaction à exporter', 'error'); return; }
  // CSV headers
  const headers = ['Date','Libellé','Banque','Moyen paiement','Type','Montant','Catégorie','Sous-catégorie','Note'];
  const rows = filtered.map(t => [
    t.date_op,
    (t.label || '').replace(/"/g, '""'),
    t.bank_source || '',
    t.payment_method || '',
    t.type === 'entree' ? 'Entrée' : 'Sortie',
    (t.type === 'entree' ? '+' : '-') + Math.abs(Number(t.amount)).toFixed(2).replace('.', ','),
    t.category || '',
    t.sub_category || '',
    (t.comment || '').replace(/"/g, '""')
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(';')).join('\r\n');
  // BOM pour Excel UTF-8
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `monie_transactions_${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast(`✓ ${filtered.length} tx exportées`, 'success');
}

// ─── Sauvegarde complète (JSON) de toutes tes données ───
function exportAllData() {
  try {
    const dump = {
      _meta: { app: 'Monie', version: (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '?'), compte: currentUser ? currentUser.email : null },
      transactions: transactions || [],
      budgets: (typeof budgetByMonth !== 'undefined' ? budgetByMonth : {}),
      objectifs: (typeof goalsList !== 'undefined' ? goalsList : []),
      contributions: (typeof contribList !== 'undefined' ? contribList : []),
      investissements: (typeof investissements !== 'undefined' ? investissements : []),
      suivi_mensuel: (typeof suiviData !== 'undefined' ? suiviData : {}),
      regles: (typeof rules !== 'undefined' ? rules : []),
      profil: (typeof userProfile !== 'undefined' ? userProfile : null)
    };
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = `monie-sauvegarde-${stamp}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('✓ Sauvegarde téléchargée', 'success');
  } catch (e) { toast('Erreur export : ' + (e.message || e), 'error'); }
}

// ─── Suppression totale des données (RGPD) — double garde-fou ───
function wipeAllData() {
  const body = `<div style="font-size:13px;line-height:1.6">
    Cette action supprime <b>définitivement</b> toutes tes transactions, budgets, objectifs, contributions, placements et règles. <b style="color:var(--tender-rose)">C'est irréversible.</b><br><br>
    Pour confirmer, écris <b>SUPPRIMER</b> ci-dessous :
    <input class="inp" id="wipe-confirm" placeholder="SUPPRIMER" style="width:100%;margin-top:10px" autocomplete="off">
  </div>`;
  openModal('🗑 Tout supprimer ?', 'Télécharge d\'abord ta sauvegarde si tu veux la garder.', async () => {
    const v = ($('wipe-confirm') && $('wipe-confirm').value || '').trim().toUpperCase();
    if (v !== 'SUPPRIMER') { toast('Tape SUPPRIMER (en majuscules) pour confirmer', 'error'); return false; }
    toast('Suppression en cours…');
    const uid = currentUser.id;
    const tables = ['transactions', 'epargne_contributions', 'epargne_objectifs', 'investissements', 'tracker_mensuel', 'budget_mensuel', 'budget_prep', 'merchant_rules'];
    for (const tbl of tables) {
      const r = await sb.from(tbl).delete().eq('user_id', uid);
      if (r.error) console.warn('wipe', tbl, r.error.message);
    }
    toast('✓ Toutes tes données ont été supprimées', 'success');
    setTimeout(() => location.reload(), 1200);
  }, body);
}

// Édition complète d'une transaction (date, libellé, montant, type, catégorie, paiement)
function _updateTxFamHint() {
  const sel = $('txedit-cat'); const hint = $('txedit-fam-hint');
  if (sel && hint) hint.textContent = 'Famille : ' + (FAMILY_LABEL[catFamily(sel.value)] || '—');
}
function openTxEdit(id) {
  const t = transactions.find(x => x.id === id);
  if (!t) return;
  const catOpts = catOptionsGrouped(t.category);
  const pms = ['carte', 'especes', 'cheque', 'prelevement', 'virement', 'ticket_resto', 'autre'];
  const pmOpts = ['<option value="">— non précisé —</option>'].concat(pms.map(p => `<option value="${p}" ${t.payment_method === p ? 'selected' : ''}>${payMethodIcon(p)} ${p}</option>`)).join('');
  openModal('✏️ Modifier la transaction', 'Ajuste les infos de cette opération', async () => {
    const date = $('txedit-date').value;
    const label = $('txedit-label').value.trim();
    const amount = parseFloat($('txedit-amount').value);
    const type = $('txedit-type').value;
    const category = $('txedit-cat').value;
    const pm = $('txedit-pm').value || null;
    const subcat = ($('txedit-subcat') && $('txedit-subcat').value || '').trim() || null;
    const subsubcat = ($('txedit-subsub') && $('txedit-subsub').value || '').trim() || null;
    const bank = ($('txedit-bank') && $('txedit-bank').value || '').trim() || null;
    if (!date || !label || !amount || amount <= 0) { toast('Date, libellé et montant requis', 'error'); return false; }
    const patch = { date_op: date, label, amount: type === 'entree' ? amount : -amount, type, category, sub_category: subcat, sub_sub_category: subsubcat, payment_method: pm, bank_source: bank };
    const { error } = await sb.from('transactions').update(_sanitizeTx(patch)).eq('id', id);
    if (error) { toast('Erreur : ' + error.message, 'error'); return false; }
    Object.assign(t, patch);
    transactions.sort((a, b) => a.date_op < b.date_op ? 1 : a.date_op > b.date_op ? -1 : 0);
    renderTransactionsList();
    if (typeof renderCalendar === 'function') renderCalendar();
    if (typeof renderDashboard === 'function') renderDashboard();
    toast('✓ Transaction modifiée', 'success');
  }, `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="auth-field"><label>📅 Date</label><input class="inp" type="date" id="txedit-date" value="${t.date_op}"></div>
      <div class="auth-field"><label>Libellé</label><input class="inp" id="txedit-label" value="${esc(t.label)}"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="auth-field"><label>Type</label><select class="select" id="txedit-type">
          <option value="sortie" ${t.type === 'sortie' ? 'selected' : ''}>Dépense</option>
          <option value="entree" ${t.type === 'entree' ? 'selected' : ''}>Entrée</option>
          <option value="epargne" ${t.type === 'epargne' ? 'selected' : ''}>🐷 Épargne</option>
        </select></div>
        <div class="auth-field"><label>Montant (€)</label><input class="inp" type="number" step="0.01" id="txedit-amount" value="${Math.abs(Number(t.amount))}"></div>
      </div>
      <div class="auth-field"><label>Catégorie</label><select class="select" id="txedit-cat" onchange="_updateTxFamHint(); _txeditRefreshLists()">${catOpts}</select>
        <div id="txedit-fam-hint" style="font-size:11px;color:var(--muted);margin-top:4px">Famille : ${FAMILY_LABEL[catFamily(t.category)] || '—'}</div></div>
      <div class="auth-field"><label>Sous-catégorie <span style="font-weight:400;color:var(--muted);font-size:11px">(choisis une suggestion ou saisis)</span></label><input class="inp" id="txedit-subcat" value="${esc(t.sub_category || '')}" list="txedit-subcat-list" placeholder="Facultatif" onchange="_txeditRefreshSubsub('${t.id}')"><datalist id="txedit-subcat-list">${subcatDatalist(t.category)}</datalist></div>
      <div class="auth-field"><label>Sous-sous-catégorie <span style="font-weight:400;color:var(--muted);font-size:11px">(choisis une suggestion ou saisis)</span></label><input class="inp" id="txedit-subsub" value="${esc(t.sub_sub_category || '')}" list="txedit-subsub-list" placeholder="Facultatif"><datalist id="txedit-subsub-list">${subsubDatalist(t.category, t.sub_category)}</datalist></div>
      <div class="auth-field"><label>Moyen de paiement</label><select class="select" id="txedit-pm">${pmOpts}</select></div>
      <div class="auth-field"><label>Banque / compte <span style="font-weight:400;color:var(--muted);font-size:11px">(facultatif)</span></label><input class="inp" id="txedit-bank" value="${esc(t.bank_source || '')}" list="txedit-bank-list" placeholder="Ex: LCL, BoursoBank, Espèces…"><datalist id="txedit-bank-list">${_bankDatalist()}</datalist></div>
    </div>
  `);
}
// Suggestions de banques : prédéfinies + celles déjà utilisées dans les transactions
function _bankDatalist() {
  const base = ['LCL', 'BoursoBank', 'Banque Postale', 'Revolut', 'N26', 'Espèces'];
  const used = [...new Set(transactions.map(t => (t.bank_source || '').trim()).filter(Boolean))];
  return [...new Set([...base, ...used])].map(b => `<option value="${esc(b)}">`).join('');
}
// Rafraîchit les suggestions (datalists) de la modale d'édition quand catégorie/sous-cat changent
function _txeditRefreshLists() {
  const cat = ($('txedit-cat') && $('txedit-cat').value) || '';
  const sub = ($('txedit-subcat') && $('txedit-subcat').value) || '';
  const sl = $('txedit-subcat-list'); if (sl) sl.innerHTML = subcatDatalist(cat);
  const ssl = $('txedit-subsub-list'); if (ssl) ssl.innerHTML = subsubDatalist(cat, sub);
}
function _txeditRefreshSubsub() {
  const cat = ($('txedit-cat') && $('txedit-cat').value) || '';
  const sub = ($('txedit-subcat') && $('txedit-subcat').value) || '';
  const ssl = $('txedit-subsub-list'); if (ssl) ssl.innerHTML = subsubDatalist(cat, sub);
}
async function recategorizeTx(id, newCat) {
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;
  // Changer de catégorie remet à zéro la sous-cat ET la sous-sous-cat (elles n'ont plus de sens)
  const { error } = await sb.from('transactions').update(_sanitizeTx({ category: newCat, sub_category: null, sub_sub_category: null })).eq('id', id);
  if (error) { toast('Erreur: ' + error.message, 'error'); return; }
  tx.category = newCat;
  tx.sub_category = null;
  tx.sub_sub_category = null;
  toast('✓ Catégorie mise à jour', 'success');
  renderTransactionsList();
}
// Saisie / modification de la sous-catégorie directement dans le tableau
async function updateTxSubcat(id, val) {
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;
  const v = (val || '').trim() || null;
  if ((tx.sub_category || null) === v) return; // rien changé
  // Changer de sous-cat remet à zéro la sous-sous-cat rattachée
  const { error } = await sb.from('transactions').update(_sanitizeTx({ sub_category: v, sub_sub_category: null })).eq('id', id);
  if (error) { toast('Erreur : ' + error.message, 'error'); return; }
  tx.sub_category = v;
  tx.sub_sub_category = null;
  renderTransactionsList();
}

async function deleteTx(id) {
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;
  const { error } = await sb.from('transactions').delete().eq('id', id);
  if (error) { toast('Erreur: ' + error.message, 'error'); return; }
  transactions = transactions.filter(t => t.id !== id);
  txSelectedIds.delete(id);
  renderTransactionsList();
  // Undo : ré-insère la ligne telle quelle (même id) si l'utilisateur clique Annuler
  showUndoToast('Transaction supprimée', async () => {
    const restore = { ...tx };
    delete restore.created_at;
    delete restore.updated_at;
    const { error: e2 } = await sb.from('transactions').insert(restore);
    if (e2) { toast('Impossible d\'annuler : ' + e2.message, 'error'); return; }
    transactions.push(restore);
    transactions.sort((a, b) => a.date_op < b.date_op ? 1 : a.date_op > b.date_op ? -1 : 0);
    renderTransactionsList();
    toast('Transaction restaurée', 'success');
  });
}

async function applyTxBulkCategory() {
  const newCat = $('tx-bulk-cat').value;
  if (!newCat) { toast('Choisis une catégorie', 'error'); return; }
  const ids = [...txSelectedIds];
  if (!ids.length) return;
  const { error } = await sb.from('transactions').update(_sanitizeTx({ category: newCat, sub_category: null, sub_sub_category: null })).in('id', ids);
  if (error) { toast('Erreur: ' + error.message, 'error'); return; }
  transactions.forEach(t => { if (ids.includes(t.id)) { t.category = newCat; t.sub_category = null; t.sub_sub_category = null; } });
  toast(`✓ ${ids.length} tx catégorisées`, 'success');
  txSelectedIds.clear();
  renderTransactionsList();
}
// Change la date de toutes les transactions sélectionnées
async function applyTxBulkDate() {
  const newDate = $('tx-bulk-date') ? $('tx-bulk-date').value : '';
  if (!newDate) { toast('Choisis une date', 'error'); return; }
  const ids = [...txSelectedIds];
  if (!ids.length) return;
  const { error } = await sb.from('transactions').update({ date_op: newDate }).in('id', ids);
  if (error) { toast('Erreur: ' + error.message, 'error'); return; }
  transactions.forEach(t => { if (ids.includes(t.id)) t.date_op = newDate; });
  transactions.sort((a, b) => a.date_op < b.date_op ? 1 : a.date_op > b.date_op ? -1 : 0);
  toast(`✓ ${ids.length} tx datées au ${newDate}`, 'success');
  txSelectedIds.clear();
  renderTransactionsList();
  if (typeof renderCalendar === 'function') renderCalendar();
  if (typeof renderDashboard === 'function') renderDashboard();
}

// 🔀 Fusionne les transactions sélectionnées en UNE seule (ex : « Courses Leclerc »)
async function mergeTxSelection() {
  const ids = [...txSelectedIds];
  if (ids.length < 2) { toast('Sélectionne au moins 2 transactions à fusionner', 'error'); return; }
  const sel = transactions.filter(t => ids.includes(t.id));
  const name = (prompt(`Nom de la transaction fusionnée ? (${ids.length} lignes)`, 'Courses ') || '').trim();
  if (!name) return;
  const total = sel.reduce((s, t) => s + Number(t.amount), 0);      // signé (garde le sens)
  const type = sel[0].type;
  const cnt = (arr, key) => { const c = {}; arr.forEach(t => { const v = (t[key] || '').trim(); if (v) c[v] = (c[v] || 0) + 1; }); return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || null; };
  const cat = cnt(sel, 'category') || 'Alimentation';
  const sub = cnt(sel.filter(t => t.category === cat), 'sub_category');
  const date = sel.map(t => t.date_op).sort()[0];
  const ok = await confirmDialog('🔀 Fusionner ?', `<div style="font-size:14px;line-height:1.6">Fusionner <b>${ids.length} transactions</b> en une seule «&nbsp;<b>${esc(name)}</b>&nbsp;» de <b>${fmt(Math.abs(total))}</b> (${esc(cat)}) ?<br><br>Les ${ids.length} lignes d'origine seront <b>supprimées</b> (le détail reste dans ta liste de courses si tu l'y avais mis). Continuer ?</div>`);
  if (!ok) return;
  const merged = { user_id: currentUser.id, date_op: date, label: name, amount: total, type, category: cat, sub_category: sub, sub_sub_category: null, source: 'manual', payment_method: sel[0].payment_method || null, bank_source: sel[0].bank_source || null };
  const { data, error } = await sb.from('transactions').insert(_sanitizeTx(merged)).select().single();
  if (error) { toast('Erreur : ' + error.message, 'error'); console.error(error); return; }
  for (let i = 0; i < ids.length; i += 200) { const { error: e2 } = await sb.from('transactions').delete().in('id', ids.slice(i, i + 200)); if (e2) { toast('Erreur suppression : ' + e2.message, 'error'); return; } }
  transactions = transactions.filter(t => !ids.includes(t.id));
  if (data) transactions.unshift(data);
  txSelectedIds.clear();
  toast(`✓ ${ids.length} transactions fusionnées en « ${name} »`, 'success', 5000);
  renderTransactionsList();
}
async function deleteTxBulkSelection() {
  const n = txSelectedIds.size;
  if (!n) return;
  openModal(`Supprimer ${n} transaction(s) ?`, 'Action irréversible.', async () => {
    const ids = [...txSelectedIds];
    const { error } = await sb.from('transactions').delete().in('id', ids);
    if (error) { toast('Erreur: ' + error.message, 'error'); return; }
    transactions = transactions.filter(t => !ids.includes(t.id));
    txSelectedIds.clear();
    toast(`✓ ${n} tx supprimées`, 'success');
    renderTransactionsList();
  });
}

// ═══ IMPORT ════════════════════════════════════════════════════
function setupDragDrop() {
  const dz = $('drop-zone');
  if (!dz) return;
  ['dragenter', 'dragover'].forEach(e => dz.addEventListener(e, ev => {
    ev.preventDefault(); ev.stopPropagation();
    dz.classList.add('dragover');
  }));
  ['dragleave', 'drop'].forEach(e => dz.addEventListener(e, ev => {
    ev.preventDefault(); ev.stopPropagation();
    dz.classList.remove('dragover');
  }));
  dz.addEventListener('drop', ev => {
    const file = ev.dataTransfer.files[0];
    if (file) handleImportFile(file);
  });
}
// Conteneur d'aperçu d'import (page Import par défaut, ou page Transactions)
let importPreviewTarget = 'import-preview';
async function handleImportFromTx(file) {
  if (!file) return;
  await handleImportFile(file, 'tx-import-preview');
  const inp = $('tx-import-file'); if (inp) inp.value = '';
}
async function handleImportFile(file, target) {
  if (!file) return;
  importPreviewTarget = target || 'import-preview';
  const name = file.name.toLowerCase();
  // Reset l'état de preview pour repartir propre — on ouvre sur « Toutes » pour voir toutes les nouvelles
  previewTab = 'all';
  previewPage = 1;
  previewFilterYear = 'all';
  previewFilterMonth = 'all';
  previewFilterCat = 'all';
  selectedIndexes.clear();
  toast('Analyse de ' + file.name + '…');
  try {
    let parsed = [];
    if (name.endsWith('.csv')) parsed = await parseCSV(file);
    else if (name.endsWith('.pdf')) parsed = await parsePDF(file);
    else if (name.endsWith('.json')) parsed = await parseJSON(file);
    else { toast('Format non supporté', 'error'); return; }
    if (!parsed.length) { toast('Aucune transaction détectée', 'error'); return; }
    // Catégorise SEULEMENT si la tx n'a pas déjà une catégorie du fichier source
    // (le JSON v2 arrive déjà catégorisé, on préserve son travail)
    parsed.forEach(t => {
      t.merchant_key = merchantKey(t.label);
      if (!t.category || t.category === 'Autres') {
        const c = categorize(t.label, t.amount);
        // On n'écrase que si la catégorisation auto trouve mieux que "Autres"
        if (c.category && c.category !== 'Autres') {
          t.category = c.category;
          t.sub_category = c.sub_category;
        }
      }
    });
    // 🏦 Détecte la banque depuis le nom du fichier (LCL / BoursoBank), sinon à préciser
    importBank = /lcl/.test(name) ? 'LCL' : (/bourso/.test(name) ? 'BoursoBank' : null);
    parsed.forEach(t => { if (importBank && !t.bank_source) t.bank_source = importBank; });
    // Recherche doublons
    importPreviewData = parsed;
    detectDuplicates();
    showImportPreview();
  } catch (e) {
    console.error(e);
    toast('Erreur lors de l\'import : ' + e.message, 'error');
  }
}
async function parseCSV(file) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  // Détection délimiteur
  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
  const headers = lines[0].split(sep).map(h => h.replace(/^"|"$/g, '').toLowerCase().trim());
  const iDate = headers.findIndex(h => /date|dateop/.test(h));
  const iLabel = headers.findIndex(h => /label|libell|description/.test(h));
  const iAmount = headers.findIndex(h => /amount|montant/.test(h));
  if (iDate < 0 || iLabel < 0 || iAmount < 0) throw new Error('Colonnes date/label/amount non trouvées');
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i], sep);
    if (cells.length < Math.max(iDate, iLabel, iAmount) + 1) continue;
    const dateStr = cells[iDate];
    const label = cells[iLabel].replace(/^"|"$/g, '').trim();
    const amtStr = cells[iAmount].replace(/^"|"$/g, '').replace(/\s/g, '').replace(',', '.');
    const amount = parseFloat(amtStr);
    if (!label || isNaN(amount) || amount === 0) continue;
    const dateISO = normalizeDate(dateStr);
    if (!dateISO) continue;
    out.push({ date_op: dateISO, label, amount, type: amount > 0 ? 'entree' : 'sortie' });
  }
  return out;
}
function parseCSVLine(line, sep) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQ = !inQ;
    else if (c === sep && !inQ) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
function normalizeDate(s) {
  s = String(s).trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/))) return `${m[3]}-${m[2]}-${m[1]}`;
  if ((m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})/))) return `${m[3]}-${m[2]}-${m[1]}`;
  if ((m = s.match(/^(\d{2})\/(\d{2})\/(\d{2})/))) return `20${m[3]}-${m[2]}-${m[1]}`;
  return null;
}
async function parseJSON(file) {
  const text = await file.text();
  const d = JSON.parse(text);
  if (d.transactions && Array.isArray(d.transactions)) {
    // Format Monie v2 : supporte cat, subcat, compte, paymethod
    return d.transactions.filter(t => t.label && t.amount && t.date).map(t => ({
      date_op: t.date,
      label: t.label,
      amount: t.type === 'entree' ? Math.abs(t.amount) : -Math.abs(t.amount),
      type: t.type || (t.amount > 0 ? 'entree' : 'sortie'),
      // Nouveaux champs enrichis (v2)
      category: t.cat || t.category || null,
      sub_category: t.subcat || t.sub_category || null,
      sub_sub_category: t.subsubcat || t.sub_sub_category || null,
      bank_source: t.compte || t.bank_source || null,
      payment_method: t.paymethod || t.payment_method || null,
      comment: t.comment || null
    }));
  }
  return [];
}
async function parsePDF(file) {
  // Utilise pdf.js
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const arr = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arr }).promise;
  const out = [];
  const Y_TOL = 3;                                   // tolérance verticale pour regrouper une ligne
  const amtRe = /-?\d{1,3}(?:[\s ]\d{3})*,\d{2}/; // montant FR : 10,90 / 2 200,01
  const anyDateRe = /(\d{2})[.\/](\d{2})(?:[.\/](\d{2,4}))?/g;
  const startDateRe = /^\d{2}[.\/]\d{2}/;            // la ligne d'une opération commence par jj.mm
  const currentYear = String(new Date().getFullYear());

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items
      .filter(it => (it.str || '').trim() !== '')
      .map(it => ({ x: it.transform[4], y: it.transform[5], str: it.str.trim() }));
    if (!items.length) continue;

    // Position X des colonnes DÉBIT / CRÉDIT (pour distinguer dépense / entrée)
    let debitX = null, creditX = null;
    const deb = items.find(it => /^DEBIT$/i.test(it.str));
    if (deb) {
      debitX = deb.x;
      const creds = items.filter(it => /^CREDIT$/i.test(it.str));
      if (creds.length) creditX = creds.sort((a, b) => Math.abs(a.y - deb.y) - Math.abs(b.y - deb.y))[0].x;
    }

    // Regroupe les items en lignes visuelles (par y, avec tolérance)
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const rows = [];
    let cur = null;
    for (const it of items) {
      if (!cur || Math.abs(it.y - cur.y) > Y_TOL) { cur = { y: it.y, items: [it] }; rows.push(cur); }
      else cur.items.push(it);
    }

    for (const row of rows) {
      const its = row.items.slice().sort((a, b) => a.x - b.x);
      if (!its[0] || !startDateRe.test(its[0].str)) continue;      // pas une ligne d'opération
      const text = its.map(t => t.str).join(' ');
      if (/ANCIEN SOLDE|NOUVEAU SOLDE|\bSOLDE\b|TOTAL DES|TOTAUX|A NOUVEAU/i.test(text)) continue;

      const dates = [...text.matchAll(anyDateRe)];
      if (!dates.length) continue;
      const start = dates[0];                                       // jj.mm (date d'opération)
      const withYear = dates.filter(d => d[3]);                     // dates complètes jj.mm.aa
      const valeur = withYear.length ? withYear[withYear.length - 1] : null;

      // Montant = ce qui suit la date valeur (gère "2 200,01" en plusieurs morceaux)
      let after = text;
      if (valeur) { const i = text.lastIndexOf(valeur[0]); if (i >= 0) after = text.slice(i + valeur[0].length); }
      const am = after.match(amtRe) || text.match(new RegExp(amtRe.source + '\\s*€?\\s*$'));
      if (!am) continue;
      const amt = parseFloat(am[0].replace(/[\s ]/g, '').replace(',', '.'));
      if (!isFinite(amt) || amt === 0) continue;

      // Signe : le montant est-il dans la colonne CRÉDIT (entrée) ou DÉBIT (dépense) ?
      let isCredit = false;
      if (debitX != null && creditX != null) {
        const nums = its.filter(t => /\d,\d{2}|\d{3,}/.test(t.str) && t.x > debitX - 60);
        const amtX = nums.length ? nums[nums.length - 1].x : null;   // le plus à droite
        if (amtX != null) isCredit = Math.abs(amtX - creditX) < Math.abs(amtX - debitX);
      } else {
        // Pas de colonnes détectées : heuristique (signe explicite sinon dépense)
        isCredit = /\+/.test(after) && !/-/.test(after);
      }
      const signed = isCredit ? Math.abs(amt) : -Math.abs(amt);

      let yr = (valeur && valeur[3]) || start[3] || currentYear;
      if (yr.length === 2) yr = '20' + yr;
      const date = `${yr}-${start[2]}-${start[1]}`;

      // Libellé : entre la date de début et la date valeur
      let label = text.replace(/^\s*\d{2}[.\/]\d{2}\s*/, '');
      if (valeur) { const i = label.lastIndexOf(valeur[0]); if (i > 0) label = label.slice(0, i); }
      label = label.replace(/\s+/g, ' ').trim();
      if (label.length < 2) continue;

      out.push({ date_op: date, label: label.slice(0, 100), amount: signed, type: signed > 0 ? 'entree' : 'sortie' });
    }
  }
  return out;
}

// ═══ DEDUP ═════════════════════════════════════════════════════
function detectDuplicates() {
  importMatches = [];
  for (const newT of importPreviewData) {
    const candidates = transactions.filter(t => {
      const daysDiff = Math.abs((new Date(t.date_op) - new Date(newT.date_op)) / 86400000);
      return Math.abs(Number(t.amount)) === Math.abs(newT.amount) && daysDiff <= 3;
    });
    if (candidates.length > 0) {
      importMatches.push({ new: newT, existing: candidates[0] });
      newT._duplicate = true;
    }
  }
}
// Filtres import preview
let previewFilterYear = 'all';
let previewFilterMonth = 'all';
let previewFilterCat = 'all';
let previewTab = 'all'; // 'all' | 'todo' | 'done' | 'auto'
let importBank = null;  // 🏦 banque du relevé en cours d'import (détectée ou choisie)
let previewPage = 1;
const PREVIEW_PAGE_SIZE = 50;
let preservedScroll = 0;
let selectedIndexes = new Set();
let bulkCategory = '';

function showImportPreview() {
  preservedScroll = window.scrollY;
  const wrap = $(importPreviewTarget) || $('import-preview');
  wrap.style.display = 'block';
  // Pendant l'import depuis la page Transactions : on masque la liste complète pour ne voir QUE les nouvelles à valider
  if (importPreviewTarget === 'tx-import-preview') {
    _setTxMainCardVisible(false);
    if (wrap.scrollIntoView) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  const nDup = importMatches.length;
  const nNew = importPreviewData.length - nDup;
  const cats = Object.keys(CAT_META);

  // Extraire années/mois disponibles
  const years = [...new Set(importPreviewData.map(t => t.date_op.slice(0, 4)))].sort().reverse();
  const monthsAvail = previewFilterYear === 'all'
    ? [...new Set(importPreviewData.map(t => t.date_op.slice(5, 7)))].sort()
    : [...new Set(importPreviewData.filter(t => t.date_op.startsWith(previewFilterYear)).map(t => t.date_op.slice(5, 7)))].sort();

  // Répartition des transactions par état
  const active = importPreviewData.filter(t => !t._duplicate);
  const todo = active.filter(t => t.category === 'Autres' && !t._userCategorized);
  const done = active.filter(t => t._userCategorized);
  const auto = active.filter(t => t.category !== 'Autres' && !t._userCategorized);

  let html = `
    <div class="card">
      <div class="card-hd">
        <div class="card-title">📥 Analyse de l'import</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn-ghost" onclick="cancelImport()">Annuler</button>
          <button class="btn-primary" onclick="confirmImport()">✓ Valider l'import (${nNew})</button>
        </div>
      </div>
      <div class="kpi-grid">
        <div class="kpi kpi-sage"><div class="kpi-label">✓ Nouvelles</div><div class="kpi-val kpi-val-sage">${nNew}</div><div class="kpi-hint">à ajouter</div></div>
        <div class="kpi kpi-peach"><div class="kpi-label">⚠ Doublons</div><div class="kpi-val" style="color:var(--peach)">${nDup}</div><div class="kpi-hint">à vérifier</div></div>
        <div class="kpi kpi-rose"><div class="kpi-label">🤔 À vérifier</div><div class="kpi-val kpi-val-rose">${todo.length}</div><div class="kpi-hint">non reconnues</div></div>
        <div class="kpi kpi-gold"><div class="kpi-label">✨ Auto-cat.</div><div class="kpi-val kpi-val-gold">${auto.length}</div><div class="kpi-hint">reconnues</div></div>
      </div>`;

  // 🏦 Banque du relevé (détectée depuis le nom du fichier, ou à choisir)
  const _banks = ['LCL', 'BoursoBank', 'Banque Postale', 'Revolut', 'N26'];
  if (importBank && !_banks.includes(importBank)) _banks.unshift(importBank);
  const _bankOpts = _banks.map(b => `<option value="${esc(b)}" ${importBank === b ? 'selected' : ''}>${b}</option>`).join('');
  html += `<div style="display:flex;align-items:center;gap:10px;margin-top:14px;padding:11px 13px;border-radius:10px;flex-wrap:wrap;background:${importBank ? 'var(--sage-soft)' : 'rgba(232,184,77,0.18)'}">
      <span style="font-size:13px;font-weight:700">🏦 Banque de ce relevé :</span>
      <select class="select" style="width:auto" onchange="setImportBank(this.value)">
        <option value="" ${!importBank ? 'selected' : ''}>— à préciser —</option>
        ${_bankOpts}
        <option value="__other__">➕ Autre banque…</option>
      </select>
      ${importBank ? `<span style="font-size:12px;color:var(--sage)">✓ appliquée à toutes ces opérations</span>` : `<span style="font-size:12px;color:#B7791F">Choisis la banque pour bien reconnaître tes comptes</span>`}
    </div>`;

  if (nDup > 0) {
    html += `<div style="margin-top:16px"><div class="card-title" style="margin-bottom:10px">🔍 Doublons potentiels détectés</div>`;
    importMatches.forEach((m, i) => {
      html += `
        <div class="match-card">
          <div class="match-tx"><span>📱 Toi : "${esc(m.existing.label)}" le ${m.existing.date_op}</span><span class="tx-amt ${m.existing.type === 'entree' ? 'amt-in' : 'amt-out'}">${m.existing.type === 'entree' ? '+' : '-'}${fmtD(Math.abs(m.existing.amount))}</span></div>
          <div class="match-tx"><span>🏦 Import : "${esc(m.new.label)}" le ${m.new.date_op}</span><span class="tx-amt ${m.new.type === 'entree' ? 'amt-in' : 'amt-out'}">${m.new.type === 'entree' ? '+' : '-'}${fmtD(Math.abs(m.new.amount))}</span></div>
          <div class="match-actions">
            <button class="btn-merge" onclick="mergeMatch(${i})">✓ Même transaction (fusionner)</button>
            <button class="btn-keep" onclick="keepBoth(${i})">✗ Deux dépenses distinctes</button>
          </div>
        </div>`;
    });
    html += `</div>`;
  }

  // ─── ONGLETS ──────────────────────────────────────
  html += `
    <div style="margin-top:20px">
      <div class="import-tabs">
        <button class="import-tab ${previewTab === 'all' ? 'active' : ''}" onclick="setPreviewTab('all')">
          📋 Toutes <span class="import-tab-count">${active.length}</span>
        </button>
        <button class="import-tab ${previewTab === 'todo' ? 'active' : ''}" onclick="setPreviewTab('todo')">
          🤔 À vérifier <span class="import-tab-count">${todo.length}</span>
        </button>
        <button class="import-tab ${previewTab === 'done' ? 'active' : ''}" onclick="setPreviewTab('done')">
          ✓ Catégorisées <span class="import-tab-count">${done.length}</span>
        </button>
        <button class="import-tab ${previewTab === 'auto' ? 'active' : ''}" onclick="setPreviewTab('auto')">
          ✨ Auto <span class="import-tab-count">${auto.length}</span>
        </button>
      </div>`;

  // Data selon l'onglet
  let filtered = previewTab === 'all' ? active : previewTab === 'todo' ? todo : previewTab === 'done' ? done : auto;
  const filteredCats = [...new Set(filtered.map(t => t.category))].sort();

  // Filtres date + catégorie
  html += `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:center">
        <select class="select" style="width:auto" onchange="setPreviewFilter('year', this.value)">
          <option value="all" ${previewFilterYear === 'all' ? 'selected' : ''}>Toutes années</option>
          ${years.map(y => `<option value="${y}" ${previewFilterYear === y ? 'selected' : ''}>${y}</option>`).join('')}
        </select>
        <select class="select" style="width:auto" onchange="setPreviewFilter('month', this.value)">
          <option value="all" ${previewFilterMonth === 'all' ? 'selected' : ''}>Tous mois</option>
          ${monthsAvail.map(m => `<option value="${m}" ${previewFilterMonth === m ? 'selected' : ''}>${MONTHS[parseInt(m) - 1]}</option>`).join('')}
        </select>
        <select class="select" style="width:auto" onchange="setPreviewFilter('cat', this.value)">
          <option value="all" ${previewFilterCat === 'all' ? 'selected' : ''}>Toutes catégo.</option>
          ${filteredCats.map(c => `<option value="${c}" ${previewFilterCat === c ? 'selected' : ''}>${catIcon(c)} ${c}</option>`).join('')}
        </select>
      </div>`;

  // Appliquer filtres date/cat
  if (previewFilterYear !== 'all') filtered = filtered.filter(t => t.date_op.startsWith(previewFilterYear));
  if (previewFilterMonth !== 'all') filtered = filtered.filter(t => t.date_op.slice(5, 7) === previewFilterMonth);
  if (previewFilterCat !== 'all') filtered = filtered.filter(t => t.category === previewFilterCat);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PREVIEW_PAGE_SIZE));
  if (previewPage > totalPages) previewPage = totalPages;
  const startIdx = (previewPage - 1) * PREVIEW_PAGE_SIZE;
  const displayed = filtered.slice(startIdx, startIdx + PREVIEW_PAGE_SIZE);

  const tipMsg = {
    'all': '👉 Voici TOUTES tes nouvelles transactions. Vérifie / corrige la catégorie de chacune, puis clique « ✓ Valider l\'import » en haut.',
    'todo': 'Tape sur une catégorie pour classer la transaction. Monie apprend et applique la règle aux transactions similaires 🌸',
    'done': 'Voici les transactions que tu as toi-même catégorisées.',
    'auto': 'Transactions catégorisées automatiquement par les règles Monie.'
  }[previewTab];

  html += `<div style="font-size:12px;color:var(--muted);margin-bottom:12px;padding:8px 12px;background:var(--bg);border-radius:8px">${tipMsg}</div>`;

  // Bulk action bar (si des transactions sont sélectionnées) — visible en haut + en bas (sticky)
  const visibleIndexes = displayed.map(t => importPreviewData.indexOf(t));
  const selectedInView = visibleIndexes.filter(i => selectedIndexes.has(i));
  if (selectedIndexes.size > 0) {
    const catOptions = cats.map(c => `<option value="${c}">${catIcon(c)} ${c}</option>`).join('');
    html += `
      <div class="bulk-bar floating" id="bulk-bar-floating">
        <span class="bulk-bar-count">${selectedIndexes.size}</span>
        <span class="bulk-bar-label">sélectionnée(s)</span>
        <div class="bulk-bar-actions">
          <select class="bulk-select" id="bulk-cat-select">
            <option value="">Choisir une catégorie…</option>
            ${catOptions}
          </select>
          <button class="bulk-btn" onclick="applyBulkCategory()">✓ Appliquer</button>
          <button class="bulk-btn danger" onclick="deleteBulkSelection()">🗑️ Supprimer</button>
          <button class="bulk-btn" onclick="clearSelection()">Annuler</button>
        </div>
      </div>`;
  }

  // Select all bar (si il y a des transactions à afficher)
  if (displayed.length > 0) {
    const allChecked = visibleIndexes.every(i => selectedIndexes.has(i));
    const someChecked = visibleIndexes.some(i => selectedIndexes.has(i));
    html += `
      <div class="select-all-bar">
        <label>
          <input type="checkbox" class="tx-checkbox" onchange="toggleAllVisible(this.checked)" ${allChecked ? 'checked' : ''}>
          <span>${allChecked ? 'Tout désélectionner sur cette page' : 'Tout sélectionner sur cette page'}</span>
        </label>
        ${selectedIndexes.size > 0 ? `<span style="margin-left:auto;font-weight:700;color:var(--rose)">${selectedIndexes.size} sélectionnée(s)</span>` : ''}
      </div>`;
  }

  if (!filtered.length) {
    html += previewTab === 'todo'
      ? `<div class="empty"><div class="empty-emoji">✨</div><div class="empty-title">Bravo, tout est catégorisé !</div><div class="empty-sub">Tu peux valider l'import ci-dessus</div></div>`
      : `<div class="empty"><div class="empty-title">Aucune transaction ici</div></div>`;
  } else {
    displayed.forEach(t => {
      const globalIdx = importPreviewData.indexOf(t);
      const isSelected = selectedIndexes.has(globalIdx);
      const catsToShow = cats.map(c => `<option value="${c}" ${t.category === c ? 'selected' : ''}>${catIcon(c)} ${c}</option>`).join('');
      const isAutre = (t.category || '').toLowerCase() === 'autres';
      const noteHtml = isAutre ? `
        <div class="tx-note-wrap">
          <input type="text" class="tx-note-input" placeholder="✏️ Note : à quoi correspond cette transaction ?"
                 value="${esc(t.comment)}"
                 oninput="setImportTxNote(${globalIdx}, this.value)">
        </div>` : '';
      html += `
        <div class="tx-row ${isSelected ? 'selected' : ''}" style="border-bottom:1px solid var(--border-soft)" data-tx-idx="${globalIdx}">
          <input type="checkbox" class="tx-checkbox" ${isSelected ? 'checked' : ''} onchange="toggleSelectTx(${globalIdx}, this.checked)" title="Sélectionner">
          <div class="tx-date">${t.date_op.slice(8)}/${t.date_op.slice(5, 7)}<br><span style="font-size:10px">${t.date_op.slice(0, 4)}</span></div>
          <div class="tx-icon" style="background:${catColor(t.category)}15;color:${catColor(t.category)}">${catIcon(t.category)}</div>
          <div class="tx-info">
            <div class="tx-label">${esc(t.label)} ${bankBadge(t.bank_source)}</div>
            <div class="import-cat3">
              <select class="select" title="Catégorie" onchange="recategorizeImportTx(${globalIdx}, this.value)">${catsToShow}</select>
              <select class="select" title="Sous-catégorie" onchange="setImportSubcat(${globalIdx}, this.value)">${subcatOptions(t.category, t.sub_category)}</select>
              <select class="select" title="Sous-sous-catégorie" onchange="setImportSubsub(${globalIdx}, this.value)">${subsubOptions(t.category, t.sub_category, t.sub_sub_category)}</select>
            </div>
          </div>
          <div class="tx-amt ${t.type === 'entree' ? 'amt-in' : 'amt-out'}">${t.type === 'entree' ? '+' : '-'}${fmtD(Math.abs(t.amount))}</div>
          <button class="import-del-btn" onclick="deleteImportTx(${globalIdx})" title="Supprimer de l'import">✕</button>
          ${noteHtml}
        </div>`;
    });
  }

  // ─── PAGINATION ──────────────────────────────────
  if (totalPages > 1) {
    html += `
      <div class="pagination">
        <button class="pag-btn" ${previewPage === 1 ? 'disabled' : ''} onclick="changePreviewPage(-1)">‹ Précédente</button>
        <div class="pag-info">
          Page <b>${previewPage}</b> / ${totalPages}
          <span style="color:var(--muted);font-weight:400"> · ${filtered.length} transaction(s)</span>
        </div>
        <button class="pag-btn" ${previewPage === totalPages ? 'disabled' : ''} onclick="changePreviewPage(1)">Suivante ›</button>
      </div>`;
  } else if (filtered.length > 0) {
    html += `<div class="pag-info" style="text-align:center;padding:16px">${filtered.length} transaction(s) affichée(s)</div>`;
  }

  // Barre d'actions en bas de page (duplicate du haut)
  html += `
    <div style="margin-top:20px;padding:16px;background:var(--bg);border-radius:var(--radius);display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;border:1.5px dashed var(--border)">
      <button class="btn-ghost" onclick="cancelImport()">Annuler</button>
      <button class="btn-primary" onclick="confirmImport()">✓ Valider l'import (${nNew})</button>
    </div>`;

  html += `</div></div>`;
  wrap.innerHTML = html;

  // Restaurer scroll
  requestAnimationFrame(() => window.scrollTo({ top: preservedScroll, behavior: 'instant' }));
}

// Sauvegarde de la note sur une transaction import (catégorie "Autres")
function setImportTxNote(idx, val) {
  if (importPreviewData[idx]) {
    importPreviewData[idx].comment = val;
  }
}

function setPreviewTab(tab) {
  previewTab = tab;
  previewPage = 1;
  previewFilterCat = 'all';
  selectedIndexes.clear();
  showImportPreview();
}

function changePreviewPage(dir) {
  previewPage += dir;
  if (previewPage < 1) previewPage = 1;
  showImportPreview();
  // Scroll en haut de la liste pour la nouvelle page
  requestAnimationFrame(() => {
    const wrap = $(importPreviewTarget) || $('import-preview');
    if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

// ─── BULK ACTIONS ─────────────────────────────────────────────
function toggleSelectTx(idx, checked) {
  preservedScroll = window.scrollY;
  if (checked) selectedIndexes.add(idx);
  else selectedIndexes.delete(idx);
  showImportPreview();
}

function toggleAllVisible(checked) {
  preservedScroll = window.scrollY;
  // Recompute filtered list (même logique que dans showImportPreview)
  const active = importPreviewData.filter(t => !t._duplicate);
  const todo = active.filter(t => t.category === 'Autres' && !t._userCategorized);
  const done = active.filter(t => t._userCategorized);
  const auto = active.filter(t => t.category !== 'Autres' && !t._userCategorized);
  let filtered = previewTab === 'todo' ? todo : previewTab === 'done' ? done : auto;
  if (previewFilterYear !== 'all') filtered = filtered.filter(t => t.date_op.startsWith(previewFilterYear));
  if (previewFilterMonth !== 'all') filtered = filtered.filter(t => t.date_op.slice(5, 7) === previewFilterMonth);
  if (previewFilterCat !== 'all') filtered = filtered.filter(t => t.category === previewFilterCat);
  const startIdx = (previewPage - 1) * PREVIEW_PAGE_SIZE;
  const displayed = filtered.slice(startIdx, startIdx + PREVIEW_PAGE_SIZE);
  displayed.forEach(t => {
    const idx = importPreviewData.indexOf(t);
    if (checked) selectedIndexes.add(idx);
    else selectedIndexes.delete(idx);
  });
  showImportPreview();
}

function clearSelection() {
  selectedIndexes.clear();
  showImportPreview();
}

async function applyBulkCategory() {
  const newCat = $('bulk-cat-select').value;
  if (!newCat) { toast('Choisis une catégorie d\'abord', 'error'); return; }
  if (selectedIndexes.size === 0) { toast('Rien de sélectionné', 'error'); return; }

  preservedScroll = window.scrollY;
  const selectedTxs = [...selectedIndexes].map(i => importPreviewData[i]).filter(Boolean);

  // Créer les règles marchandes pour chaque libellé unique
  const rulesToCreate = new Map(); // pattern -> {category}
  for (const t of selectedTxs) {
    t.category = newCat;
    t.sub_category = null;
    t._userTaught = true;
    t._userCategorized = true;
    const key = t.merchant_key || merchantKey(t.label);
    const words = key.split(' ').filter(w => w.length > 3);
    const pattern = words.slice(0, 2).join(' ') || key.substring(0, 20);
    if (pattern.length >= 3 && !rulesToCreate.has(pattern)) {
      rulesToCreate.set(pattern, newCat);
    }
  }

  // Persister les règles en batch
  const ruleRows = [...rulesToCreate.entries()].map(([pattern, cat]) => ({
    user_id: currentUser.id,
    pattern: pattern.toLowerCase(),
    category: cat,
    sub_category: null,
    priority: 200,
    is_generic: false
  }));
  if (ruleRows.length > 0) {
    try {
      await sb.from('merchant_rules').upsert(ruleRows, { onConflict: 'pattern' });
      // Ajouter au state local
      ruleRows.forEach(r => {
        rules = rules.filter(existing => existing.pattern !== r.pattern);
        rules.push(r);
      });
    } catch (e) {
      console.error('bulk rules', e);
    }
  }

  // Appliquer les règles nouvellement créées aux transactions similaires dans l'import (non déjà catégorisées)
  let cascadeCount = 0;
  for (const pattern of rulesToCreate.keys()) {
    importPreviewData.forEach(other => {
      if (other._userCategorized || other._duplicate) return;
      if (other.merchant_key && other.merchant_key.includes(pattern)) {
        other.category = newCat;
        other.sub_category = null;
        other._userCategorized = true;
        cascadeCount++;
      }
    });
  }

  toast(`✓ ${selectedTxs.length} catégorisée(s) en ${newCat}${cascadeCount > 0 ? ` (+ ${cascadeCount} similaires)` : ''}`, 'success');
  selectedIndexes.clear();
  bulkCategory = '';
  showImportPreview();
}

function deleteBulkSelection() {
  if (selectedIndexes.size === 0) return;
  const n = selectedIndexes.size;
  openModal(
    `Supprimer ${n} transaction(s) ?`,
    `Ces transactions seront exclues de l'import (elles ne seront pas ajoutées à Supabase).`,
    () => {
      preservedScroll = window.scrollY;
      // Trier index décroissant pour éviter shift indices
      const sorted = [...selectedIndexes].sort((a, b) => b - a);
      sorted.forEach(i => {
        const t = importPreviewData[i];
        importMatches = importMatches.filter(m => m.new !== t);
        importPreviewData.splice(i, 1);
      });
      selectedIndexes.clear();
      toast(`${n} transaction(s) supprimée(s)`, 'success');
      showImportPreview();
    }
  );
}

function deleteImportTx(idx) {
  if (idx < 0 || idx >= importPreviewData.length) return;
  const t = importPreviewData[idx];
  preservedScroll = window.scrollY;
  importPreviewData.splice(idx, 1);
  importMatches = importMatches.filter(m => m.new !== t);
  toast(`"${t.label.substring(0, 30)}..." retirée`, 'success');
  showImportPreview();
}

function setPreviewFilter(kind, val) {
  if (kind === 'year') {
    previewFilterYear = val;
    previewFilterMonth = 'all'; // Reset month when year changes
  } else if (kind === 'month') previewFilterMonth = val;
  else if (kind === 'cat') previewFilterCat = val;
  showImportPreview();
}

async function recategorizeImportTx(idx, newCat) {
  if (idx < 0 || idx >= importPreviewData.length) return;
  const t = importPreviewData[idx];
  const oldCat = t.category;
  t.category = newCat;
  t.sub_category = null;
  t.sub_sub_category = null;
  t._userTaught = true;
  t._userCategorized = true;
  // Créer une règle perso pour ce marchand
  const key = t.merchant_key || merchantKey(t.label);
  // Prendre les 2-3 premiers mots significatifs comme pattern
  const words = key.split(' ').filter(w => w.length > 3);
  const pattern = words.slice(0, 2).join(' ') || key.substring(0, 20);
  if (pattern.length >= 3) {
    try {
      await sb.from('merchant_rules').upsert({
        user_id: currentUser.id,
        pattern: pattern.toLowerCase(),
        category: newCat,
        sub_category: null,
        priority: 200,
        is_generic: false
      }, { onConflict: 'pattern' });
      // Ajouter à l'état local
      rules = rules.filter(r => r.pattern !== pattern.toLowerCase());
      rules.push({ pattern: pattern.toLowerCase(), category: newCat, sub_category: null, priority: 200, is_generic: false });
      // Reappliquer aux autres transactions similaires dans l'import
      let count = 0;
      importPreviewData.forEach(other => {
        if (other !== t && !other._userTaught && other.merchant_key && other.merchant_key.includes(pattern)) {
          other.category = newCat;
          other.sub_category = null;
          other.sub_sub_category = null;
          other._userCategorized = true; // Elles passent aussi dans "Catégorisées"
          count++;
        }
      });
      toast(`✓ Règle "${pattern}" → ${newCat}${count > 0 ? ` (appliquée à ${count} autres)` : ''}`, 'success');
    } catch (e) {
      console.error(e);
      toast('Règle sauvegardée localement', '');
    }
  }
  showImportPreview();
}
// Sous-catégorie choisie sur une ligne d'import (gère « ➕ Autre… »)
// 🏦 Applique la banque choisie à TOUTES les opérations de l'import
function setImportBank(val) {
  if (val === '__other__') {
    const v = prompt('Nom de la banque :', importBank || '');
    if (v === null) { showImportPreview(); return; }
    importBank = (v || '').trim() || null;
  } else importBank = val || null;
  importPreviewData.forEach(t => { t.bank_source = importBank; });
  showImportPreview();
}
function setImportSubcat(idx, val) {
  const t = importPreviewData[idx]; if (!t) return;
  if (val === '__custom__') {
    const v = prompt('Sous-catégorie :', t.sub_category || '');
    if (v === null) { showImportPreview(); return; }
    t.sub_category = (v || '').trim() || null;
  } else t.sub_category = val || null;
  t.sub_sub_category = null;   // reset niveau 3 quand la sous-cat change
  t._userCategorized = true;
  showImportPreview();
}
function setImportSubsub(idx, val) {
  const t = importPreviewData[idx]; if (!t) return;
  if (val === '__custom__') {
    const v = prompt('Sous-sous-catégorie :', t.sub_sub_category || '');
    if (v === null) { showImportPreview(); return; }
    t.sub_sub_category = (v || '').trim() || null;
  } else t.sub_sub_category = val || null;
  t._userCategorized = true;
  showImportPreview();
}
function mergeMatch(i) {
  importPreviewData = importPreviewData.filter(t => t !== importMatches[i].new);
  importMatches.splice(i, 1);
  showImportPreview();
  toast('Doublon fusionné', 'success');
}
function keepBoth(i) {
  importMatches[i].new._duplicate = false;
  importMatches.splice(i, 1);
  showImportPreview();
}
function cancelImport() {
  importPreviewData = [];
  importMatches = [];
  ['import-preview', 'tx-import-preview'].forEach(id => { const el = $(id); if (el) { el.style.display = 'none'; el.innerHTML = ''; } });
  _setTxMainCardVisible(true);   // on ré-affiche la liste complète après l'import
}
// Masque/affiche la grosse liste des transactions (pour se concentrer, ou pendant un import)
let _txListHidden = false;
function _setTxMainCardVisible(show) {
  const card = $('tx-main-card');
  const help = $('help-transactions');
  if (card) card.style.display = show ? '' : 'none';
  if (help && !show) help.style.display = 'none';
  const btn = $('tx-toggle-list-btn');
  if (btn) { _txListHidden = !show; btn.textContent = show ? '🙈 Masquer la liste' : '👁 Afficher la liste'; }
}
function toggleTxList() {
  _setTxMainCardVisible(_txListHidden);   // inverse l'état courant
}

// ═══ 🗂 GESTION DES IMPORTS RÉCENTS (supprimer un lot ajouté) ═══
let _importBatches = [];
function toggleImportBatches() {
  const el = $('import-batches'); if (!el) return;
  const show = el.style.display === 'none' || !el.style.display;
  el.style.display = show ? 'block' : 'none';
  if (show) renderImportBatches();
}
function _batchSrcLabel(src) {
  if (src === 'import_photo') return '📸 Photo (ticket/liste)';
  if (src === 'manual') return '✍️ Saisie manuelle';
  if ((src || '').startsWith('import_')) return '📥 Import ' + src.replace('import_', '').toUpperCase();
  return src || 'autre';
}
function renderImportBatches() {
  const el = $('import-batches'); if (!el) return;
  // Regroupe par (jour d'AJOUT = created_at, source) → un lot = un import
  const groups = {};
  transactions.forEach(t => {
    const added = (t.created_at || '').slice(0, 10) || '?';
    const src = t.source || 'manual';
    const key = added + '|' + src;
    if (!groups[key]) groups[key] = { added, src, ids: [], total: 0 };
    groups[key].ids.push(t.id);
    groups[key].total += Math.abs(Number(t.amount) || 0);
  });
  _importBatches = Object.values(groups).sort((a, b) => (a.added < b.added ? 1 : -1)).slice(0, 30);
  const rows = _importBatches.map((b, i) => {
    const dd = b.added === '?' ? 'date inconnue' : b.added.split('-').reverse().join('/');
    return `<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--border-soft)">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700">${dd} <span style="font-size:12px;font-weight:500;color:var(--muted)">· ${_batchSrcLabel(b.src)}</span></div>
        <div style="font-size:12px;color:var(--muted)">${b.ids.length} opération(s) · ${fmt(Math.round(b.total))}</div>
      </div>
      <button class="btn-ghost" style="padding:6px 12px;font-size:12px;color:#E53935;border-color:#E53935" onclick="deleteImportBatch(${i})" title="Supprimer tout ce lot">🗑 Supprimer ce lot</button>
    </div>`;
  }).join('');
  // Résumé « aujourd'hui » : tout ce qui a été ajouté aujourd'hui (toutes sources confondues)
  const today = _todayISO();
  const todayCount = transactions.filter(t => (t.created_at || '').slice(0, 10) === today).length;
  const todayBanner = todayCount ? `<div style="display:flex;align-items:center;gap:12px;background:rgba(229,57,53,0.08);border:1px solid #E53935;border-radius:10px;padding:12px 14px;margin-bottom:14px;flex-wrap:wrap">
      <div style="flex:1;min-width:0"><b>${todayCount} opération(s) ajoutée(s) aujourd'hui</b> (${today.split('-').reverse().join('/')}) <div style="font-size:12px;color:var(--muted)">toutes sources confondues (import, photo, saisie)</div></div>
      <button class="btn-primary" style="padding:8px 14px;font-size:13px;background:#E53935" onclick="deleteAllToday()">🗑 Tout supprimer (aujourd'hui)</button>
    </div>` : '';
  el.innerHTML = `
    <div class="card-hd"><div class="card-title">🗂 Mes imports récents</div>
      <button class="btn-ghost" style="padding:5px 10px;font-size:12px" onclick="toggleImportBatches()">Fermer</button></div>
    ${todayBanner}
    <div style="display:flex;align-items:center;gap:12px;background:var(--sage-soft);border-radius:10px;padding:12px 14px;margin-bottom:14px;flex-wrap:wrap">
      <div style="flex:1;min-width:0"><b>🧹 Nettoyer l'historique</b><div style="font-size:12px;color:var(--muted)">Applique les dernières règles à TOUTES tes transactions : Livres → Vie quotidienne · Restaurant/Sorties → Restos · chouchane→Fast food · gelato/philomène→Restos. Rien n'est supprimé.</div></div>
      <button class="btn-primary" style="padding:8px 14px;font-size:13px" onclick="cleanupHistory()">🧹 Nettoyer</button>
    </div>
    <div style="display:flex;align-items:center;gap:12px;background:rgba(127,184,158,0.16);border-radius:10px;padding:12px 14px;margin-bottom:14px;flex-wrap:wrap">
      <div style="flex:1;min-width:0"><b>🎬 Démo complète (3 ans)</b><div style="font-size:12px;color:var(--muted)">Remplit TOUTES les pages (transactions, patrimoine, épargne, remboursements, dettes) sur 2023-2025. Taguée « démo », supprimable.</div></div>
      <button class="btn-ghost" style="padding:8px 12px;font-size:13px" onclick="generateFullDemo()">🎬 Générer</button>
      <button class="btn-ghost" style="padding:8px 12px;font-size:13px;color:#E53935;border-color:#E53935" onclick="deleteFullDemo()">🗑 Retirer la démo</button>
    </div>
    <p class="page-sub" style="margin:0 0 10px">Ci-dessous, chaque ligne = un <b>lot ajouté</b> (par date d'ajout + source). Supprime un lot entier pour le ré-importer proprement.</p>
    ${rows || '<div class="empty-sub">Aucune opération enregistrée.</div>'}`;
}
// 🧹 Ré-applique les nouvelles catégories à tout l'historique (sans Supabase)
async function cleanupHistory() {
  const ok = await confirmDialog('🧹 Nettoyer l\'historique ?', `<div style="font-size:14px;line-height:1.6">Je corrige tes anciennes transactions selon les nouvelles catégories :<ul style="margin:8px 0;padding-left:18px"><li>« Livres » → Vie quotidienne / Papeterie & fournitures</li><li>Alimentation : « Restaurant » et « Sorties » → « Restos »</li><li>chouchane/snack → Fast food · gelato/philomène → Restos</li></ul><b>Rien n'est supprimé</b>, juste re-classé. Continuer ?</div>`);
  if (!ok) return;
  const groups = {};   // clé cat|sub|ss → { cat, sub, ss, ids, local[] }
  transactions.forEach(t => {
    let cat = t.category, sub = t.sub_category, ss = t.sub_sub_category;
    // Livres (catégorie supprimée)
    if (cat === 'Livres') { cat = 'Vie quotidienne'; sub = 'Papeterie & fournitures'; ss = ss || 'Livres'; }
    // Marchands précis (par libellé)
    const L = (t.label || '').toLowerCase();
    if (/chouchane|\bsnack\b/.test(L)) { cat = 'Alimentation'; sub = 'Fast food'; ss = null; }
    else if (/gelato|philom/.test(L)) { cat = 'Alimentation'; sub = 'Restos'; ss = null; }
    // Fusion Restaurant/Sorties + Fast-food dans Alimentation
    if (cat === 'Alimentation') {
      if (['Restaurant', 'Sorties', 'Sortie'].includes(sub)) sub = 'Restos';
      if (/^fast[\s-]?food$/i.test(ss || '')) { sub = 'Fast food'; ss = null; }
      if (sub === 'Restos' && ss === 'Restaurant') ss = null;
    }
    const changed = cat !== t.category || (sub || null) !== (t.sub_category || null) || (ss || null) !== (t.sub_sub_category || null);
    if (!changed) return;
    const key = `${cat}|${sub || ''}|${ss || ''}`;
    if (!groups[key]) groups[key] = { cat, sub: sub || null, ss: ss || null, ids: [], local: [] };
    groups[key].ids.push(t.id); groups[key].local.push(t);
  });
  const gList = Object.values(groups);
  const totalN = gList.reduce((s, g) => s + g.ids.length, 0);
  if (!totalN) { toast('✓ Rien à nettoyer, tout est déjà à jour', 'success'); return; }
  toast(`Nettoyage de ${totalN} transaction(s)…`);
  let done = 0;
  for (const g of gList) {
    for (let j = 0; j < g.ids.length; j += 200) {
      const chunk = g.ids.slice(j, j + 200);
      const payload = _sanitizeTx({ category: g.cat, sub_category: g.sub, sub_sub_category: g.ss });
      const { error } = await sb.from('transactions').update(payload).in('id', chunk);
      if (error) { toast('Erreur : ' + error.message, 'error'); console.error(error); renderTransactionsList(); return; }
      done += chunk.length;
    }
    g.local.forEach(t => { t.category = g.cat; t.sub_category = g.sub; t.sub_sub_category = g.ss; });
  }
  toast(`✓ ${done} transaction(s) nettoyée(s) et reclassée(s)`, 'success', 5000);
  renderImportBatches();
  renderTransactionsList();
}

// 🎬 DÉMO COMPLÈTE : remplit TOUTES les pages (transactions, patrimoine, épargne, remboursements, dettes) sur 2023-2025
const DEMO_TAG = '[démo]';
async function generateFullDemo() {
  const ok = await confirmDialog('🎬 Générer une démo complète ?', `<div style="font-size:14px;line-height:1.6">Je vais remplir <b>toutes les pages</b> avec du fictif sur <b>2023, 2024, 2025</b> :<ul style="margin:8px 0;padding-left:18px"><li>~1 100 transactions (dashboard, analyse, calendrier)</li><li>patrimoine mensuel (suivi mensuel)</li><li>objectifs d'épargne, remboursements, paiements en plusieurs fois</li></ul>Tout est tagué « démo » et supprimable en un clic (bouton juste en dessous). Continuer ?</div>`);
  if (!ok) return;
  const R = (a, b) => Math.round((a + Math.random() * (b - a)) * 100) / 100;
  const P = a => a[Math.floor(Math.random() * a.length)];
  const D = () => String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
  const N = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
  const uid = currentUser.id;
  toast('🎬 Génération de la démo…');

  // ── 1) TRANSACTIONS ──
  const tx = [];
  const add = (date, label, amount, type, cat, sub = null, ss = null, bank = 'LCL', pm = 'carte') =>
    tx.push({ user_id: uid, date_op: date, label, amount: type === 'entree' ? Math.abs(amount) : -Math.abs(amount), type, category: cat, sub_category: sub, sub_sub_category: ss, source: 'import_csv', comment: DEMO_TAG, account: 'Compte courant', bank_source: bank, payment_method: pm });
  const SUP = ['CARREFOUR', 'LIDL', 'AUCHAN', 'FRANPRIX', 'MONOPRIX', 'E.LECLERC', 'INTERMARCHE', 'CASINO'];
  const RESTO = ['LE BISTROT', 'SUSHI SHOP', 'PIZZA ROMA', 'LA TRATTORIA', 'WOK 88', 'CHEZ LEON'];
  const FAST = ['MCDONALDS', 'BURGER KING', 'KFC', 'O TACOS', 'SUBWAY', 'SNACK CHOUCHANE'];
  const BOUL = ['BOULANGERIE PAUL', 'MARIE BLACHERE', 'LA MIE CALINE'];
  const MODE = ['ZARA', 'H&M', 'UNIQLO', 'SHEIN', 'KIABI'];
  const VQ = [['ACTION', 'Hygiène & entretien', 'Produits ménagers'], ['IKEA', 'Maison & déco', 'Décoration'], ['GIFI', 'Maison & déco', null], ['NORMAL', 'Hygiène & entretien', 'Lessive']];
  const TRANSP = [['SNCF', 'Train'], ['RATP NAVIGO', 'Bus / Métro'], ['TOTAL ENERGIES', 'Essence'], ['UBER', 'Uber / VTC']];
  const ABO = [['NETFLIX', 'Streaming', 13.49], ['SPOTIFY', 'Streaming', 10.99], ['FREE MOBILE', 'Téléphone', 19.99], ['ORANGE FIBRE', 'Internet', 39.99], ['BASIC FIT', 'Salle de sport', 29.99]];
  const SANTE = [['PHARMACIE CENTRALE', 'Pharmacie'], ['DR MARTIN', 'Médecin'], ['DENTISTE DUPONT', 'Dentiste']];
  const DIV = [['UGC CINE', 'Cinéma'], ['FNAC SPECTACLES', 'Concerts'], ['STEAM', 'Jeux']];
  const NAMES = ['JULIE', 'MARC', 'SOPHIE', 'KEVIN', 'AMINA'];
  for (const y of [2023, 2024, 2025]) for (let m = 1; m <= 12; m++) {
    const mk = `${y}-${String(m).padStart(2, '0')}`;
    add(`${mk}-02`, 'VIREMENT SALAIRE ' + mk, R(1950, 2450), 'entree', 'Salaire', null, null, 'LCL', 'virement');
    add(`${mk}-05`, 'LOYER APPARTEMENT', 490, 'sortie', 'Loyer', null, null, 'LCL', 'prelevement');
    for (let i = 0; i < N(5, 8); i++) add(`${mk}-${D()}`, P(SUP), R(12, 90), 'sortie', 'Alimentation', 'Courses', P(['Fruits & légumes', 'Viande', 'Épicerie salée', 'Boissons']));
    for (let i = 0; i < N(1, 4); i++) add(`${mk}-${D()}`, P(RESTO), R(15, 55), 'sortie', 'Alimentation', 'Restos');
    for (let i = 0; i < N(1, 3); i++) add(`${mk}-${D()}`, P(FAST), R(8, 22), 'sortie', 'Alimentation', 'Fast food');
    for (let i = 0; i < N(1, 4); i++) add(`${mk}-${D()}`, P(BOUL), R(2, 11), 'sortie', 'Alimentation', 'Boulangerie');
    for (let i = 0; i < N(2, 3); i++) { const [l, s] = P(TRANSP); add(`${mk}-${D()}`, l, R(10, 70), 'sortie', 'Transport', s); }
    ABO.slice().sort(() => Math.random() - .5).slice(0, N(2, 4)).forEach(([l, s, a]) => add(`${mk}-${D()}`, l, a, 'sortie', 'Abonnements', s, null, 'BoursoBank', 'prelevement'));
    for (let i = 0; i < N(1, 2); i++) { const [l, s, ss] = P(VQ); add(`${mk}-${D()}`, l, R(8, 60), 'sortie', 'Vie quotidienne', s, ss); }
    if (Math.random() < .4) add(`${mk}-${D()}`, P(MODE), R(20, 120), 'sortie', 'Mode', 'Vêtements');
    if (Math.random() < .4) { const [l, s] = P(SANTE); add(`${mk}-${D()}`, l, R(8, 55), 'sortie', 'Santé', s); }
    if (Math.random() < .5) { const [l, s] = P(DIV); add(`${mk}-${D()}`, l, R(8, 45), 'sortie', 'Divertissement', s); }
    if (Math.random() < .3) add(`${mk}-${D()}`, 'CADEAU ' + P(NAMES), R(15, 80), 'sortie', 'Amis & Famille', 'Cadeaux', null, 'LCL', 'virement');
    if (Math.random() < .7) add(`${mk}-${D()}`, 'DIME EGLISE', R(50, 200), 'sortie', 'Dîme', null, null, 'LCL', 'virement');
    if (Math.random() < .12) add(`${mk}-${D()}`, P(['AIRBNB', 'BOOKING', 'AIR FRANCE']), R(80, 400), 'sortie', 'Voyages', 'Hébergement');
    add(`${mk}-${D()}`, 'VIREMENT EPARGNE', R(120, 350), 'epargne', 'Épargne', null, null, 'BoursoBank', 'virement');
  }
  for (let i = 0; i < tx.length; i += 200) {
    const { error } = await sb.from('transactions').insert(tx.slice(i, i + 200).map(_sanitizeTx));
    if (error) { toast('Erreur transactions : ' + error.message, 'error'); console.error(error); return; }
  }

  // ── 2) PATRIMOINE (tracker_mensuel) : soldes qui grossissent ──
  const trk = [];
  let lcl = 800, bourso = 1500, livret = 3000, invest = 500;
  for (const y of [2023, 2024, 2025]) for (let m = 1; m <= 12; m++) {
    lcl = Math.max(200, lcl + R(-200, 400)); bourso += R(-100, 500); livret += R(50, 400); invest += R(0, 300);
    trk.push({ user_id: uid, month: `${y}-${String(m).padStart(2, '0')}-01`, lcl: Math.round(lcl), bourso: Math.round(bourso), especes: R(20, 120), livret_a: Math.round(livret), investissements: Math.round(invest) });
  }
  for (let i = 0; i < trk.length; i += 200) { try { await sb.from('tracker_mensuel').upsert(trk.slice(i, i + 200), { onConflict: 'user_id,month' }); } catch (e) { console.error('tracker', e); } }

  // ── 3) OBJECTIFS D'ÉPARGNE + contributions ──
  try {
    const goals = [
      { user_id: uid, nom: 'Vacances Bali ' + DEMO_TAG, emoji: '🏝️', cible: 3000, deja_epargne: 1850, date_cible: '2025-08-01', note: DEMO_TAG },
      { user_id: uid, nom: 'Fonds d\'urgence ' + DEMO_TAG, emoji: '🛟', cible: 5000, deja_epargne: 4200, note: DEMO_TAG },
      { user_id: uid, nom: 'Nouveau PC ' + DEMO_TAG, emoji: '💻', cible: 1500, deja_epargne: 1500, statut: 'atteint', note: DEMO_TAG }
    ];
    const { data: gd } = await sb.from('epargne_objectifs').insert(goals).select();
    if (gd) { const contribs = gd.flatMap(g => [{ objectif_id: g.id, user_id: uid, montant: Math.round(g.deja_epargne * 0.6), note: DEMO_TAG }, { objectif_id: g.id, user_id: uid, montant: Math.round(g.deja_epargne * 0.4), note: DEMO_TAG }]); await sb.from('epargne_contributions').insert(contribs); }
  } catch (e) { console.error('goals', e); }

  // ── 4) REMBOURSEMENTS / ENVELOPPES / DETTES ──
  try {
    await sb.from('remboursements').insert([
      { user_id: uid, tiers: 'Julie', montant: 120, sens: 'on_me_doit', motif: 'Resto ' + DEMO_TAG },
      { user_id: uid, tiers: 'Marc', montant: 45, sens: 'je_dois', motif: 'Ciné ' + DEMO_TAG }
    ]);
  } catch (e) { console.error('remb', e); }
  try { await sb.from('enveloppes').insert([{ user_id: uid, nom: 'Noël ' + DEMO_TAG, emoji: '🎁', objectif: 400, mensuel: 40, actuel: 240 }]); } catch (e) { console.error('env', e); }
  try {
    await sb.from('dettes').insert([
      { user_id: uid, nom: 'Klarna canapé ' + DEMO_TAG, montant_total: 600, mensualite: 100, deja_paye: 400 },
      { user_id: uid, nom: 'iPhone 3x ' + DEMO_TAG, montant_total: 900, mensualite: 300, deja_paye: 300 }
    ]);
  } catch (e) { console.error('dettes', e); }

  // ── 5) BUDGETS mensuels (2023-2025) : pour remplir la page Gestion du budget ──
  try {
    const bud = [];
    for (const y of [2023, 2024, 2025]) for (let m = 1; m <= 12; m++) {
      const sbud = JSON.parse(JSON.stringify(DEFAULT_SUB_PCT));
      sbud._pctCharges = 50; sbud._pctPlaisir = 30; sbud._pctEpargne = 20; sbud._pctImprevus = 0;
      bud.push({ user_id: uid, month: `${y}-${String(m).padStart(2, '0')}-01`, revenu_mensuel: 2200, pct_charges: 50, pct_plaisir: 30, pct_epargne: 20, sub_budget: sbud, events: [] });
    }
    for (let i = 0; i < bud.length; i += 200) await sb.from('budget_mensuel').upsert(bud.slice(i, i + 200), { onConflict: 'user_id,month' });
  } catch (e) { console.error('budget demo', e); }

  await loadAllData(); await loadExtra();
  if (typeof loadBudgetPrep === 'function') { try { await loadBudgetPrep(); } catch (e) {} }
  if (typeof loadInvestissements === 'function') { try { await loadInvestissements(); } catch (e) {} }
  // Bascule les vues sur 2025 pour que la démo soit visible tout de suite
  dashYear = 2025; if (typeof dashMonth !== 'undefined') dashMonth = -1;
  budgetYear = 2025; budgetMonth = 11; if (typeof loadBudgetForMonth === 'function') loadBudgetForMonth();
  toast(`✓ Démo complète générée : ${tx.length} transactions + patrimoine + épargne + budgets 🎬 — vues placées sur 2025`, 'success', 7000);
  renderImportBatches(); renderTransactionsList();
  if (typeof renderDashboard === 'function') renderDashboard();
}
// 🧹 Supprime toute la démo complète (tous les tags [démo])
async function deleteFullDemo() {
  const ok = await confirmDialog('Supprimer toute la démo ?', `<div style="font-size:14px;line-height:1.6">Je supprime tout ce qui est tagué <b>« démo »</b> : transactions, patrimoine 2023-2025, objectifs d'épargne, remboursements, enveloppes, dettes de démo.<br><br>Tes vraies données ne sont pas touchées. Continuer ?</div>`);
  if (!ok) return;
  toast('Suppression de la démo…');
  try { await sb.from('transactions').delete().eq('user_id', currentUser.id).eq('comment', DEMO_TAG); } catch (e) { console.error(e); }
  try { await sb.from('tracker_mensuel').delete().eq('user_id', currentUser.id).gte('month', '2023-01-01').lte('month', '2025-12-01'); } catch (e) { console.error(e); }
  try { await sb.from('budget_mensuel').delete().eq('user_id', currentUser.id).gte('month', '2023-01-01').lte('month', '2025-12-01'); } catch (e) { console.error(e); }
  try { await sb.from('epargne_contributions').delete().eq('user_id', currentUser.id).eq('note', DEMO_TAG); } catch (e) { console.error(e); }
  try { await sb.from('epargne_objectifs').delete().eq('user_id', currentUser.id).eq('note', DEMO_TAG); } catch (e) { console.error(e); }
  try { await sb.from('remboursements').delete().eq('user_id', currentUser.id).ilike('motif', '%' + DEMO_TAG + '%'); } catch (e) { console.error(e); }
  try { await sb.from('enveloppes').delete().eq('user_id', currentUser.id).ilike('nom', '%' + DEMO_TAG + '%'); } catch (e) { console.error(e); }
  try { await sb.from('dettes').delete().eq('user_id', currentUser.id).ilike('nom', '%' + DEMO_TAG + '%'); } catch (e) { console.error(e); }
  await loadAllData(); await loadExtra();
  if (typeof loadBudgetPrep === 'function') { try { await loadBudgetPrep(); } catch (e) {} }
  toast('✓ Démo supprimée', 'success');
  renderImportBatches(); renderTransactionsList();
}

// Supprime TOUT ce qui a été ajouté aujourd'hui (toutes sources)
async function deleteAllToday() {
  const today = _todayISO();
  const ids = transactions.filter(t => (t.created_at || '').slice(0, 10) === today).map(t => t.id);
  if (!ids.length) { toast('Rien n\'a été ajouté aujourd\'hui', 'error'); return; }
  const ok = await confirmDialog('Tout supprimer (aujourd\'hui) ?', `<div style="font-size:14px;line-height:1.6">Tu vas supprimer les <b>${ids.length} opération(s)</b> ajoutées aujourd'hui (<b>${today.split('-').reverse().join('/')}</b>), toutes sources confondues.<br><br>C'est <b>irréversible</b>, mais tu pourras tout ré-importer proprement. Continuer ?</div>`);
  if (!ok) return;
  toast(`Suppression de ${ids.length} opération(s)…`);
  for (let j = 0; j < ids.length; j += 200) {
    const chunk = ids.slice(j, j + 200);
    const { error } = await sb.from('transactions').delete().in('id', chunk);
    if (error) { toast('Erreur : ' + error.message, 'error'); console.error(error); return; }
  }
  const gone = new Set(ids);
  transactions = transactions.filter(t => !gone.has(t.id));
  toast(`✓ ${ids.length} opération(s) d'aujourd'hui supprimée(s)`, 'success');
  renderImportBatches();
  renderTransactionsList();
}
async function deleteImportBatch(i) {
  const b = _importBatches[i]; if (!b || !b.ids.length) return;
  const dd = b.added === '?' ? 'date inconnue' : b.added.split('-').reverse().join('/');
  const ok = await confirmDialog('Supprimer ce lot ?', `<div style="font-size:14px;line-height:1.6">Tu vas supprimer <b>${b.ids.length} opération(s)</b> ajoutées le <b>${dd}</b> (${esc(_batchSrcLabel(b.src))}).<br><br>C'est <b>irréversible</b>, mais tu pourras les ré-importer. Continuer ?</div>`);
  if (!ok) return;
  toast(`Suppression de ${b.ids.length} opération(s)…`);
  for (let j = 0; j < b.ids.length; j += 200) {
    const chunk = b.ids.slice(j, j + 200);
    const { error } = await sb.from('transactions').delete().in('id', chunk);
    if (error) { toast('Erreur : ' + error.message, 'error'); console.error(error); return; }
  }
  const gone = new Set(b.ids);
  transactions = transactions.filter(t => !gone.has(t.id));
  toast(`✓ ${b.ids.length} opération(s) supprimée(s)`, 'success');
  renderImportBatches();
  renderTransactionsList();
}

async function confirmImport() {
  const toAdd = importPreviewData.filter(t => !t._duplicate).map(t => ({
    user_id: currentUser.id,
    date_op: t.date_op,
    label: t.label,
    amount: t.amount,
    type: t.type,
    category: t.category,
    sub_category: t.sub_category,
    sub_sub_category: t.sub_sub_category || null,
    source: 'import_' + (t._source || 'csv'),
    merchant_key: t.merchant_key,
    account: t.account || 'Compte courant',
    comment: t.comment || null,
    payment_method: t.payment_method || detectPaymentMethod(t.label),
    bank_source: t.bank_source || null
  }));
  if (!toAdd.length) { toast('Rien à importer', 'error'); return; }
  toast(`Import de ${toAdd.length} transactions…`);
  // Insert en batch
  const batchSize = 200;
  for (let i = 0; i < toAdd.length; i += batchSize) {
    const batch = toAdd.slice(i, i + batchSize).map(_sanitizeTx);
    const { error } = await sb.from('transactions').insert(batch);
    if (error) { toast('Erreur : ' + error.message, 'error'); console.error(error); return; }
  }
  const fromTx = importPreviewTarget === 'tx-import-preview';
  await loadAllData();
  cancelImport();
  toast(`📥 ${toAdd.length} transaction(s) importée(s) ✓`, 'success', 5000);
  if (fromTx) { showTab('transactions'); if (typeof renderTransactionsList === 'function') renderTransactionsList(); }
  else showTab('calendar');
}

// ═══ 📸 PHOTO → LISTE DE COURSES / TRANSACTIONS ════════════════════
let _ticketDraft = [];  // lignes en cours de revue
let _ticketSel = new Set();   // 🏷️ articles cochés pour catégorisation groupée
let _ticketBulk = { category: 'Alimentation', sub_category: '', sub_sub_category: '' };
function ticketToggleSel(k, checked) { if (checked) _ticketSel.add(k); else _ticketSel.delete(k); renderTicketReview(); }
function ticketSelectAll(checked) { _ticketSel = checked ? new Set(_ticketDraft.map((_, i) => i)) : new Set(); renderTicketReview(); }
function ticketBulkCat(val) { _ticketBulk.category = val; _ticketBulk.sub_category = ''; _ticketBulk.sub_sub_category = ''; renderTicketReview(); }
function ticketBulkSub(val) {
  if (val === '__custom__') { const v = prompt('Sous-catégorie :', _ticketBulk.sub_category || ''); if (v === null) { renderTicketReview(); return; } _ticketBulk.sub_category = (v || '').trim(); }
  else _ticketBulk.sub_category = val;
  _ticketBulk.sub_sub_category = ''; renderTicketReview();
}
function ticketBulkSubsub(val) {
  if (val === '__custom__') { const v = prompt('Sous-sous-catégorie :', _ticketBulk.sub_sub_category || ''); if (v === null) { renderTicketReview(); return; } _ticketBulk.sub_sub_category = (v || '').trim(); }
  else _ticketBulk.sub_sub_category = val;
  renderTicketReview();
}
function ticketApplyBulk() {
  if (!_ticketSel.size) return;
  const n = _ticketSel.size;
  _ticketSel.forEach(k => { const it = _ticketDraft[k]; if (it) { it.category = _ticketBulk.category; it.sub_category = _ticketBulk.sub_category; it.sub_sub_category = _ticketBulk.sub_sub_category; } });
  _ticketSel = new Set();
  renderTicketReview();
  toast(`✓ ${n} article(s) → ${_ticketBulk.category}${_ticketBulk.sub_category ? ' · ' + _ticketBulk.sub_category : ''}`, 'success');
}

// Compresse une image (canvas) → { data: base64 sans préfixe, media_type }
function _compressImage(file, maxDim = 1300, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let { width: w, height: h } = img;
        if (!w || !h) { URL.revokeObjectURL(url); return reject(new Error('Dimensions image nulles')); }
        const scale = Math.min(1, maxDim / Math.max(w, h));
        w = Math.round(w * scale); h = Math.round(h * scale);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = cv.toDataURL('image/jpeg', quality);
        URL.revokeObjectURL(url);
        resolve({ data: dataUrl.split(',')[1], media_type: 'image/jpeg' });
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('canvas-failed')); };
    img.src = url;
  });
}
// Lit un fichier directement en base64 (secours si la conversion canvas échoue)
function _fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const s = String(r.result || ''); resolve(s.split(',')[1] || ''); };
    r.onerror = () => reject(new Error('Lecture du fichier impossible'));
    r.readAsDataURL(file);
  });
}
// Prépare l'image pour l'IA : compresse en JPEG, avec secours si le format bloque le canvas
async function _prepareTicketImage(file) {
  try {
    return await _compressImage(file);
  } catch (e) {
    // Secours : si c'est déjà un format lisible par l'IA, on l'envoie brut
    const t = (file.type || '').toLowerCase();
    if (/(jpeg|jpg|png|webp|gif)/.test(t)) {
      const data = await _fileToBase64(file);
      return { data, media_type: t.includes('png') ? 'image/png' : (t.includes('webp') ? 'image/webp' : (t.includes('gif') ? 'image/gif' : 'image/jpeg')) };
    }
    // HEIC (photo iPhone) que le navigateur n'a pas su convertir
    throw new Error('Ce format de photo (souvent HEIC des iPhones) n\'a pas pu être lu ici. Refais la photo, ou dans Réglages iPhone → Appareil photo → Formats → choisis « Le plus compatible » (JPEG).');
  }
}

async function handleTicketPhoto(file) {
  if (!file) return;
  const status = $('ticket-status');
  const review = $('ticket-review');
  if (!status || !review) { toast('Ouvre la page Courses pour scanner une photo', 'error'); return; }
  review.style.display = 'none'; review.innerHTML = '';
  status.style.display = 'block';
  // Chrono visible + étape en cours, pour qu'on VOIE que ça travaille (et où ça s'arrête)
  let _t0 = 0, _step = 'Préparation de la photo…';
  const setStatus = () => { status.innerHTML = `<div style="display:flex;align-items:center;gap:10px;color:var(--muted);font-size:14px"><span class="spinner"></span> ${esc(_step)} <b style="font-family:var(--fm)">${_t0}s</b></div>`; };
  setStatus();
  const ticker = setInterval(() => { _t0++; setStatus(); }, 1000);
  const showError = (msg) => { status.innerHTML = `<div style="padding:12px 14px;border-radius:10px;background:rgba(229,57,53,0.10);border:1px solid #E53935;color:#C62828;font-size:13px;line-height:1.5">⚠ <b>Échec de la lecture</b><br>${esc(msg)}</div>`; };
  try {
    const { data, media_type } = await _prepareTicketImage(file);
    console.log('[ticket] image prête', media_type, Math.round((data || '').length / 1024) + ' Ko (base64)');
    if (!data) throw new Error('Image vide après préparation. Réessaie avec une autre photo.');
    _step = 'Monie lit ta photo…';
    setStatus();
    // Appel IA avec un délai max de 60s (évite de rester bloqué indéfiniment)
    const invokePromise = sb.functions.invoke('monie-ai', { body: { mode: 'ticket', image: data, media_type } });
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('Temps dépassé (60s). La photo est peut-être trop lourde, ou l\'IA a mis trop de temps. Réessaie.')), 60000));
    const { data: res, error } = await Promise.race([invokePromise, timeout]);
    console.log('[ticket] réponse IA', { error, res });
    if (error) throw new Error((error.message || 'Erreur de la fonction IA') + ' — vérifie ta connexion et réessaie.');
    if (res && res.error) throw new Error(res.error);
    const items = Array.isArray(res?.items) ? res.items : [];
    if (!items.length) {
      clearInterval(ticker);
      status.innerHTML = `<div class="empty-sub" style="padding:10px 0">😕 Aucun produit détecté sur la photo. Réessaie avec une photo plus nette, bien à plat et bien éclairée.</div>`;
      return;
    }
    // Pré-catégorisation : on prend d'abord la catégorie de groupe suggérée par l'IA, sinon les règles locales
    _ticketDraft = items.map(it => {
      const g = categorize(it.label, -Math.abs(it.price || 0));
      const aiCat = (it.category && CAT_META[it.category]) ? it.category : null;   // catégorie IA valide ?
      return {
        label: it.label || '',
        brand: it.brand || '',
        price: (it.price != null ? Number(it.price) : ''),
        qty: it.qty || 1,
        category: aiCat || (g.category !== 'Autres' ? g.category : 'Alimentation'),
        sub_category: aiCat ? (it.sub_category || '') : (g.sub_category || ''),
        sub_sub_category: ''
      };
    });
    clearInterval(ticker);
    status.style.display = 'none';
    renderTicketReview();
  } catch (e) {
    clearInterval(ticker);
    console.error('[ticket] échec', e);
    showError(e && e.message ? e.message : 'La lecture a échoué. Réessaie.');
  } finally {
    clearInterval(ticker);
    if ($('ticket-file')) $('ticket-file').value = '';
  }
}

function _ticketCatSelect(k) {
  const cur = _ticketDraft[k].category;
  return Object.keys(CAT_META).sort().map(c =>
    `<option value="${esc(c)}" ${c === cur ? 'selected' : ''}>${CAT_META[c].emoji} ${esc(c)}</option>`).join('');
}
function renderTicketReview() {
  const review = $('ticket-review');
  const total = _ticketDraft.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);
  const rows = _ticketDraft.map((it, k) => `
    <div style="border:1.5px solid ${_ticketSel.has(k) ? 'var(--rose)' : 'var(--border-soft)'};border-radius:12px;padding:12px;margin-bottom:10px;background:${_ticketSel.has(k) ? 'var(--rose-soft)' : 'white'}">
      <div style="display:grid;grid-template-columns:24px minmax(0,1fr) 70px 44px 30px;gap:8px;align-items:center;margin-bottom:8px">
        <input type="checkbox" class="bud-sub-check" ${_ticketSel.has(k) ? 'checked' : ''} onchange="ticketToggleSel(${k},this.checked)" title="Sélectionner pour catégoriser en lot">
        <input class="inp" value="${esc(it.label)}" onchange="ticketField(${k},'label',this.value)" placeholder="Produit" style="padding:7px 9px;font-size:13px;min-width:0">
        <div style="display:flex;align-items:center;gap:2px">
          <input class="inp" type="number" step="0.01" min="0" value="${it.price}" onchange="ticketField(${k},'price',this.value)" placeholder="€" style="padding:7px 6px;text-align:right;font-family:var(--fm);min-width:0">
          <span style="font-size:11px;color:var(--muted)">€</span>
        </div>
        <input class="inp" type="number" step="1" min="1" value="${it.qty}" onchange="ticketField(${k},'qty',this.value)" title="Quantité" style="padding:7px 5px;text-align:center;min-width:0">
        <button class="bud-sub-del" onclick="ticketDeleteLine(${k})" title="Retirer cette ligne">🗑</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-size:13px;flex-shrink:0">🏷️</span>
        <input class="inp" value="${esc(it.brand)}" onchange="ticketField(${k},'brand',this.value)" placeholder="Marque du produit (ex : Skyr, Alpro, Ariel, Eco+…)" style="padding:8px 10px;font-size:13px;font-weight:600;flex:1;min-width:0;box-sizing:border-box;border-color:var(--rose)">
      </div>
      <div class="ticket-cat3">
        <select class="select" title="Catégorie" onchange="ticketCat(${k},this.value)">${_ticketCatSelect(k)}</select>
        <select class="select" title="Sous-catégorie" onchange="ticketSubSelect(${k},this.value)">${subcatOptions(it.category, it.sub_category)}</select>
        <select class="select" title="Sous-sous-catégorie (facultatif)" onchange="ticketSubsubSelect(${k},this.value)">${subsubOptions(it.category, it.sub_category, it.sub_sub_category)}</select>
      </div>
    </div>`).join('');
  const _bulkCatOpts = Object.keys(CAT_META).sort().map(c => `<option value="${esc(c)}" ${c === _ticketBulk.category ? 'selected' : ''}>${CAT_META[c].emoji} ${esc(c)}</option>`).join('');
  const bulkBar = _ticketSel.size ? `
    <div style="background:var(--rose-soft);border:1.5px solid var(--rose);border-radius:12px;padding:12px;margin-bottom:12px">
      <div style="font-weight:700;font-size:13px;margin-bottom:8px">🏷️ ${_ticketSel.size} article(s) sélectionné(s) — catégoriser en lot :</div>
      <div class="ticket-cat3" style="margin-bottom:8px">
        <select class="select" title="Catégorie" onchange="ticketBulkCat(this.value)">${_bulkCatOpts}</select>
        <select class="select" title="Sous-catégorie" onchange="ticketBulkSub(this.value)">${subcatOptions(_ticketBulk.category, _ticketBulk.sub_category)}</select>
        <select class="select" title="Sous-sous-catégorie" onchange="ticketBulkSubsub(this.value)">${subsubOptions(_ticketBulk.category, _ticketBulk.sub_category, _ticketBulk.sub_sub_category)}</select>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-primary" style="padding:7px 14px;font-size:13px" onclick="ticketApplyBulk()">✓ Appliquer à la sélection</button>
        <button class="btn-ghost" style="padding:7px 12px;font-size:13px" onclick="ticketSelectAll(false)">Tout désélectionner</button>
      </div>
    </div>` : `<label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted);margin-bottom:10px;cursor:pointer;padding:8px 10px;background:var(--bg);border-radius:8px"><input type="checkbox" onchange="ticketSelectAll(this.checked)"> ✅ Coche plusieurs articles pour les catégoriser <b>en une fois</b> (ex : tous tes produits d'alimentation)</label>`;
  review.style.display = 'block';
  review.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-weight:800;font-size:15px">🧾 ${_ticketDraft.length} produit(s) lu(s)</div>
      <div style="font-family:var(--fm);font-weight:800;color:var(--rose)">${fmt(Math.round(total))}</div>
    </div>
    ${bulkBar}
    ${rows}
    <button class="btn-ghost" style="padding:6px 12px;font-size:13px;margin-bottom:16px" onclick="ticketAddLine()">+ Ajouter une ligne</button>

    <div style="background:var(--bg);border-radius:12px;padding:14px;margin-bottom:14px">
      <div style="font-weight:700;font-size:13px;margin-bottom:10px">Où veux-tu ajouter ces produits ?</div>
      <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;font-size:13px"><input type="radio" name="ticket-dest" value="both" checked> 💸 Transactions <b>+</b> 🛒 liste de courses</label>
      <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;font-size:13px"><input type="radio" name="ticket-dest" value="tx"> 💸 Transactions seules</label>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px"><input type="radio" name="ticket-dest" value="list"> 🛒 Liste de courses seule</label>
      <div class="ticket-form-grid" style="margin-top:12px">
        <div style="display:flex;flex-direction:column;gap:4px;min-width:0">
          <label class="qa-label" style="font-size:11px">Date (transactions)</label>
          <input class="inp" type="date" id="ticket-date" value="${_todayISO()}" style="width:100%;box-sizing:border-box">
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;min-width:0">
          <label class="qa-label" style="font-size:11px">Nom de la liste</label>
          <input class="inp" id="ticket-listkey" value="${_todayISO().slice(0, 7)}" placeholder="Ex: Ménage…" style="width:100%;box-sizing:border-box">
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;min-width:0">
          <label class="qa-label" style="font-size:11px">Moyen de paiement</label>
          <select class="select" id="ticket-pm" style="width:100%;box-sizing:border-box">
            <option value="carte">💳 Carte</option>
            <option value="especes">💵 Espèces</option>
            <option value="ticket_resto">🎟️ Ticket resto</option>
            <option value="virement">➡️ Virement</option>
            <option value="prelevement">🔄 Prélèvement</option>
            <option value="cheque">📝 Chèque</option>
          </select>
        </div>
      </div>
    </div>
    <div style="display:flex;gap:10px">
      <button class="btn-primary" onclick="saveTicket()" style="flex:1">✓ Enregistrer</button>
      <button class="btn-ghost" onclick="ticketClear()">Annuler</button>
    </div>`;
}

function ticketField(k, field, val) {
  if (!_ticketDraft[k]) return;
  _ticketDraft[k][field] = (field === 'price' || field === 'qty') ? (val === '' ? '' : Number(val)) : val;
}
function ticketCat(k, val) {
  if (!_ticketDraft[k]) return;
  _ticketDraft[k].category = val;
  _ticketDraft[k].sub_category = '';       // reset sous-cat + sous-sous-cat quand la catégorie change
  _ticketDraft[k].sub_sub_category = '';
  renderTicketReview();
}
function ticketSub(k, val) {
  if (!_ticketDraft[k]) return;
  _ticketDraft[k].sub_category = val;
  _ticketDraft[k].sub_sub_category = '';   // reset la sous-sous-cat quand la sous-cat change
  renderTicketReview();
}
// Choix dans le menu déroulant sous-catégorie (gère « ➕ Autre… » → saisie libre)
function ticketSubSelect(k, val) {
  if (!_ticketDraft[k]) return;
  if (val === '__custom__') {
    const v = prompt('Nouvelle sous-catégorie :', _ticketDraft[k].sub_category || '');
    if (v === null) { renderTicketReview(); return; }
    ticketSub(k, (v || '').trim());
    return;
  }
  ticketSub(k, val);
}
function ticketSubsubSelect(k, val) {
  if (!_ticketDraft[k]) return;
  if (val === '__custom__') {
    const v = prompt('Nouvelle sous-sous-catégorie :', _ticketDraft[k].sub_sub_category || '');
    if (v === null) { renderTicketReview(); return; }
    _ticketDraft[k].sub_sub_category = (v || '').trim();
    renderTicketReview();
    return;
  }
  _ticketDraft[k].sub_sub_category = val;
  renderTicketReview();
}
function ticketAddLine() {
  _ticketDraft.push({ label: '', brand: '', price: '', qty: 1, category: 'Vie quotidienne', sub_category: '', sub_sub_category: '' });
  renderTicketReview();
}
function ticketDeleteLine(k) {
  _ticketDraft.splice(k, 1);
  _ticketSel = new Set();   // les index changent → on repart d'une sélection vide
  if (_ticketDraft.length) renderTicketReview(); else ticketClear();
}
function ticketClear() {
  _ticketDraft = [];
  _ticketSel = new Set();
  $('ticket-review').style.display = 'none';
  $('ticket-review').innerHTML = '';
  $('ticket-status').style.display = 'none';
}
function _todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

async function saveTicket() {
  const valid = _ticketDraft.filter(it => (it.label || '').trim());
  if (!valid.length) { toast('Aucun produit à enregistrer', 'error'); return; }
  const dest = (document.querySelector('input[name="ticket-dest"]:checked') || {}).value || 'both';
  const listKey = ($('ticket-listkey').value || _todayISO().slice(0, 7) || '').trim();
  const dateOp = $('ticket-date').value || _todayISO();
  const ticketPm = ($('ticket-pm') && $('ticket-pm').value) || 'carte';

  // → Transactions : UNE seule ligne groupée (ex "Courses Leclerc"), pas un article par ligne.
  if (dest === 'both' || dest === 'tx') {
    const withPrice = valid.filter(it => Number(it.price) > 0);
    if (!withPrice.length && dest === 'tx') { toast('Aucun prix renseigné : impossible de créer des transactions', 'error'); return; }
    if (withPrice.length) {
      const name = (prompt(`Comment appeler cette transaction ? (${withPrice.length} article(s) regroupés)`, 'Courses ') || '').trim() || 'Courses';
      // Regroupe par catégorie pour garder le budget juste (souvent 1 seule ligne)
      const groups = {};
      withPrice.forEach(it => {
        const cat = it.category || 'Alimentation';
        if (!groups[cat]) groups[cat] = { cat, total: 0, subs: {} };
        groups[cat].total += Number(it.price) * (Number(it.qty) || 1);
        const s = (it.sub_category || '').trim(); if (s) groups[cat].subs[s] = (groups[cat].subs[s] || 0) + 1;
      });
      const gl = Object.values(groups);
      const multi = gl.length > 1;
      const txs = gl.map(g => {
        const domSub = Object.keys(g.subs).sort((a, b) => g.subs[b] - g.subs[a])[0] || (g.cat === 'Alimentation' ? 'Courses' : null);
        return {
          user_id: currentUser.id, date_op: dateOp,
          label: multi ? `${name} · ${g.cat}` : name,
          amount: -Math.abs(Math.round(g.total * 100) / 100),
          type: 'sortie', category: g.cat, sub_category: domSub, sub_sub_category: null,
          source: 'import_csv', account: 'Compte courant', payment_method: ticketPm
        };
      });
      const { error } = await sb.from('transactions').insert(txs.map(_sanitizeTx));
      if (error) { toast('Erreur transactions : ' + error.message, 'error'); console.error(error); return; }
    }
  }

  // → Liste de courses
  if (dest === 'both' || dest === 'list') {
    const rows = valid.map(it => ({
      user_id: currentUser.id,
      label: it.label.trim(),
      brand: (it.brand || '').trim() || null,
      category: it.category || null,
      sub_category: (it.sub_category || '').trim() || null,
      sub_sub_category: (it.sub_sub_category || '').trim() || null,
      price: (it.price === '' || it.price == null) ? null : Number(it.price),
      qty: Number(it.qty) || 1,
      checked: false,
      list_key: listKey || null,
      source: 'photo'
    }));
    const { error } = await dbGuard(sb.from('courses').insert(rows), 'Ajout à la liste impossible (as-tu lancé le SQL-V320 ?)');
    if (error) return;
  }

  ticketClear();
  await loadAllData();
  await loadExtra();          // recharge la liste de courses (coursesList)
  const msg = dest === 'tx' ? '✓ Transactions ajoutées' : dest === 'list' ? `✓ ${valid.length} produit(s) dans ta liste de courses` : '✓ Transactions + liste enregistrées';
  toast(msg, 'success');
  // On reste sur la page Courses et on rafraîchit la liste (le scanner est sur cette page).
  if (typeof renderCourses === 'function') renderCourses();
  if (dest === 'tx' && $('tab-transactions')) showTab('transactions');
}

// ═══ 🛒 PAGE COURSES (Phase 2) ═════════════════════════════════
let _coursesView = 'listes';
function setCoursesView(v) {
  _coursesView = v;
  const a = $('courses-tab-listes'), b = $('courses-tab-prix');
  if (a) a.classList.toggle('active', v === 'listes');
  if (b) b.classList.toggle('active', v === 'prix');
  renderCourses();
}
function renderCourses() {
  const body = $('courses-body');
  if (!body) return;
  if (!coursesList.length) {
    body.innerHTML = `<div class="empty" style="padding:32px 0;text-align:center">
      <div class="empty-title">Aucune liste pour l'instant</div>
      <div class="empty-sub" style="margin:8px 0 4px">Prends une photo d'une liste ou d'un ticket avec le bouton <b>📸 juste au-dessus</b> pour commencer.</div>
    </div>`;
    return;
  }
  body.innerHTML = _coursesView === 'prix' ? _renderCoursesPrix() : _renderCoursesListes();
}

function _coursePath(c) {
  return [c.category, c.sub_category, c.sub_sub_category].filter(Boolean).map(esc).join(' · ');
}
function _renderCoursesListes() {
  // Regroupe par list_key (ordre : liste la plus récente en premier)
  const groups = {};
  coursesList.forEach(c => { const k = c.list_key || '(sans nom)'; (groups[k] = groups[k] || []).push(c); });
  const order = Object.keys(groups).sort((a, b) => {
    const la = Math.max(...groups[a].map(x => +new Date(x.created_at)));
    const lb = Math.max(...groups[b].map(x => +new Date(x.created_at)));
    return lb - la;
  });
  return order.map(k => {
    const items = groups[k];
    const done = items.filter(i => i.checked).length;
    const total = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0);
    const doneAmt = items.filter(i => i.checked).reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0);
    const pct = items.length ? Math.round(done / items.length * 100) : 0;
    const rows = items.map(c => `
      <div style="padding:10px 0;border-bottom:1px solid var(--border-soft)${c.checked ? ';opacity:.55' : ''}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <input type="checkbox" class="bud-sub-check" ${c.checked ? 'checked' : ''} onchange="toggleCourseChecked('${c.id}')" title="Coché = dans le panier">
          <input class="inp" value="${esc(c.label)}" onchange="updateCourseField('${c.id}','label',this.value)" placeholder="Produit" style="flex:1;min-width:0;padding:6px 8px;font-size:13px${c.checked ? ';text-decoration:line-through' : ''}">
          <div style="display:flex;align-items:center;gap:2px"><input class="inp" type="number" step="0.01" min="0" value="${c.price == null ? '' : c.price}" onchange="updateCourseField('${c.id}','price',this.value)" placeholder="€" style="width:66px;padding:6px 5px;text-align:right;font-family:var(--fm)"><span style="font-size:11px;color:var(--muted)">€</span></div>
          <input class="inp" type="number" step="1" min="1" value="${c.qty || 1}" onchange="updateCourseField('${c.id}','qty',this.value)" title="Quantité" style="width:44px;padding:6px 4px;text-align:center">
          <button class="bud-sub-del" onclick="deleteCourseItem('${c.id}')" title="Retirer">🗑</button>
        </div>
        <div class="ticket-cat3" style="padding-left:26px">
          <input class="inp" value="${esc(c.brand || '')}" onchange="updateCourseField('${c.id}','brand',this.value)" placeholder="🏷️ Marque" style="padding:5px 8px;font-size:12px;min-width:0">
          <select class="select" title="Catégorie" onchange="courseCat('${c.id}',this.value)" style="font-size:12px;padding:5px;min-width:0">${_catOptions(c.category)}</select>
          <select class="select" title="Sous-catégorie" onchange="updateCourseField('${c.id}','sub_category',this.value === '__custom__' ? (prompt('Sous-catégorie :','')||'') : this.value)" style="font-size:12px;padding:5px;min-width:0">${subcatOptions(c.category, c.sub_category)}</select>
        </div>
      </div>`).join('');
    return `
      <div class="card" style="margin-bottom:16px">
        <div class="card-hd" style="align-items:flex-start">
          <div>
            <div class="card-title">🛒 ${esc(k)}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px">${done}/${items.length} coché(s) · ${fmt(Math.round(doneAmt))} / ${fmt(Math.round(total))}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
            <button class="btn-ghost" style="padding:5px 10px;font-size:12px" onclick="reuseCourseList('${esc(k)}')" title="Recopier cette liste (décochée) pour la réutiliser">♻️ Réutiliser</button>
            <button class="btn-ghost" style="padding:5px 10px;font-size:12px" onclick="deleteCourseList('${esc(k)}')" title="Supprimer toute la liste">🗑 Liste</button>
          </div>
        </div>
        <div style="height:6px;background:var(--border-soft);border-radius:99px;overflow:hidden;margin:4px 0 10px">
          <div style="height:100%;width:${pct}%;background:var(--sage);border-radius:99px"></div>
        </div>
        ${rows}
      </div>`;
  }).join('');
}

// Comparateur de prix : regroupe par produit (marque si dispo, sinon libellé normalisé)
function _renderCoursesPrix() {
  const norm = s => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const priced = coursesList.filter(c => c.price != null && Number(c.price) > 0);
  if (!priced.length) return `<div class="empty-sub" style="padding:20px 0">Aucun prix renseigné. Ajoute des produits avec un prix (et une marque) pour comparer.</div>`;
  const groups = {};
  priced.forEach(c => {
    const key = norm(c.brand) || norm(c.label);
    (groups[key] = groups[key] || { name: c.brand || c.label, rows: [] }).rows.push(c);
  });
  const cards = Object.values(groups).sort((a, b) => a.name.localeCompare(b.name)).map(g => {
    const prices = g.rows.map(r => Number(r.price));
    const min = Math.min(...prices), max = Math.max(...prices);
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
    const occ = g.rows.slice().sort((a, b) => Number(a.price) - Number(b.price)).map(r => {
      const isMin = Number(r.price) === min, isMax = Number(r.price) === max && max !== min;
      const d = (r.created_at || '').slice(0, 10);
      return `<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;color:${isMin ? 'var(--sage)' : (isMax ? '#E53935' : 'var(--muted)')}">
        <span>${esc(r.label)}${r.list_key ? ` <span style="color:var(--muted)">· ${esc(r.list_key)}</span>` : ''} ${d ? `<span style="color:var(--muted)">(${d})</span>` : ''}</span>
        <span style="font-family:var(--fm);font-weight:700;white-space:nowrap">${fmt2(r.price)}${isMin ? ' ✓' : ''}</span>
      </div>`;
    }).join('');
    return `
      <div class="card" style="margin-bottom:12px">
        <div class="card-hd"><div class="card-title">${esc(g.name)}</div>
          <div style="font-size:12px;color:var(--muted)">${g.rows.length} achat(s)</div></div>
        <div style="display:flex;gap:14px;font-size:13px;margin-bottom:8px">
          <div>🟢 Min <b style="font-family:var(--fm)">${fmt2(min)}</b></div>
          <div>⚪ Moy <b style="font-family:var(--fm)">${fmt2(avg)}</b></div>
          <div>🔴 Max <b style="font-family:var(--fm)">${fmt2(max)}</b></div>
          ${max !== min ? `<div style="margin-left:auto;color:var(--sage)">économie possible : <b>${fmt2(max - min)}</b></div>` : ''}
        </div>
        ${occ}
      </div>`;
  }).join('');
  return `<div style="font-size:12px;color:var(--muted);margin-bottom:12px">💡 Astuce : renomme bien tes libellés et remplis la <b>marque</b> pour comparer au plus juste. La ligne verte ✓ = la moins chère.</div>${cards}`;
}
function fmt2(n) { return (Math.round(Number(n) * 100) / 100).toFixed(2).replace('.', ',') + ' €'; }

function _catOptions(cur) {
  return Object.keys(CAT_META).sort().map(c => `<option value="${esc(c)}" ${c === cur ? 'selected' : ''}>${CAT_META[c].emoji} ${esc(c)}</option>`).join('');
}
// Modifie un champ d'un article de la liste de courses
async function updateCourseField(id, field, val) {
  const c = coursesList.find(x => x.id === id); if (!c) return;
  let v;
  if (field === 'price') v = (val === '' || val == null) ? null : Number(val);
  else if (field === 'qty') v = Math.max(1, Number(val) || 1);
  else v = (val || '').trim() || null;
  c[field] = v;
  const { error } = await sb.from('courses').update({ [field]: v }).eq('id', id);
  if (error) { toast('Erreur : ' + error.message, 'error'); return; }
  renderCourses();
}
async function courseCat(id, val) {
  const c = coursesList.find(x => x.id === id); if (!c) return;
  c.category = val; c.sub_category = null;   // changer de catégorie remet la sous-cat à zéro
  const { error } = await sb.from('courses').update({ category: val, sub_category: null }).eq('id', id);
  if (error) { toast('Erreur : ' + error.message, 'error'); return; }
  renderCourses();
}
async function toggleCourseChecked(id) {
  const c = coursesList.find(x => x.id === id); if (!c) return;
  const nv = !c.checked;
  const { error } = await sb.from('courses').update({ checked: nv }).eq('id', id);
  if (error) { toast('Erreur : ' + error.message, 'error'); return; }
  c.checked = nv; renderCourses();
}
function deleteCourseItem(id) {
  const c = coursesList.find(x => x.id === id); if (!c) return;
  confirmDelete(`Retirer « ${esc(c.label)} » de la liste ?`, async () => {
    const { error } = await sb.from('courses').delete().eq('id', id);
    if (error) { toast('Erreur : ' + error.message, 'error'); return; }
    coursesList = coursesList.filter(x => x.id !== id);
    renderCourses();
  });
}
function deleteCourseList(listKey) {
  const items = coursesList.filter(c => (c.list_key || '(sans nom)') === listKey);
  if (!items.length) return;
  confirmDelete(`Supprimer toute la liste « ${esc(listKey)} » (${items.length} produit(s)) ?`, async () => {
    const q = listKey === '(sans nom)'
      ? sb.from('courses').delete().eq('user_id', currentUser.id).is('list_key', null)
      : sb.from('courses').delete().eq('user_id', currentUser.id).eq('list_key', listKey);
    const { error } = await q;
    if (error) { toast('Erreur : ' + error.message, 'error'); return; }
    coursesList = coursesList.filter(c => (c.list_key || '(sans nom)') !== listKey);
    toast('✓ Liste supprimée', 'success');
    renderCourses();
  });
}
async function reuseCourseList(listKey) {
  const items = coursesList.filter(c => (c.list_key || '(sans nom)') === listKey);
  if (!items.length) return;
  const nk = prompt('Nom de la nouvelle liste (recopie décochée pour la réutiliser) :', _todayISO().slice(0, 7) || '');
  if (nk === null) return;
  const rows = items.map(c => ({
    user_id: currentUser.id, label: c.label, brand: c.brand, category: c.category,
    sub_category: c.sub_category, sub_sub_category: c.sub_sub_category, price: c.price,
    qty: c.qty, checked: false, list_key: (nk || '').trim() || null, source: 'reuse'
  }));
  const { ok, data } = await dbGuard(sb.from('courses').insert(rows).select(), 'Réutilisation impossible');
  if (!ok) return;
  if (data) coursesList = [...data, ...coursesList];
  toast(`✓ Liste réutilisée (${rows.length} produit(s), tout décoché)`, 'success');
  renderCourses();
}

// ═══ 🏷️ FOCUS MARQUE (Analyse, Phase 3) ═══════════════════════
function _populateBrandDatalist() {
  const dl = $('analyse-brand-list'); if (!dl) return;
  const brands = new Set();
  coursesList.forEach(c => { if (c.brand) brands.add(c.brand.trim()); });
  const list = [...brands].sort((a, b) => a.localeCompare(b));
  dl.innerHTML = list.map(b => `<option value="${esc(b)}">`).join('');
}
function renderBrandFocus() {
  const out = $('analyse-brand-out'); if (!out) return;
  const q = (($('analyse-brand') && $('analyse-brand').value) || '').trim().toLowerCase();
  if (q.length < 2) { out.innerHTML = `<div class="empty-sub" style="padding:6px 0">Tape au moins 2 lettres pour lancer la recherche.</div>`; return; }
  const tx = transactions.filter(t => t.type === 'sortie' && (t.label || '').toLowerCase().includes(q));
  const cs = coursesList.filter(c => (`${c.brand || ''} ${c.label || ''}`).toLowerCase().includes(q) && c.price != null && Number(c.price) > 0);
  if (!tx.length && !cs.length) { out.innerHTML = `<div class="empty-sub" style="padding:6px 0">Aucune dépense ni produit ne contient « ${esc(q)} ».</div>`; return; }

  const total = tx.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const n = tx.length;
  const avg = n ? total / n : 0;
  const kpis = `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
    <div style="flex:1;min-width:100px;background:var(--bg);border-radius:10px;padding:10px;text-align:center">
      <div style="font-size:11px;color:var(--muted)">Total dépensé</div><div style="font-family:var(--fm);font-weight:800;font-size:18px">${fmt(Math.round(total))}</div></div>
    <div style="flex:1;min-width:100px;background:var(--bg);border-radius:10px;padding:10px;text-align:center">
      <div style="font-size:11px;color:var(--muted)">Achats</div><div style="font-family:var(--fm);font-weight:800;font-size:18px">${n}</div></div>
    <div style="flex:1;min-width:100px;background:var(--bg);border-radius:10px;padding:10px;text-align:center">
      <div style="font-size:11px;color:var(--muted)">Panier moyen</div><div style="font-family:var(--fm);font-weight:800;font-size:18px">${fmt(Math.round(avg))}</div></div>
  </div>`;

  // Comparaison de prix unitaire (depuis tes listes de courses)
  let priceBlock = '';
  if (cs.length) {
    const prices = cs.map(c => Number(c.price));
    const min = Math.min(...prices), max = Math.max(...prices);
    const rows = cs.slice().sort((a, b) => Number(a.price) - Number(b.price)).slice(0, 8).map(c => {
      const isMin = Number(c.price) === min, isMax = Number(c.price) === max && max !== min;
      return `<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;color:${isMin ? 'var(--sage)' : (isMax ? '#E53935' : 'var(--muted)')}">
        <span>${esc(c.label)}${c.list_key ? ` <span style="color:var(--muted)">· ${esc(c.list_key)}</span>` : ''}</span>
        <span style="font-family:var(--fm);font-weight:700">${fmt2(c.price)}${isMin ? ' ✓ moins cher' : (isMax ? ' plus cher' : '')}</span></div>`;
    }).join('');
    priceBlock = `<div style="background:var(--bg);border-radius:10px;padding:12px;margin-bottom:12px">
      <div style="font-weight:700;font-size:13px;margin-bottom:6px">🏷️ Prix unitaire (depuis tes courses) ${max !== min ? `— écart <b style="color:var(--sage)">${fmt2(max - min)}</b>` : ''}</div>${rows}</div>`;
  }

  // Dernières transactions correspondantes
  const last = tx.slice(0, 12).map(t => `
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border-soft)">
      <span style="color:var(--muted)">${t.date_op} · ${esc(t.label)}</span>
      <span style="font-family:var(--fm);font-weight:700;white-space:nowrap">${fmt(Math.round(Math.abs(Number(t.amount))))}</span></div>`).join('');
  out.innerHTML = kpis + priceBlock + (last ? `<div style="font-weight:700;font-size:13px;margin-bottom:4px">Dernières opérations</div>${last}` : '');
}

// ═══ SUIVI MENSUEL ═════════════════════════════════════════════
function populateYearSelect() {
  const now = new Date().getFullYear();
  const sel = $('suivi-year');
  sel.innerHTML = '';
  for (let y = now + 1; y >= 2020; y--) {
    const o = document.createElement('option');
    o.value = y; o.textContent = y;
    if (y === now) o.selected = true;
    sel.appendChild(o);
  }
}
async function loadSuivi() {
  const { data } = await sb.from('tracker_mensuel').select('*').eq('user_id', currentUser.id);
  suiviData = {};
  (data || []).forEach(r => { suiviData[r.month.slice(0, 7)] = r; });
}
async function renderSuivi() {
  if (!Object.keys(suiviData).length) await loadSuivi();
  const year = parseInt($('suivi-year').value);
  const body = $('suivi-body');
  body.innerHTML = '';
  const now = new Date();
  let prevPatTot = null; // pour évolution vs N-1 (sur le solde de fin de mois)
  const chartLabels = [], chartData = [];
  for (let m = 0; m < 12; m++) {
    if (new Date(year, m, 1) > new Date(now.getFullYear(), now.getMonth() + 1, 1)) break;
    const key = `${year}-${String(m + 1).padStart(2, '0')}`;
    const r = suiviData[key] || {};
    // Épargne = Livret A + LDDS + Assurance vie + Esalia + Investissements
    const epargneTot = (r.livret_a || 0) + (r.ldds || 0) + (r.assurance_vie || 0) + (r.esalia || 0) + (r.investissements || 0);
    // Solde total en fin de mois = comptes courants + épargne = « ce qui te reste »
    const patTot = (r.lcl || 0) + (r.bourso || 0) + (r.especes || 0) + (r.banque_postale || 0) + (r.autre || 0) + epargneTot;

    // Mois précédent (pour le bouton « copier »)
    const pd = new Date(year, m - 1, 1);
    const prevKey = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, '0')}`;
    const prev = suiviData[prevKey];
    const prevTot = prev ? (prev.lcl || 0) + (prev.bourso || 0) + (prev.especes || 0) + (prev.banque_postale || 0) + (prev.autre || 0) + (prev.livret_a || 0) + (prev.ldds || 0) + (prev.assurance_vie || 0) + (prev.esalia || 0) + (prev.investissements || 0) : 0;
    const showCopy = prevTot > 0 && patTot === 0;

    // Évolution vs mois N-1 (sur le solde de fin de mois)
    let evoValStr = '—', evoPctStr = '—', evoColor = 'var(--muted)';
    if (prevPatTot !== null && prevPatTot > 0 && patTot > 0) {
      const diff = patTot - prevPatTot;
      const pct = (diff / prevPatTot) * 100;
      evoColor = diff >= 0 ? 'var(--sage)' : 'var(--tender-rose)';
      const sign = diff >= 0 ? '+' : '';
      evoValStr = `${sign}${fmt(diff)}`;
      evoPctStr = `${sign}${pct.toFixed(1)}%`;
    }

    const moisCell = `<div style="display:flex;align-items:center;gap:6px;justify-content:space-between">
        <span>${MONTHS_SHORT[m]} ${year}</span>
        ${showCopy ? `<button type="button" class="suivi-copy-btn" title="Recopier les soldes de ${prevKey}" onclick="copySuiviPrevMonth('${key}')">⧉ M-1</button>` : ''}
      </div>`;
    const inp = (col) => `<td><input class="suivi-inp" type="number" step="0.01" value="${r[col] > 0 ? r[col] : ''}" placeholder="0" oninput="saveSuivi('${key}','${col}',this.value)"></td>`;
    body.innerHTML += `<tr data-month="${key}">
      <td>${moisCell}</td>
      ${inp('lcl')}${inp('bourso')}${inp('especes')}${inp('banque_postale')}${inp('autre')}
      ${inp('livret_a')}${inp('ldds')}${inp('assurance_vie')}${inp('esalia')}${inp('investissements')}
      <td style="font-weight:700;color:var(--plum);background:var(--lavender-soft)" title="Livret A + LDDS + Assurance vie + Esalia + Investissements">${epargneTot > 0 ? fmt(epargneTot) : '—'}</td>
      <td style="font-weight:800;color:var(--ink);background:linear-gradient(135deg,#FFEDE5,#E7F3EC)" title="Comptes courants + épargne">${patTot > 0 ? fmt(patTot) : '—'}</td>
      <td style="font-weight:700;color:${evoColor}">${evoValStr}</td>
      <td style="font-weight:700;color:${evoColor}">${evoPctStr}</td>
    </tr>`;
    chartLabels.push(MONTHS_SHORT[m]);
    chartData.push(patTot);
    if (patTot > 0) prevPatTot = patTot;
  }

  // Courbe d'évolution du patrimoine (les mois vides = coupure, pas un 0)
  const hasAny = chartData.some(v => v > 0);
  const chartCard = $('suivi-chart-card');
  if (chartCard) chartCard.style.display = hasAny ? '' : 'none';
  const emptyHint = $('suivi-chart-empty');
  if (emptyHint) emptyHint.style.display = hasAny ? 'none' : '';
  if (hasAny) {
    updateChart('suivi-chart', 'line', {
      labels: chartLabels,
      datasets: [{
        label: 'Patrimoine', data: chartData.map(v => v > 0 ? v : null),
        borderColor: '#E76F51', backgroundColor: 'rgba(231,111,81,0.12)',
        borderWidth: 2.5, tension: 0.35, fill: true, pointRadius: 3, pointHoverRadius: 5, spanGaps: true
      }]
    }, {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#A0AEC0' }, grid: { display: false } },
        y: { ticks: { color: '#A0AEC0', callback: v => v.toLocaleString('fr-FR') + ' €' }, grid: { color: '#F5E7EA' } }
      }
    });
  }
}
// Recopie les soldes du mois précédent dans le mois courant (gain de temps de saisie)
function copySuiviPrevMonth(key) {
  const [y, m] = key.split('-').map(Number);
  const pd = new Date(y, m - 2, 1); // m est 1-based → m-2 = index du mois précédent
  const prevKey = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, '0')}`;
  const prev = suiviData[prevKey];
  if (!prev) { toast('Aucune donnée le mois précédent', 'error'); return; }
  const cols = ['lcl', 'bourso', 'especes', 'esalia', 'banque_postale', 'investissements', 'autre', 'livret_a', 'ldds', 'assurance_vie'];
  if (!suiviData[key]) suiviData[key] = { month: key + '-01' };
  cols.forEach(c => { if (prev[c] != null) suiviData[key][c] = prev[c]; });
  saveSuivi(key, 'lcl', suiviData[key].lcl || 0); // déclenche l'enregistrement du payload complet
  renderSuivi();
  toast(`Soldes de ${prevKey} recopiés — ajuste si besoin`, 'success');
}
// Recalcule en direct les colonnes calculées (Total ép. / Total / Évolution) sans toucher aux inputs (pas de perte de focus)
function refreshSuiviTotals() {
  let prevPatTot = null;
  document.querySelectorAll('#suivi-body tr[data-month]').forEach(row => {
    const r = suiviData[row.dataset.month] || {};
    const epargneTot = (r.livret_a || 0) + (r.ldds || 0) + (r.assurance_vie || 0) + (r.esalia || 0) + (r.investissements || 0);
    const patTot = (r.lcl || 0) + (r.bourso || 0) + (r.especes || 0) + (r.banque_postale || 0) + (r.autre || 0) + epargneTot;
    const c = row.querySelectorAll('td');
    if (c[11]) c[11].textContent = epargneTot > 0 ? fmt(epargneTot) : '—';
    if (c[12]) c[12].textContent = patTot > 0 ? fmt(patTot) : '—';
    let evoVal = '—', evoPct = '—', evoColor = 'var(--muted)';
    if (prevPatTot !== null && prevPatTot > 0 && patTot > 0) {
      const diff = patTot - prevPatTot, pct = diff / prevPatTot * 100, sign = diff >= 0 ? '+' : '';
      evoColor = diff >= 0 ? 'var(--sage)' : 'var(--tender-rose)';
      evoVal = `${sign}${fmt(diff)}`; evoPct = `${sign}${pct.toFixed(1)}%`;
    }
    if (c[13]) { c[13].textContent = evoVal; c[13].style.color = evoColor; }
    if (c[14]) { c[14].textContent = evoPct; c[14].style.color = evoColor; }
    if (patTot > 0) prevPatTot = patTot;
  });
}
let suiviSaveTimers = {};
async function saveSuivi(key, col, val) {
  if (!suiviData[key]) suiviData[key] = { month: key + '-01' };
  suiviData[key][col] = parseFloat(val) || 0;
  refreshSuiviTotals();
  clearTimeout(suiviSaveTimers[key]);
  suiviSaveTimers[key] = setTimeout(async () => {
    const payload = { user_id: currentUser.id, month: key + '-01' };
    ['lcl','bourso','especes','esalia','banque_postale','investissements','autre','livret_a','ldds','assurance_vie','salaire','tickets_resto','remboursements','autres_revenus','epargne_cible','epargne_reel'].forEach(c => {
      if (suiviData[key][c] !== undefined) payload[c] = suiviData[key][c];
    });
    const r = await dbGuard(
      sb.from('tracker_mensuel').upsert(payload, { onConflict: 'user_id,month' }),
      'Sauvegarde du suivi échouée. Ta saisie n\'est pas enregistrée.'
    );
    if (r.ok) toast('Enregistré', 'success');
  }, 1200);
}
async function resyncSuivi() {
  await loadSuivi();
  renderSuivi();
  toast('Sync !', 'success');
}

// ═══ ÉPARGNE ═══════════════════════════════════════════════════
function renderEpargne() {
  renderRemboursements();
  renderDettes();
  if ($('ep-month-select')) $('ep-month-select').value = epargneMonth;
  if ($('ep-year-select')) $('ep-year-select').value = epargneYear;
  const monthKey = `${epargneYear}-${String(epargneMonth + 1).padStart(2, '0')}`;
  // Périmètre = MOIS sélectionné (piloté par les sélecteurs en haut de la page), pas l'année entière.
  const monthTx = transactions.filter(t => t.date_op.startsWith(monthKey));
  const monthIn = monthTx.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.amount), 0);
  // Épargne « réelle » du mois = somme de tes opérations de type Épargne (source de vérité : le calendrier).
  const monthEpargneFlow = monthTx.filter(t => t.type === 'epargne').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  const active = goalsList.filter(g => g.statut === 'en_cours');
  const achieved = goalsList.filter(g => g.statut === 'atteint');
  const abandoned = goalsList.filter(g => g.statut === 'abandonne');

  const totalCible = active.reduce((s, g) => s + Number(g.cible || 0), 0);
  const totalEpargne = active.reduce((s, g) => s + Number(g.deja_epargne || 0), 0);
  const reste = Math.max(0, totalCible - totalEpargne);

  // KPI 1 : Épargné sur le mois sélectionné (flux type Épargne)
  set('ep-year', fmt(monthEpargneFlow));
  set('ep-year-hint', `${MONTHS[epargneMonth]} ${epargneYear} · opérations type Épargne`);
  // KPI 2 : Cible active = somme des cibles de tous les objectifs en cours
  set('ep-cible', fmt(totalCible));
  set('ep-cible-hint', `${active.length} objectif(s) en cours`);
  // KPI 3 : Reste à épargner = cumul (toutes cibles − déjà épargné) des objectifs en cours
  set('ep-ecart', fmt(reste));
  set('ep-ecart-hint', totalCible > 0 ? `${Math.round(totalEpargne / totalCible * 100)}% des cibles atteint` : 'cumul de tes objectifs');
  // KPI 4 : Taux d'épargne = part des revenus du MOIS mise de côté
  const rate = monthIn > 0 ? Math.round(monthEpargneFlow / monthIn * 100) : 0;
  set('ep-rate', rate + '%');
  if ($('ep-rate-hint')) set('ep-rate-hint', monthIn > 0 ? `${fmt(monthEpargneFlow)} / ${fmt(monthIn)} de revenus` : 'aucun revenu ce mois');

  // Objectifs actifs
  const activeList = $('goals-active-list');
  set('goals-active-count', active.length);
  if (!active.length) {
    activeList.innerHTML = `
      <div class="empty">
        <div class="empty-emoji">🎯</div>
        <div class="empty-title">Aucun objectif en cours</div>
        <div class="empty-sub">Clique <b>+ Nouvel objectif</b> pour commencer à épargner intentionnellement</div>
      </div>`;
  } else {
    activeList.innerHTML = active.map(renderGoalCard).join('');
  }

  // Objectifs atteints
  const achievedCard = $('goals-achieved-card');
  if (achieved.length > 0) {
    achievedCard.style.display = '';
    set('goals-achieved-count', achieved.length);
    $('goals-achieved-list').innerHTML = achieved.map(g => renderGoalCard(g, true)).join('');
  } else {
    achievedCard.style.display = 'none';
  }

  // Objectifs abandonnés
  const abandonedCard = $('goals-abandoned-card');
  if (abandoned.length > 0) {
    abandonedCard.style.display = '';
    set('goals-abandoned-count', abandoned.length);
    $('goals-abandoned-list').innerHTML = abandoned.map(g => renderGoalCard(g, false, true)).join('');
  } else {
    abandonedCard.style.display = 'none';
  }
}

function renderGoalCard(g, isAchieved = false, isAbandoned = false) {
  const pct = g.cible > 0 ? Math.min(100, Math.round(g.deja_epargne / g.cible * 100)) : 0;
  const reste = Math.max(0, Number(g.cible) - Number(g.deja_epargne));

  // Contributions ce mois-ci sur ce goal
  const monthKey = `${epargneYear}-${String(epargneMonth + 1).padStart(2, '0')}`;
  const monthContribs = contribList.filter(c => c.objectif_id === g.id && c.date_contrib && c.date_contrib.startsWith(monthKey));
  const monthTotal = monthContribs.reduce((s, c) => s + Number(c.montant), 0);
  // Calcul de la cible mensuelle : (cible - déjà épargné avant ce mois) / mois restants
  let cibleMensuelle = 0;
  if (g.date_cible && !isAchieved && !isAbandoned) {
    const now = new Date();
    const deadline = new Date(g.date_cible);
    const monthsLeft = Math.max(1, (deadline.getFullYear() - now.getFullYear()) * 12 + (deadline.getMonth() - now.getMonth()) + 1);
    cibleMensuelle = Math.round(reste / monthsLeft);
  }
  const monthAchieved = monthTotal >= cibleMensuelle && cibleMensuelle > 0;

  let barClass = 'low';
  if (pct >= 100) barClass = 'done';
  else if (pct >= 66) barClass = 'high';
  else if (pct >= 33) barClass = 'medium';

  let pctClass = pct >= 100 ? 'done' : '';

  // Calcul rythme mensuel requis
  let rythmeInfo = 'Pas de deadline';
  let rythmeClass = '';
  if (g.date_cible && !isAchieved && !isAbandoned) {
    const now = new Date();
    const deadline = new Date(g.date_cible);
    const monthsLeft = Math.max(0, (deadline.getFullYear() - now.getFullYear()) * 12 + (deadline.getMonth() - now.getMonth()));
    if (monthsLeft > 0) {
      const rythme = Math.ceil(reste / monthsLeft);
      rythmeInfo = `${fmt(rythme)} / mois`;
      if (rythme > 500) rythmeClass = 'warn';
      if (rythme > 1000) rythmeClass = 'danger';
    } else if (deadline < now && reste > 0) {
      rythmeInfo = '⚠️ Dépassé';
      rythmeClass = 'danger';
    } else {
      rythmeInfo = 'Ce mois-ci';
      rythmeClass = 'warn';
    }
  }

  // Date cible formatée
  let dateCibleStr = 'Pas de date';
  if (g.date_cible) {
    const d = new Date(g.date_cible);
    dateCibleStr = d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
  }

  // Boutons selon l'état — simple et clair
  const actions = isAchieved
    ? `<button class="goal-btn" onclick="reactivateGoal('${g.id}')" title="Réactiver">🔄 Réactiver</button>
       <button class="goal-btn danger" onclick="deleteGoal('${g.id}')" title="Supprimer">🗑️</button>`
    : isAbandoned
      ? `<button class="goal-btn" onclick="reactivateGoal('${g.id}')" title="Réactiver">🔄 Réactiver</button>
         <button class="goal-btn" onclick="editGoal('${g.id}')" title="Modifier">✏️</button>
         <button class="goal-btn danger" onclick="deleteGoal('${g.id}')" title="Supprimer">🗑️</button>`
      : `<button class="goal-btn primary" onclick="openContribForm('${g.id}')" title="Ajouter de l'argent">+ Ajouter</button>
         ${Number(g.deja_epargne) > 0 ? `<button class="goal-btn" onclick="withdrawFromGoal('${g.id}')" title="Utiliser / retirer de l'argent épargné">− Utiliser</button>` : ''}
         <button class="goal-btn" onclick="editGoal('${g.id}')" title="Modifier">✏️</button>
         <button class="goal-btn" onclick="postponeGoal('${g.id}')" title="Reporter la date cible">📅 Reporter</button>
         ${pct >= 100 ? `<button class="goal-btn" onclick="markAchieved('${g.id}')" title="Marquer terminé" style="color:var(--gold);border-color:var(--gold)">🏆 Terminer</button>` : ''}
         <button class="goal-btn" onclick="abandonGoal('${g.id}')" title="Annuler cet objectif">✖️ Annuler</button>`;

  // Badge d'état (en haut à droite) — pas de texte dans la description
  const statusBadge = isAchieved
    ? `<span style="background:var(--sage-soft);color:var(--sage);font-weight:700;font-size:11px;padding:3px 10px;border-radius:100px;white-space:nowrap">✓ Terminé</span>`
    : isAbandoned
      ? `<span style="background:var(--border-soft);color:var(--muted);font-weight:700;font-size:11px;padding:3px 10px;border-radius:100px;white-space:nowrap">Annulé</span>`
      : '';

  return `
    <div class="goal-card ${isAchieved ? 'achieved' : ''} ${isAbandoned ? 'abandoned' : ''}" style="border-left-color:${g.couleur || 'var(--sage)'}">
      <div class="goal-hd">
        <div class="goal-title-block">
          <div class="goal-emoji" style="background:${g.couleur ? g.couleur + '20' : 'var(--sage-soft)'}">${g.emoji || '🎯'}</div>
          <div style="min-width:0;flex:1">
            <div class="goal-name">${esc(g.nom)}</div>
            ${g.note ? `<div class="goal-sub">${esc(g.note)}</div>` : ''}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
          ${statusBadge}
          <div class="goal-actions">${actions}</div>
        </div>
      </div>
      <div class="goal-progress">
        <div class="goal-progress-bar">
          <div class="goal-progress-fill ${barClass}" style="width:${pct}%"></div>
        </div>
        <div class="goal-progress-info">
          <div class="goal-progress-txt">${fmt(g.deja_epargne)} <span style="color:var(--muted);font-weight:600"> / ${fmt(g.cible)}</span></div>
          <div class="goal-progress-pct ${pctClass}">${pct}%</div>
        </div>
      </div>
      <div class="goal-meta">
        <div class="goal-meta-cell">
          <div class="goal-meta-lbl">Reste à épargner</div>
          <div class="goal-meta-val ${reste === 0 ? 'ok' : ''}">${fmt(reste)}</div>
        </div>
        <div class="goal-meta-cell">
          <div class="goal-meta-lbl">Date cible</div>
          <div class="goal-meta-val">${dateCibleStr}</div>
        </div>
        <div class="goal-meta-cell">
          <div class="goal-meta-lbl">Rythme requis</div>
          <div class="goal-meta-val ${rythmeClass}">${rythmeInfo}</div>
        </div>
      </div>
      ${pct >= 100 && !isAchieved ? '<div class="goal-tip">🎉 Bravo ! Tu peux marquer cet objectif comme atteint</div>' : ''}
      ${!isAchieved && !isAbandoned && (monthTotal > 0 || cibleMensuelle > 0) ? `
        <div class="goal-tip" style="background:${monthAchieved ? 'var(--sage-soft)' : 'var(--peach-soft)'};color:${monthAchieved ? 'var(--sage)' : 'var(--peach)'}">
          ${monthAchieved ? '✅' : '⏳'} <b>${MONTHS[epargneMonth]} ${epargneYear}</b> · Contribué : <b>${fmt(monthTotal)}</b>${cibleMensuelle > 0 ? ` · Cible mensuelle : <b>${fmt(cibleMensuelle)}</b>` : ''}
        </div>` : ''}
      ${pct > 0 && pct < 100 && !isAchieved && !isAbandoned ? `<div class="goal-tip" style="background:var(--sage-soft);color:var(--sage)">🌱 Il te reste ${fmt(reste)} au total pour atteindre ton objectif</div>` : ''}
    </div>`;
}

function renderDashGoalWidget() {
  const widget = $('dash-goal-widget');
  if (!widget) return;

  const active = goalsList.filter(g => g.statut === 'en_cours');
  const achieved = goalsList.filter(g => g.statut === 'atteint');

  if (active.length === 0 && achieved.length === 0) {
    widget.style.display = 'none';
    return;
  }

  widget.style.display = '';

  if (active.length === 0) {
    // Uniquement des atteints, on montre le dernier atteint
    const last = achieved[0];
    set('dash-goal-lbl', 'Dernier objectif atteint');
    $('dash-goal-emoji').textContent = last.emoji || '🏆';
    set('dash-goal-name', last.nom);
    set('dash-goal-pct', '100%');
    $('dash-goal-fill').style.width = '100%';
    $('dash-goal-fill').style.background = 'linear-gradient(90deg, var(--gold), var(--sage))';
    set('dash-goal-info', `🏆 Bravo ! Atteint le ${new Date(last.updated_at).toLocaleDateString('fr-FR')} · Crée un nouvel objectif pour continuer 🌱`);
    return;
  }

  // Trouve l'objectif le plus urgent (deadline la plus proche, sinon le plus proche de 100%)
  let priority = active.slice().sort((a, b) => {
    // 1. Ceux avec deadline en premier
    if (a.date_cible && !b.date_cible) return -1;
    if (!a.date_cible && b.date_cible) return 1;
    // 2. Deadline la plus proche
    if (a.date_cible && b.date_cible) return new Date(a.date_cible) - new Date(b.date_cible);
    // 3. Sinon le plus proche de 100%
    const pctA = a.cible > 0 ? a.deja_epargne / a.cible : 0;
    const pctB = b.cible > 0 ? b.deja_epargne / b.cible : 0;
    return pctB - pctA;
  })[0];

  const pct = priority.cible > 0 ? Math.min(100, Math.round(priority.deja_epargne / priority.cible * 100)) : 0;
  const reste = Math.max(0, Number(priority.cible) - Number(priority.deja_epargne));

  set('dash-goal-lbl', `Prochain objectif · ${active.length} en cours`);
  $('dash-goal-emoji').textContent = priority.emoji || '🎯';
  set('dash-goal-name', priority.nom);
  set('dash-goal-pct', pct + '%');
  $('dash-goal-fill').style.width = pct + '%';
  $('dash-goal-fill').style.background = pct >= 100 ? 'linear-gradient(90deg, var(--gold), var(--sage))' :
    pct >= 66 ? 'linear-gradient(90deg, var(--sage), var(--peach))' :
    pct >= 33 ? 'linear-gradient(90deg, var(--peach), var(--gold))' :
    'linear-gradient(90deg, var(--tender-rose), var(--peach))';

  let info = `${fmt(priority.deja_epargne)} / ${fmt(priority.cible)}`;
  if (reste > 0 && priority.date_cible) {
    const now = new Date();
    const deadline = new Date(priority.date_cible);
    const monthsLeft = Math.max(1, (deadline.getFullYear() - now.getFullYear()) * 12 + (deadline.getMonth() - now.getMonth()) + 1);
    const rythme = Math.round(reste / monthsLeft);
    info += ` · Rythme : ${fmt(rythme)}/mois pour tenir la deadline`;
  } else if (reste > 0) {
    info += ` · Reste ${fmt(reste)}`;
  } else {
    info += ' · 🎉 Atteint ! Marque-le comme accompli';
  }
  // Rappel de la précédente réussite
  if (achieved.length > 0) {
    info += ` · Dernière réussite : ${achieved[0].emoji} ${achieved[0].nom}`;
  }
  set('dash-goal-info', info);
}

function toggleAchievedList() {
  showAchieved = !showAchieved;
  $('goals-achieved-list').style.display = showAchieved ? '' : 'none';
  $('toggle-achieved-btn').textContent = showAchieved ? 'Masquer' : 'Voir';
}
function toggleAbandonedList() {
  showAbandoned = !showAbandoned;
  $('goals-abandoned-list').style.display = showAbandoned ? '' : 'none';
  $('toggle-abandoned-btn').textContent = showAbandoned ? 'Masquer' : 'Voir';
}

function openGoalForm(existing) {
  const isEdit = !!existing;
  const emojisChoice = ['🎯','🌸','🏖️','💻','🚗','🏠','💍','🎓','👶','✈️','🎁','🚨','💐','📚','🌱','⛰️'];
  const colorsChoice = [
    { name: 'Sauge', code: '#7FB89E' },
    { name: 'Rose', code: '#E76F51' },
    { name: 'Pêche', code: '#F4A993' },
    { name: 'Lavande', code: '#D8B4DD' },
    { name: 'Or', code: '#E8B84D' },
    { name: 'Rose tendre', code: '#DD7B85' }
  ];

  openModal(
    isEdit ? '✏️ Modifier l\'objectif' : '🎯 Nouvel objectif d\'épargne',
    'Définis ce vers quoi tu veux tendre',
    async () => {
      const nom = $('goal-form-nom').value.trim();
      const cible = parseFloat($('goal-form-cible').value) || 0;
      const dejaEp = parseFloat($('goal-form-deja').value) || 0;
      const dateCible = $('goal-form-date').value || null;
      const emoji = $('goal-form-emoji').value || '🎯';
      const couleur = $('goal-form-color').value || '#7FB89E';
      const note = $('goal-form-note').value.trim();
      if (!nom) { toast('Nom requis', 'error'); return false; }
      if (cible <= 0) { toast('Montant cible doit être > 0', 'error'); return false; }
      const payload = {
        user_id: currentUser.id,
        nom, cible, deja_epargne: dejaEp,
        date_cible: dateCible,
        emoji, couleur, note
      };
      let result, error;
      if (isEdit) {
        ({ data: result, error } = await sb.from('epargne_objectifs').update(payload).eq('id', existing.id).select());
      } else {
        payload.date_debut = new Date().toISOString().slice(0, 10);
        ({ data: result, error } = await sb.from('epargne_objectifs').insert(payload).select());
      }
      if (error) {
        console.error('epargne_objectifs', error);
        toast('Erreur : ' + error.message, 'error');
        return false;
      }
      await loadGoals();
      renderEpargne();
      toast(isEdit ? 'Objectif mis à jour !' : 'Objectif créé !', 'success');
    },
    `<div style="display:flex;flex-direction:column;gap:14px">
      <div class="auth-field"><label>Nom de l'objectif</label>
        <input class="inp" id="goal-form-nom" value="${esc(existing?.nom)}" placeholder="Ex: Vacances Bali, Fonds urgence, Nouvel ordi"></div>
      <div class="auth-field"><label>Emoji</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
          ${emojisChoice.map(e => `<button type="button" onclick="document.getElementById('goal-form-emoji').value='${e}';document.querySelectorAll('.emoji-choice').forEach(b=>b.style.background='var(--bg)');this.style.background='var(--rose-soft)'" class="emoji-choice" style="width:38px;height:38px;font-size:20px;border:1.5px solid var(--border);border-radius:10px;background:${existing?.emoji === e ? 'var(--rose-soft)' : 'var(--bg)'};cursor:pointer">${e}</button>`).join('')}
        </div>
        <input type="hidden" id="goal-form-emoji" value="${existing?.emoji || '🎯'}"></div>
      <div class="auth-field"><label>Couleur</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
          ${colorsChoice.map(c => `<button type="button" onclick="document.getElementById('goal-form-color').value='${c.code}';document.querySelectorAll('.color-choice').forEach(b=>b.style.borderColor='var(--border)');this.style.borderColor='var(--ink)'" class="color-choice" title="${c.name}" style="width:38px;height:38px;border-radius:10px;background:${c.code};border:2px solid ${existing?.couleur === c.code ? 'var(--ink)' : 'var(--border)'};cursor:pointer"></button>`).join('')}
        </div>
        <input type="hidden" id="goal-form-color" value="${existing?.couleur || '#7FB89E'}"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="auth-field"><label>Montant cible (€)</label>
          <input class="inp" type="number" step="0.01" id="goal-form-cible" value="${existing?.cible || ''}" placeholder="Ex: 3000"></div>
        <div class="auth-field"><label>Déjà épargné (€)</label>
          <input class="inp" type="number" step="0.01" id="goal-form-deja" value="${existing?.deja_epargne || ''}" placeholder="Ex: 500"></div>
      </div>
      <div class="auth-field"><label>Date cible (optionnelle)</label>
        <input class="inp" type="date" id="goal-form-date" value="${existing?.date_cible || ''}"></div>
      <div class="auth-field"><label>Note (optionnel)</label>
        <input class="inp" id="goal-form-note" value="${esc(existing?.note)}" placeholder="Ex: pour août"></div>
    </div>`
  );
}

function editGoal(id) {
  const g = goalsList.find(g => g.id === id);
  if (g) openGoalForm(g);
}

function openContribForm(id) {
  const g = goalsList.find(g => g.id === id);
  if (!g) return;
  openModal(
    `+ Contribuer à "${g.nom}"`,
    `Ajoute un montant à ton objectif`,
    async () => {
      const montant = parseFloat($('contrib-montant').value) || 0;
      if (montant <= 0) { toast('Montant invalide', 'error'); return false; }
      const oldDeja = Number(g.deja_epargne || 0);
      const newDeja = oldDeja + montant;
      const { error } = await sb.from('epargne_objectifs').update({ deja_epargne: newDeja }).eq('id', id);
      if (error) { toast('Erreur : ' + error.message, 'error'); console.error(error); return false; }
      // Trace la contribution
      await sb.from('epargne_contributions').insert({
        objectif_id: id,
        user_id: currentUser.id,
        montant: montant
      });
      await loadGoals();
      renderEpargne();
      toast(`+${fmt(montant)} ajoutés à "${g.nom}" 🌱`, 'success');
      _goalMilestone({ nom: g.nom, cible: g.cible }, oldDeja, newDeja);
    },
    `<div style="display:flex;flex-direction:column;gap:14px">
      <div style="background:var(--sage-soft);padding:14px;border-radius:10px;text-align:center">
        <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Actuel</div>
        <div style="font-family:var(--fm);font-size:22px;font-weight:800;color:var(--sage)">${fmt(g.deja_epargne)} / ${fmt(g.cible)}</div>
      </div>
      <div class="auth-field"><label>Montant à ajouter (€)</label>
        <input class="inp" type="number" step="0.01" id="contrib-montant" placeholder="Ex: 50" autofocus></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button type="button" onclick="document.getElementById('contrib-montant').value=10" class="goal-btn">+10 €</button>
        <button type="button" onclick="document.getElementById('contrib-montant').value=25" class="goal-btn">+25 €</button>
        <button type="button" onclick="document.getElementById('contrib-montant').value=50" class="goal-btn">+50 €</button>
        <button type="button" onclick="document.getElementById('contrib-montant').value=100" class="goal-btn">+100 €</button>
        <button type="button" onclick="document.getElementById('contrib-montant').value=200" class="goal-btn">+200 €</button>
        <button type="button" onclick="document.getElementById('contrib-montant').value=500" class="goal-btn">+500 €</button>
      </div>
    </div>`
  );
}

async function markAchieved(id) {
  if (!(await dbGuard(sb.from('epargne_objectifs').update({ statut: 'atteint' }).eq('id', id))).ok) return;
  await loadGoals();
  renderEpargne();
  toast('🏆 Bravo ! Objectif atteint !', 'success');
}

async function abandonGoal(id) {
  const g = goalsList.find(g => g.id === id);
  if (!g) return;
  openModal('Annuler cet objectif ?', `"${g.nom}" passera en « Annulé » (grisé). Tu pourras le réactiver quand tu veux.`, async () => {
    if (!(await dbGuard(sb.from('epargne_objectifs').update({ statut: 'abandonne' }).eq('id', id))).ok) return;
    await loadGoals();
    renderEpargne();
    toast('✓ Objectif annulé');
  });
}
// Reporter la date cible d'un objectif en cours
async function postponeGoal(id) {
  const g = goalsList.find(x => x.id === id);
  if (!g) return;
  const cur = g.date_cible ? g.date_cible.slice(0, 10) : '';
  const v = prompt('Reporter à quelle date ? (format AAAA-MM-JJ, ou vide pour retirer)', cur);
  if (v === null) return;
  const val = v.trim();
  if (val && !/^\d{4}-\d{2}-\d{2}$/.test(val)) { toast('Format attendu : AAAA-MM-JJ', 'error'); return; }
  const r = await dbGuard(sb.from('epargne_objectifs').update({ date_cible: val || null }).eq('id', id), 'Report impossible');
  if (!r.ok) return;
  g.date_cible = val || null;
  renderEpargne();
  toast(val ? `✓ Reporté au ${new Date(val).toLocaleDateString('fr-FR')}` : '✓ Date retirée', 'success');
}

async function reactivateGoal(id) {
  if (!(await dbGuard(sb.from('epargne_objectifs').update({ statut: 'en_cours' }).eq('id', id))).ok) return;
  await loadGoals();
  renderEpargne();
  toast('Objectif réactivé 🌱', 'success');
}

async function deleteGoal(id) {
  const g = goalsList.find(g => g.id === id);
  if (!g) return;
  openModal('Supprimer', `Supprimer définitivement "${g.nom}" ?`, async () => {
    if (!(await dbGuard(sb.from('epargne_objectifs').delete().eq('id', id))).ok) return;
    await loadGoals();
    renderEpargne();
    toast('Supprimé');
  });
}
function addGoal() { openGoalForm(); }

// ═══ PERFORMANCE CARDS vs M-1 ═════════════════════════════════
function renderPerfCards(currentKey, curIn, curOut, curBal) {
  // Mois précédent
  const prevD = new Date(dashYear, dashMonth - 1, 1);
  const prevKey = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}`;
  const prevTx = transactions.filter(t => t.date_op.startsWith(prevKey));
  const prevIn = prevTx.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.amount), 0);
  const prevOut = prevTx.filter(t => t.type === 'sortie').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const prevBal = prevIn - prevOut;

  // ─── 1. Gestion globale : Solde net (In - Out) ───
  const moneyVal = $('perf-money-val');
  moneyVal.textContent = (curBal >= 0 ? '+' : '') + fmt(curBal);
  moneyVal.className = 'perf-val ' + (curBal >= 0 ? 'positive' : 'negative');
  const moneyCard = $('perf-money');
  moneyCard.classList.toggle('negative', curBal < 0);
  // Cliquable → liste éditable de toutes les opérations du mois
  moneyCard.style.cursor = 'pointer';
  moneyCard.onclick = () => openKpiList('all');
  moneyCard.title = 'Voir & modifier les opérations du mois';

  // Delta
  const deltaMoney = curBal - prevBal;
  const badgeMoney = $('perf-money-badge');
  const arrowMoney = badgeMoney.querySelector('.perf-badge-arrow');
  const deltaMoneyEl = $('perf-money-delta');
  if (prevBal !== 0 || curBal !== 0) {
    const pct = prevBal !== 0 ? Math.round(Math.abs(deltaMoney / prevBal * 100)) : (curBal > 0 ? 100 : -100);
    if (deltaMoney > 0) {
      badgeMoney.className = 'perf-badge up';
      arrowMoney.textContent = '↗';
      deltaMoneyEl.textContent = `+${fmt(deltaMoney)} (+${pct}%)`;
    } else if (deltaMoney < 0) {
      badgeMoney.className = 'perf-badge down';
      arrowMoney.textContent = '↘';
      deltaMoneyEl.textContent = `${fmt(deltaMoney)} (-${pct}%)`;
    } else {
      badgeMoney.className = 'perf-badge neutral';
      arrowMoney.textContent = '—';
      deltaMoneyEl.textContent = 'Stable';
    }
  } else {
    badgeMoney.className = 'perf-badge neutral';
    arrowMoney.textContent = '—';
    deltaMoneyEl.textContent = 'Pas de data';
  }
  $('perf-money-icon').textContent = curBal >= 0 ? '📈' : '📉';

  // Sparkline gestion : 6 derniers mois de soldes
  const sparkMoney = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(dashYear, dashMonth - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const mtx = transactions.filter(t => t.date_op.startsWith(key));
    const mi = mtx.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.amount), 0);
    const mo = mtx.filter(t => t.type === 'sortie').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    sparkMoney.push(mi - mo);
  }
  updateChart('perf-money-chart', 'line', {
    labels: sparkMoney.map(() => ''),
    datasets: [{
      data: sparkMoney,
      borderColor: curBal >= 0 ? '#7FB89E' : '#DD7B85',
      backgroundColor: (curBal >= 0 ? 'rgba(127,184,158,0.15)' : 'rgba(221,123,133,0.15)'),
      borderWidth: 2,
      tension: 0.4,
      fill: true,
      pointRadius: 0,
      pointHoverRadius: 4
    }]
  }, {
    scales: { x: { display: false }, y: { display: false } },
    plugins: { legend: { display: false }, tooltip: { enabled: false } }
  });

  // ─── 2. Épargne : basée sur tes opérations de type « Épargne » du mois ───
  // Règle claire : l'épargne du mois = somme des opérations que TU as saisies en type Épargne
  // (via le calendrier). Ni revenu, ni dépense. → cohérent avec les graphiques épargne.
  const epargneFlow = (k) => transactions.filter(t => t.date_op.startsWith(k) && t.type === 'epargne').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const curSavings = epargneFlow(currentKey);
  const prevSavings = epargneFlow(prevKey);

  const savingsVal = $('perf-savings-val');
  savingsVal.textContent = fmt(curSavings);
  savingsVal.className = 'perf-val ' + (curSavings > 0 ? 'positive' : '');
  // Libellé + basis + clic
  const savLabelEl = document.querySelector('#perf-savings .perf-label');
  if (savLabelEl) savLabelEl.textContent = '🐷 Épargne du mois';
  const savCard = $('perf-savings');
  if (savCard) {
    savCard.style.cursor = 'pointer';
    savCard.onclick = () => openKpiList('epargne');
    savCard.title = 'Basée sur tes opérations de type Épargne — cliquer pour voir & modifier';
  }

  const deltaSavings = curSavings - prevSavings;
  const badgeSavings = $('perf-savings-badge');
  const arrowSavings = badgeSavings.querySelector('.perf-badge-arrow');
  const deltaSavEl = $('perf-savings-delta');
  if (prevSavings !== 0 || curSavings !== 0) {
    const pct = prevSavings !== 0 ? Math.round(Math.abs(deltaSavings / prevSavings * 100)) : 100;
    if (deltaSavings > 0) {
      badgeSavings.className = 'perf-badge up';
      arrowSavings.textContent = '↗';
      deltaSavEl.textContent = `+${fmt(deltaSavings)} (+${pct}%)`;
    } else if (deltaSavings < 0) {
      badgeSavings.className = 'perf-badge down';
      arrowSavings.textContent = '↘';
      deltaSavEl.textContent = `${fmt(deltaSavings)} (-${pct}%)`;
    } else {
      badgeSavings.className = 'perf-badge neutral';
      arrowSavings.textContent = '—';
      deltaSavEl.textContent = 'Stable';
    }
  } else {
    badgeSavings.className = 'perf-badge neutral';
    arrowSavings.textContent = '—';
    deltaSavEl.textContent = 'Pas encore saisie';
  }
  $('perf-savings-icon').textContent = curSavings > 0 ? '🌱' : '🎯';

  // Sparkline épargne : flux d'épargne des 6 derniers mois (type = epargne)
  const sparkSav = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(dashYear, dashMonth - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    sparkSav.push(epargneFlow(key));
  }
  updateChart('perf-savings-chart', 'bar', {
    labels: sparkSav.map(() => ''),
    datasets: [{
      data: sparkSav,
      backgroundColor: sparkSav.map((_, i) => i === sparkSav.length - 1 ? '#7C3F58' : '#D8B4DD'),
      borderRadius: 3,
      borderSkipped: false,
      barPercentage: 0.7
    }]
  }, {
    scales: { x: { display: false }, y: { display: false } },
    plugins: { legend: { display: false }, tooltip: { enabled: false } }
  });
}

// ═══ VUE ANNUELLE ══════════════════════════════════════════════
const REV_CATS = ['Salaire', 'Tickets restaurant', 'Remboursements'];
const EXP_CATS = ['Loyer', 'Alimentation', 'Transport', 'Cosmétique', 'Mode', 'Santé', 'Éducation', 'Administratif', 'Vie quotidienne', 'Abonnements', 'Paiement échelonné', 'Dîme', 'Dons', 'Investissements', 'Banque', 'Impôts', 'Transactions', 'Autres'];

function renderVueAnnuelle() {
  if ($('annuelle-year')) annuelleYear = parseInt($('annuelle-year').value) || annuelleYear;
  const yearTx = transactions.filter(t => t.date_op.startsWith(String(annuelleYear)));

  // Compute par cat × mois
  const catByMonth = {};
  yearTx.forEach(t => {
    if (t.type === 'epargne') return; // l'épargne n'est ni revenu ni dépense
    const m = parseInt(t.date_op.slice(5, 7)) - 1;
    if (!catByMonth[t.category]) catByMonth[t.category] = new Array(12).fill(0);
    catByMonth[t.category][m] += t.type === 'entree' ? Number(t.amount) : Math.abs(Number(t.amount));
  });

  const body = $('annuelle-body');
  if (!body) return;
  body.innerHTML = '';

  const buildRow = (label, values, opts = {}) => {
    const total = values.reduce((s, v) => s + v, 0);
    const color = opts.color || '';
    const trClass = opts.trClass || '';
    const cells = values.map(v => `<td style="color:${color}">${v > 0 ? fmt(v) : '<span class="annuelle-empty">—</span>'}</td>`).join('');
    body.innerHTML += `<tr class="${trClass}"><td>${opts.emoji ? opts.emoji + ' ' : ''}${label}</td>${cells}<td style="color:${color};font-weight:800">${total > 0 ? fmt(total) : '—'}</td></tr>`;
  };

  // Revenus
  let totalRev = new Array(12).fill(0);
  REV_CATS.forEach(cat => {
    const vals = catByMonth[cat] || new Array(12).fill(0);
    vals.forEach((v, i) => totalRev[i] += v);
    buildRow(cat, vals, { color: 'var(--sage)', emoji: catIcon(cat) });
  });
  buildRow('Total Revenus', totalRev, { trClass: 'total-row' });

  // Dépenses (on exclut « Transactions » = virements internes, qui fausseraient le solde net)
  let totalExp = new Array(12).fill(0);
  EXP_CATS.filter(cat => cat !== 'Transactions').forEach(cat => {
    const vals = catByMonth[cat] || new Array(12).fill(0);
    vals.forEach((v, i) => totalExp[i] += v);
    if (vals.some(v => v > 0)) {
      buildRow(cat, vals, { color: catColor(cat), emoji: catIcon(cat) });
    }
  });
  buildRow('Total dépenses', totalExp, { trClass: 'total-row', color: 'var(--tender-rose)' });

  // Solde net
  const solde = totalRev.map((r, i) => r - totalExp[i]);
  buildRow('Solde net', solde, { trClass: 'subtotal-row' });

  // Graphe Revenus vs Dépenses par mois
  const annuelleHasData = totalRev.some(v => v > 0) || totalExp.some(v => v > 0);
  const aChartCard = $('annuelle-chart-card');
  if (aChartCard) aChartCard.style.display = annuelleHasData ? '' : 'none';
  if (annuelleHasData) {
    updateChart('annuelle-chart', 'bar', {
      labels: MONTHS_SHORT,
      datasets: [
        { label: 'Revenus', data: totalRev, backgroundColor: '#7FB89E', borderRadius: 4, maxBarThickness: 22 },
        { label: 'Dépenses', data: totalExp, backgroundColor: '#DD7B85', borderRadius: 4, maxBarThickness: 22 }
      ]
    }, {
      plugins: { legend: { display: true, position: 'top', labels: { color: '#718096', font: { size: 11 }, usePointStyle: true, boxWidth: 10 } } },
      scales: {
        x: { ticks: { color: '#A0AEC0' }, grid: { display: false } },
        y: { ticks: { color: '#A0AEC0', callback: v => v.toLocaleString('fr-FR') + ' €' }, grid: { color: '#F5E7EA' } }
      }
    });
  }

  // KPIs année
  const sumRev = totalRev.reduce((s, v) => s + v, 0);
  const sumExp = totalExp.reduce((s, v) => s + v, 0);
  const sumBal = sumRev - sumExp;
  set('annuelle-rev', fmt(sumRev));
  set('annuelle-dep', fmt(sumExp));
  const balEl = $('annuelle-bal');
  balEl.textContent = (sumBal >= 0 ? '+' : '') + fmt(sumBal);
  balEl.style.color = sumBal >= 0 ? 'var(--sage)' : 'var(--tender-rose)';
  const monthsWithData = totalRev.filter(v => v > 0).length;
  set('annuelle-rev-hint', monthsWithData > 0 ? `${Math.round(sumRev / monthsWithData)} €/mois` : '—');
  set('annuelle-dep-hint', monthsWithData > 0 ? `${Math.round(sumExp / monthsWithData)} €/mois` : '—');
  set('annuelle-bal-hint', monthsWithData > 0 ? `${Math.round(sumBal / monthsWithData)} €/mois` : '—');
}

// ═══ BUDGET PRÉPA ══════════════════════════════════════════════

// ─── Alerte budget : réel du mois en cours vs budget validé ───
// Mapping explicite catégorie → bloc budgétaire (transparent et prévisible)
const BUDGET_BLOCK = {
  'Loyer': 'charges', 'Alimentation': 'charges', 'Transport': 'charges', 'Santé': 'charges',
  'Abonnements': 'charges', 'Administratif': 'charges',
  'Impôts': 'charges', 'Banque': 'charges', 'Éducation': 'charges', 'Aide au logement': 'charges',
  'Vie quotidienne': 'plaisir', 'Mode': 'plaisir', 'Cosmétique': 'plaisir', 'Dons': 'plaisir', 'Tech & Électronique': 'plaisir',
  'Amis & Famille': 'plaisir', 'Divertissement': 'plaisir', 'Voyages': 'plaisir',
  'Dîme': 'charges', 'Investissements': 'epargne', 'Imprévus': 'imprevus',
  'Restos & sorties': 'plaisir'   // catégorie budgétaire virtuelle (manger dehors = plaisir)
};
// Sous-catégories d'Alimentation qui comptent comme « Plaisir » (manger dehors)
const ALIM_PLAISIR_SUBS = ['Restos', 'Café / Bar', 'Livraison', 'Sorties', 'Sortie', 'Restaurant'];
// Catégorie BUDGÉTAIRE d'une transaction : Alimentation se scinde selon la sous-cat
function txBudgetCat(t) {
  if (t.category === 'Alimentation' && ALIM_PLAISIR_SUBS.includes((t.sub_category || '').trim())) return 'Restos & sorties';
  return t.category;
}
function txBlock(t) { return BUDGET_BLOCK[txBudgetCat(t)] || null; }
// Un prêt (sous-catégorie « Prêt ») = argent qui revient → ne compte PAS dans le budget
function isLoan(t) { const s = (t.sub_category || '').toLowerCase(); return s.includes('prêt') || s.includes('pret'); }
// Familles budgétaires (pour regrouper les catégories)
const FAMILY_LABEL = { charges: '🏠 Charges', plaisir: '🌸 Plaisir', epargne: '🌱 Épargne', imprevus: '⚡ Imprévus' };
function catFamily(cat) { return BUDGET_BLOCK[cat] || null; }
// Options d'un <select> de catégories, regroupées par famille via <optgroup>
function catOptionsGrouped(selected) {
  const groups = { charges: [], plaisir: [], epargne: [], imprevus: [], autres: [] };
  Object.keys(CAT_META).forEach(c => { (groups[BUDGET_BLOCK[c]] || groups.autres).push(c); });
  const order = [['charges', FAMILY_LABEL.charges], ['plaisir', FAMILY_LABEL.plaisir], ['epargne', FAMILY_LABEL.epargne], ['imprevus', FAMILY_LABEL.imprevus], ['autres', '📂 Autres (revenus, divers)']];
  return order.map(([k, lbl]) => {
    const arr = (groups[k] || []).sort();
    if (!arr.length) return '';
    return `<optgroup label="${lbl}">` + arr.map(c => `<option value="${esc(c)}" ${c === selected ? 'selected' : ''}>${catIcon(c)} ${esc(c)}</option>`).join('') + '</optgroup>';
  }).join('');
}
function computeBudgetStatus(monthKey) {
  let key = monthKey;
  if (!key) {
    const now = new Date();
    key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  const b = budgetByMonth[key] || budgetTemplate; // budget du mois réel en cours (modèle si pas encore défini)
  const rev = b.revenu_mensuel || 0;
  const sub = b.sub_budget || DEFAULT_SUB_PCT;
  const pctImp = Number((b.sub_budget && b.sub_budget._pctImprevus) || 0); // % Imprévus (stocké dans le jsonb)
  const spent = { charges: 0, plaisir: 0, epargne: 0, imprevus: 0 };
  const spentByCat = {};
  let outTotal = 0;   // TOUT ce qui sort du compte ce mois (dépenses + épargne + prêts), hors virements internes
  let especesSpent = 0; // 💵 poche espèces : dépenses réglées en liquide ce mois (suivi à part)
  transactions.forEach(t => {
    if (!t.date_op.startsWith(key)) return;
    const a = Math.abs(Number(t.amount));
    if (t.type === 'epargne') { spent.epargne += a; outTotal += a; return; } // l'épargne = un type à part (mais elle SORT du compte)
    if (t.type !== 'sortie') return;
    if (t.payment_method === 'especes') especesSpent += a; // 💵 réglé en liquide → alimente la poche espèces
    if (t.category !== 'Transactions') outTotal += a; // total sorti (prêts inclus) ; exclut les virements internes (doublons)
    if (isLoan(t)) return;                          // MAIS un prêt ne compte PAS dans le budget par catégorie (il revient)
    const bc = txBudgetCat(t);                     // Alimentation se scinde en Alimentation / Restos & sorties
    spentByCat[bc] = (spentByCat[bc] || 0) + a;
    const bl = BUDGET_BLOCK[bc];
    if (bl) spent[bl] += a;
  });
  // Budget par poste (catégorie) = somme des % de cette catégorie sur les blocs dépenses
  const budgetByCat = {};
  ['charges', 'plaisir'].forEach(blk => (sub[blk] || []).forEach(it => {
    if (it.cat) budgetByCat[it.cat] = (budgetByCat[it.cat] || 0) + rev * (it.pct || 0) / 100;
  }));
  if (pctImp > 0) budgetByCat['Imprévus'] = (budgetByCat['Imprévus'] || 0) + rev * pctImp / 100; // Imprévus = 1 catégorie = toute sa famille
  // % exacts (décimaux) depuis le jsonb si présents, sinon colonnes entières
  const _bsub = b.sub_budget;
  const _pc = (_bsub && _bsub._pctCharges != null) ? Number(_bsub._pctCharges) : (b.pct_charges || 0);
  const _pp = (_bsub && _bsub._pctPlaisir != null) ? Number(_bsub._pctPlaisir) : (b.pct_plaisir || 0);
  const _pe = (_bsub && _bsub._pctEpargne != null) ? Number(_bsub._pctEpargne) : (b.pct_epargne || 0);
  const budget = {
    charges: Math.round(rev * _pc / 100),
    plaisir: Math.round(rev * _pp / 100),
    epargne: Math.round(rev * _pe / 100),
    imprevus: Math.round(rev * pctImp / 100)
  };
  // Dépenses "à prévoir" du mois (loyer, factures que tu sais devoir payer) → à retirer du disponible
  const aPrevoir = (b.events || []).reduce((s, e) => s + Number(e.amount || 0), 0);
  const especesPrevu = Number((b.sub_budget && b.sub_budget._especes) || 0); // 💵 enveloppe liquide prévue ce mois
  return { rev, key, spent, spentByCat, budgetByCat, budget, aPrevoir, outTotal, especesPrevu, especesSpent };
}
// compact=true (dashboard) : n'affiche que les postes à surveiller. Sinon : tous les postes.
function renderBudgetStatus(containerId, compact, monthKey) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const { rev, spent, spentByCat, budgetByCat, budget, aPrevoir, key, outTotal } = computeBudgetStatus(monthKey);
  if (!rev) { el.innerHTML = '<div class="empty-sub">Renseigne ton revenu mensuel dans Gestion du budget pour activer le suivi du mois.</div>'; return; }
  const totalBudgetDep = budget.charges + budget.plaisir + (budget.imprevus || 0);
  const totalSpentDep = spent.charges + spent.plaisir + (spent.imprevus || 0);
  // Reste à dépenser = REVENU − TOUT ce qui est sorti du compte (dépenses + épargne + prêts). Le « à prévoir » n'est pas soustrait.
  const reste = rev - outTotal;
  let rows = [...new Set([...Object.keys(budgetByCat), ...Object.keys(spentByCat).filter(c => ['charges', 'plaisir', 'imprevus'].includes(BUDGET_BLOCK[c]))])]
    .map(cat => {
      const bud = Math.round(budgetByCat[cat] || 0);
      const sp = Math.round(spentByCat[cat] || 0);
      return { cat, bud, sp, over: bud > 0 && sp > bud, pct: bud > 0 ? Math.round(sp / bud * 100) : (sp > 0 ? 999 : 0) };
    })
    .filter(r => r.bud > 0 || r.sp > 0)
    .sort((a, b) => (b.over - a.over) || (b.pct - a.pct));
  if (compact) rows = rows.filter(r => r.pct >= 80).slice(0, 6);
  else {
    // Vue complète : on allège → on ne garde que les postes ENTAMÉS mais pas encore bouclés.
    //  • pas dépensé (sp = 0)         → retiré
    //  • budget atteint pile (reste 0) → retiré (c'est réglé, ça prend de la place pour rien)
    //  • en cours (partiel) ou dépassé → gardé
    rows = rows.filter(r => r.sp > 0 && r.sp !== r.bud);
  }
  const bar = (r) => {
    // 3 niveaux : ≤60% = vert · >60% (pas encore dépassé) = rouge clair (attention) · dépassé = rouge
    const warn = !r.over && r.bud > 0 && r.pct > 60;
    const color = r.over ? '#E53935' : warn ? '#E8908F' : 'var(--sage)';
    const w = Math.min(100, r.pct);
    const status = r.over
      ? `⚠️ hors budget · dépassé de ${fmt(r.sp - r.bud)}`
      : r.bud > 0
        ? `${warn ? '⚠ attention' : '✓ dans le budget'} · reste ${fmt(r.bud - r.sp)}`
        : 'hors budget (poste non prévu)';
    return `
      <div style="margin-bottom:10px;cursor:pointer" onclick="openCatMonthList('${esc(r.cat)}','${key}')" title="Voir les opérations ${esc(r.cat)} de ce mois">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
          <span style="font-weight:600">${catIcon(r.cat)} ${esc(r.cat)} ›</span>
          <span style="font-family:var(--fm);color:${color};font-weight:700">${fmt(r.sp)} / ${fmt(r.bud)}</span>
        </div>
        <div style="height:6px;background:var(--border-soft);border-radius:100px;overflow:hidden">
          <div style="height:100%;width:${w}%;background:${color};border-radius:100px;transition:width .5s"></div>
        </div>
        <div style="font-size:10px;color:${color};margin-top:2px">${status}</div>
      </div>`;
  };
  // ── Estimation « rythme récent » : moyenne des dépenses des 3 derniers mois COMPLETS ──
  // (pas d'extrapolation du mois en cours → plus de chiffre absurde ; comparée à TON revenu)
  let forecastHtml = '';
  const _now = new Date();
  const _curKey = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}`;
  if (key === _curKey && rev > 0) {
    let sumM = 0, nM = 0;
    for (let i = 1; i <= 3; i++) {
      const d = new Date(_now.getFullYear(), _now.getMonth() - i, 1);
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const mtx = transactions.filter(t => t.date_op.startsWith(mk) && t.type === 'sortie');
      if (mtx.length) { sumM += mtx.reduce((s, t) => s + Math.abs(Number(t.amount)), 0); nM++; }
    }
    if (nM > 0) {
      const avgM = Math.round(sumM / nM);
      const projReste = rev - avgM;
      const over = avgM > rev;
      forecastHtml = `<div style="padding:10px 12px;border-radius:12px;background:${over ? 'rgba(229,57,53,0.10)' : 'rgba(232,163,23,0.10)'};font-size:12px;line-height:1.5;margin-bottom:14px">
        <b>📈 Ton rythme récent</b> <span style="color:var(--muted)">(moyenne de tes ${nM} dernier${nM > 1 ? 's' : ''} mois)</span><br>
        Tu dépenses en moyenne <b>${fmt(avgM)}/mois</b>. Sur ton revenu de <b>${fmt(rev)}</b>, il te resterait ~<b style="color:${projReste >= 0 ? 'var(--sage)' : '#E53935'}">${fmt(projReste)}</b>.
        ${over ? `<br><span style="color:#B7791F">⚠ Ces derniers mois, tu as dépensé plus que ton revenu — vise un retour à l'équilibre.</span>` : ''}
        <br><span style="color:var(--muted);font-size:11px">Estimation indicative sur tes derniers mois — pas une fatalité 🌱</span>
      </div>`;
    }
  }
  // ── 💧 Reste à vivre par jour (le chiffre du quotidien) ──
  let dailyHtml = '';
  if (key === _curKey && rev > 0) {
    const dayEl = _now.getDate();
    const daysIn = new Date(_now.getFullYear(), _now.getMonth() + 1, 0).getDate();
    const daysLeft = Math.max(1, daysIn - dayEl + 1);
    // Basé UNIQUEMENT sur le reste à dépenser (revenu − déjà dépensé). Le « à prévoir » n'entre PAS dans le calcul.
    const perDay = Math.round(Math.max(0, reste) / daysLeft);
    dailyHtml = `<div style="text-align:center;padding:12px;border-radius:12px;background:rgba(127,184,158,0.10);margin-bottom:14px">
      <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">💧 Reste à vivre par jour</div>
      <div style="font-size:24px;font-weight:900;color:var(--sage);font-family:var(--fm)">${fmt(perDay)}<span style="font-size:13px;color:var(--muted)"> /jour</span></div>
      <div style="font-size:11px;color:var(--muted)">≈ ${fmt(perDay * 7)}/semaine · sur les ${daysLeft} jour(s) restant(s)</div>
    </div>`;
  }
  el.innerHTML = `
    <div style="text-align:center;padding:12px;border-radius:12px;background:${reste >= 0 ? 'rgba(127,184,158,0.12)' : 'rgba(229,57,53,0.1)'};margin-bottom:14px">
      <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Reste à dépenser · ${MONTHS[parseInt(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}</div>
      <div style="font-size:26px;font-weight:900;color:${reste >= 0 ? 'var(--sage)' : '#E53935'};font-family:var(--fm)">${fmt(reste)}</div>
      <div style="font-size:11px;color:var(--muted)">${fmt(rev)} de revenu − ${fmt(outTotal)} sortis du compte${spent.epargne > 0 ? ' (dépenses + épargne)' : ''}</div>
      ${aPrevoir > 0 ? `<div style="font-size:11px;color:var(--muted);margin-top:4px">📌 Pense-bête : ${fmt(aPrevoir)} de dépenses à prévoir (non déduites)</div>` : ''}
    </div>
    ${dailyHtml}
    ${forecastHtml}
    ${!rows.length ? '<div class="empty-sub" style="text-align:center;padding:8px 0">👍 Rien à surveiller pour l\'instant — les postes réglés ou non entamés sont masqués</div>' : ''}
    ${rows.map(bar).join('')}
    ${!compact ? `<div style="margin-top:12px;padding:10px 12px;border-radius:12px;background:var(--sage-soft);font-size:12px;line-height:1.6">
      <div style="font-weight:800;margin-bottom:2px">🌱 Épargne — ${MONTHS[parseInt(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}</div>
      <div style="display:flex;justify-content:space-between"><span>🎯 Cible (${rev > 0 ? Math.round(budget.epargne / rev * 100) : 0}% de tes revenus)</span><b style="font-family:var(--fm)">${fmt(budget.epargne)}</b></div>
      <div style="display:flex;justify-content:space-between"><span>✅ Réel mis de côté ce mois</span><b style="font-family:var(--fm);color:${spent.epargne >= budget.epargne ? 'var(--sage)' : 'var(--ink)'}">${fmt(spent.epargne)}</b></div>
      <div style="font-size:11px;color:var(--muted);margin-top:3px">${spent.epargne >= budget.epargne ? '🎉 Tu dépasses ta cible d\'épargne, bravo !' : 'Il te manque ' + fmt(budget.epargne - spent.epargne) + ' pour atteindre ta cible.'}</div>
    </div>` : ''}`;
}
let _budgetAlertShown = false;
function budgetStartupAlert() {
  if (_budgetAlertShown) return;
  _budgetAlertShown = true;
  const { rev, spent, budget } = computeBudgetStatus();
  if (!rev) return;
  const over = [];
  if (budget.charges > 0 && spent.charges > budget.charges) over.push('Charges');
  if (budget.plaisir > 0 && spent.plaisir > budget.plaisir) over.push('Plaisir');
  if (over.length) toast(`⚠️ Budget dépassé ce mois : ${over.join(' et ')}`, 'error');
}

// ─── Dépenses/événements à prévoir (propres à chaque mois, enregistrés dans budget_mensuel) ───
function addBudgetEvent() {
  const label = $('bud-event-label').value.trim();
  const amount = parseFloat($('bud-event-amount').value);
  if (!label || !amount || amount <= 0) { toast('Un libellé et un montant, s\'il te plaît', 'error'); return; }
  budgetData.events = budgetData.events || [];
  budgetData.events.push({ label, amount });
  saveBudgetPrepNow();
  $('bud-event-label').value = '';
  $('bud-event-amount').value = '';
  $('bud-event-label').focus();
  renderBudgetEvents();
}
function removeBudgetEvent(i) {
  budgetData.events = budgetData.events || [];
  const e = budgetData.events[i]; if (!e) return;
  confirmDelete(`Retirer « ${esc(e.label || 'cette note')} » de tes dépenses à prévoir ?`, () => {
    budgetData.events.splice(i, 1);
    saveBudgetPrepNow();
    renderBudgetEvents();
  });
}
// Modifier une note « à prévoir » (libellé ou montant) directement
function editBudgetEvent(i, field, val) {
  budgetData.events = budgetData.events || [];
  const e = budgetData.events[i];
  if (!e) return;
  if (field === 'label') e.label = String(val).trim();
  else if (field === 'amount') { const n = parseFloat(val); e.amount = (n > 0 ? n : 0); }
  saveBudgetPrepNow();
  renderBudgetEvents();
}
function renderBudgetEvents() {
  const el = $('bud-events-list');
  if (!el) return;
  const list = budgetData.events || [];
  if (!list.length) {
    el.innerHTML = '<div class="empty-sub">Rien de prévu pour l\'instant. Note ici ce que tu sais devoir dépenser ce mois-ci (Uber, cadeau, sortie, Ilévia…) pour l\'avoir en tête.</div>';
    return;
  }
  const total = list.reduce((s, e) => s + Number(e.amount), 0);
  el.innerHTML = list.map((e, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border-soft)">
      <input class="inp" value="${esc(e.label)}" onchange="editBudgetEvent(${i},'label',this.value)" title="Modifier la note" style="flex:1;font-size:14px;padding:6px 8px">
      <input class="inp" type="number" step="0.01" min="0" value="${e.amount}" onchange="editBudgetEvent(${i},'amount',this.value)" title="Modifier le montant" style="width:88px;text-align:right;font-family:var(--fm);font-weight:700;padding:6px 8px">
      <span style="font-size:11px;color:var(--muted)">€</span>
      <button onclick="removeBudgetEvent(${i})" style="background:none;border:none;color:var(--tender-rose);cursor:pointer;font-size:16px;line-height:1" title="Retirer">✕</button>
    </div>`).join('') +
    `<div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;font-weight:800;font-size:15px">
       <span>Total à prévoir</span><span style="color:var(--rose)">${fmt(total)}</span>
     </div>`;
}

// ─── Détection des dépenses récurrentes (abonnements, loyer…) ───
let _recurringCache = [];
function detectRecurring() {
  const byKey = {};
  transactions.filter(t => t.type === 'sortie').forEach(t => {
    const k = t.merchant_key || merchantKey(t.label);
    if (!k || k.length < 3) return;
    (byKey[k] = byKey[k] || []).push(t);
  });
  const rec = [];
  Object.entries(byKey).forEach(([k, arr]) => {
    const months = new Set(arr.map(t => t.date_op.slice(0, 7)));
    if (months.size < 3) return; // récurrent = présent sur au moins 3 mois différents
    const amts = arr.map(t => Math.abs(Number(t.amount)));
    const avg = amts.reduce((s, a) => s + a, 0) / amts.length;
    if (avg < 3) return;
    const variance = amts.reduce((s, a) => s + (a - avg) ** 2, 0) / amts.length;
    const cv = avg > 0 ? Math.sqrt(variance) / avg : 1;
    if (cv > 0.45) return; // montant trop variable → pas un vrai récurrent fixe
    const last = arr.slice().sort((a, b) => (a.date_op < b.date_op ? 1 : -1))[0];
    rec.push({ label: last.label, avg: Math.round(avg), months: months.size, category: last.category });
  });
  return rec.sort((a, b) => b.avg - a.avg).slice(0, 15);
}
function renderRecurring() {
  const card = $('recurring-card'); const list = $('recurring-list');
  if (!card || !list) return;
  _recurringCache = detectRecurring();
  if (!_recurringCache.length) { card.style.display = 'none'; return; }
  card.style.display = '';
  const existing = new Set((budgetData.events || []).map(e => (e.label || '').toLowerCase()));
  const totalMonthly = _recurringCache.reduce((s, r) => s + r.avg, 0);
  list.innerHTML = _recurringCache.map((r, i) => {
    const already = existing.has(r.label.toLowerCase());
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-soft)">
      <div class="day-tx-icon" style="background:${catColor(r.category)}18;color:${catColor(r.category)};width:34px;height:34px;flex-shrink:0">${catIcon(r.category)}</div>
      <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.label)}</div><div style="font-size:11px;color:var(--muted)">${esc(r.category)} · vu sur ${r.months} mois</div></div>
      <div style="font-family:var(--fm);font-weight:700;white-space:nowrap">~${fmt(r.avg)}/mois</div>
      <button class="btn-ghost" style="padding:5px 10px;font-size:12px;flex-shrink:0" onclick="addRecurringToPrevoir(${i})" ${already ? 'disabled' : ''}>${already ? '✓ ajouté' : '+ à prévoir'}</button>
    </div>`;
  }).join('') + `<div style="text-align:right;font-size:12px;color:var(--muted);margin-top:10px">Total récurrent estimé : <b>${fmt(totalMonthly)}/mois</b></div>`;
}
function addRecurringToPrevoir(i) {
  const r = _recurringCache[i];
  if (!r) return;
  budgetData.events = budgetData.events || [];
  budgetData.events.push({ label: r.label, amount: r.avg });
  saveBudgetPrepNow();
  renderBudgetEvents();
  renderRecurring();
  toast('✓ Ajouté à « à prévoir »', 'success');
}

// % de budget : accepte les décimales (virgule ou point), borne 0-100, arrondi à 1 décimale
function _pctVal(v) {
  const n = parseFloat(String(v == null ? '' : v).replace(',', '.')) || 0;
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}
function normalizeBudgetPct(changed) {
  const c = _pctVal($('bud-pct-charges').value);
  const p = _pctVal($('bud-pct-plaisir').value);
  const e = _pctVal($('bud-pct-epargne').value);
  const im = $('bud-pct-imprevus') ? _pctVal($('bud-pct-imprevus').value) : 0;
  budgetData.pct_charges = c;
  budgetData.pct_plaisir = p;
  budgetData.pct_epargne = e;
  budgetData.pct_imprevus = im;
  _ensureSubBudget()._pctImprevus = im; // persisté dans le jsonb (pas de colonne SQL à ajouter)
  const total = Math.round((c + p + e + im) * 10) / 10;
  const totalEl = $('bud-total-pct');
  totalEl.textContent = total + '%';
  totalEl.style.color = total === 100 ? 'var(--sage)' : total > 100 ? 'var(--tender-rose)' : 'var(--peach)';
  renderBudget();
  saveBudgetPrep();
}

// 💵 Saisie de l'enveloppe espèces prévue → stockée dans le jsonb sub_budget._especes (pas de colonne SQL)
function onEspecesInput() {
  const v = parseFloat(String($('bud-especes').value).replace(',', '.')) || 0;
  _ensureSubBudget()._especes = v;
  if (typeof renderRealBlocks === 'function') renderRealBlocks();
  renderBudgetStatus('budget-alert-page', false, budgetKey());
  saveBudgetPrep();
}

let budgetSaveTimer = null;
// Lit les valeurs courantes des champs et enregistre en base
function _doBudgetSave() {
  budgetData.revenu_mensuel = parseFloat($('bud-revenu').value) || 0;
  budgetData.pct_charges = _pctVal($('bud-pct-charges').value);
  budgetData.pct_plaisir = _pctVal($('bud-pct-plaisir').value);
  budgetData.pct_epargne = _pctVal($('bud-pct-epargne').value);
  if ($('bud-pct-imprevus')) budgetData.pct_imprevus = _pctVal($('bud-pct-imprevus').value);
  // Les colonnes pct_* sont ENTIÈRES en base → on y met des entiers, et on garde les décimales dans le jsonb
  const subB = _ensureSubBudget();
  subB._pctImprevus = budgetData.pct_imprevus || 0;
  subB._pctCharges = budgetData.pct_charges;
  subB._pctPlaisir = budgetData.pct_plaisir;
  subB._pctEpargne = budgetData.pct_epargne;
  if ($('bud-especes')) subB._especes = parseFloat(String($('bud-especes').value).replace(',', '.')) || 0; // 💵 enveloppe liquide
  const key = budgetKey();
  const payload = {
    user_id: currentUser.id, month: key + '-01',
    revenu_mensuel: budgetData.revenu_mensuel,
    pct_charges: Math.round(budgetData.pct_charges || 0),   // colonne int
    pct_plaisir: Math.round(budgetData.pct_plaisir || 0),
    pct_epargne: Math.round(budgetData.pct_epargne || 0),
    sub_budget: budgetData.sub_budget || null,              // contient les % décimaux exacts
    events: budgetData.events || []
  };
  budgetByMonth[key] = { ...(budgetByMonth[key] || {}), ...payload };
  return dbGuard(sb.from('budget_mensuel').upsert(payload, { onConflict: 'user_id,month' }), 'Sauvegarde du budget échouée.');
}
function saveBudgetPrep() { clearTimeout(budgetSaveTimer); budgetSaveTimer = setTimeout(_doBudgetSave, 1000); }
// Sauvegarde IMMÉDIATE (appelée quand tu quittes un champ) → plus de perte au refresh
function saveBudgetPrepNow() { clearTimeout(budgetSaveTimer); _doBudgetSave(); }
// Sauvegarde manuelle via le bouton « Sauvegarder mon budget » (avec confirmation)
async function saveBudgetManual() {
  clearTimeout(budgetSaveTimer);
  const r = await _doBudgetSave();
  if (r.ok) toast('✓ Budget enregistré', 'success');
}

// Modèle de répartition fine par défaut (poids relatifs par sous-catégorie)
const DEFAULT_SUB_PCT = {
  charges: [
    { cat: 'Loyer', pct: 30 }, { cat: 'Alimentation', pct: 10 }, { cat: 'Transport', pct: 5 },
    { cat: 'Santé', pct: 3 }, { cat: 'Abonnements', pct: 2 }, { cat: 'Administratif', pct: 2 }, { cat: 'Dîme', pct: 10 }
  ],
  plaisir: [
    { cat: 'Vie quotidienne', pct: 8 }, { cat: 'Mode', pct: 5 }, { cat: 'Cosmétique', pct: 5 },
    { cat: 'Restos & sorties', pct: 5 }, { cat: 'Dons', pct: 2 }, { cat: 'Amis & Famille', pct: 3 }, { cat: 'Divertissement', pct: 2 }
  ],
  epargne: [
    { cat: 'Épargne', pct: 15 }, { cat: 'Investissements', pct: 5 }
  ]
};
function renderBudget() {
  if ($('bud-revenu').value === '' && budgetData.revenu_mensuel) $('bud-revenu').value = budgetData.revenu_mensuel;
  if ($('bud-especes') && document.activeElement !== $('bud-especes'))
    $('bud-especes').value = (budgetData.sub_budget && budgetData.sub_budget._especes) || ''; // 💵 poche espèces du mois
  if (budgetData.pct_charges) $('bud-pct-charges').value = budgetData.pct_charges;
  if (budgetData.pct_plaisir) $('bud-pct-plaisir').value = budgetData.pct_plaisir;
  if (budgetData.pct_epargne) $('bud-pct-epargne').value = budgetData.pct_epargne;

  // Sélecteurs mois / année
  if ($('budget-month-select') && $('budget-month-select').options.length === 0)
    $('budget-month-select').innerHTML = MONTHS.map((m, i) => `<option value="${i}">${m}</option>`).join('');
  if ($('budget-year-select') && $('budget-year-select').options.length === 0) {
    const yNow = new Date().getFullYear(); let opts = '';
    for (let y = yNow + 1; y >= 2023; y--) opts += `<option value="${y}">${y}</option>`;
    $('budget-year-select').innerHTML = opts;
  }
  if ($('budget-month-select')) $('budget-month-select').value = budgetMonth;
  if ($('budget-year-select')) $('budget-year-select').value = budgetYear;
  // Bouton « copier le mois précédent » : visible si le mois affiché est vierge et que le précédent a un budget
  const _pd = new Date(budgetYear, budgetMonth - 1, 1);
  const _prevKey = `${_pd.getFullYear()}-${String(_pd.getMonth() + 1).padStart(2, '0')}`;
  const _copyBtn = $('budget-copy-prev');
  if (_copyBtn) _copyBtn.style.display = (budgetByMonth[_prevKey] && !budgetByMonth[budgetKey()]) ? '' : 'none';
  const _delBtn = $('budget-delete');
  if (_delBtn) _delBtn.style.display = budgetByMonth[budgetKey()] ? '' : 'none';

  const rev = parseFloat($('bud-revenu').value) || 0;
  budgetData.revenu_mensuel = rev;
  if ($('bud-pct-imprevus')) $('bud-pct-imprevus').value = budgetData.pct_imprevus || 0;
  renderBudgetStatus('budget-alert-page', false, budgetKey());
  renderBudgetEvents();
  renderRecurring();
  const c = budgetData.pct_charges;
  const p = budgetData.pct_plaisir;
  const e = budgetData.pct_epargne;
  const im = budgetData.pct_imprevus || 0;
  const total = c + p + e + im;
  $('bud-total-pct').textContent = total + '%';
  $('bud-total-pct').style.color = total === 100 ? 'var(--sage)' : '#E53935';
  $('bud-total-pct').style.fontWeight = '900';
  $('bud-total-pct').style.fontSize = total !== 100 ? '18px' : '';

  const revCharges = Math.round(rev * c / 100);
  const revPlaisir = Math.round(rev * p / 100);
  const revEpargne = Math.round(rev * e / 100);
  const revImprevus = Math.round(rev * im / 100);

  $('bud-breakdown').innerHTML = `
    <div class="bud-breakdown-item charges">
      <div class="bud-breakdown-title">🏠 Charges & Nécessités (${c}%)</div>
      <div class="bud-breakdown-val">${fmt(revCharges)}</div>
      <div class="bud-breakdown-sub">Loyer, factures, alimentation, transport, santé</div>
    </div>
    <div class="bud-breakdown-item plaisir">
      <div class="bud-breakdown-title">🌸 Plaisir & Envies (${p}%)</div>
      <div class="bud-breakdown-val">${fmt(revPlaisir)}</div>
      <div class="bud-breakdown-sub">Sorties, mode, cosmétique, loisirs, abonnements</div>
    </div>
    ${im > 0 ? `<div class="bud-breakdown-item" style="border-left-color:#E8A317">
      <div class="bud-breakdown-title" style="color:#B7791F">⚡ Imprévus (${im}%)</div>
      <div class="bud-breakdown-val">${fmt(revImprevus)}</div>
      <div class="bud-breakdown-sub">Ta réserve pour les coups durs / dépenses non prévues</div>
    </div>` : ''}
    <div class="bud-breakdown-item epargne">
      <div class="bud-breakdown-title">🌱 Épargne & Investissement (${e}%)</div>
      <div class="bud-breakdown-val">${fmt(revEpargne)}</div>
      <div class="bud-breakdown-sub">Livret A, PEA, dîme, objectifs perso</div>
    </div>
  `;

  renderRealBlocks();

  // ─── BLOCAGE si total ≠ 100% ──────────────
  if (total !== 100) {
    $('bud-suggestions').innerHTML = `
      <div style="padding:24px;text-align:center;background:linear-gradient(135deg,#FFE5E5,#FFEDE5);border:2px dashed #E53935;border-radius:var(--radius);color:#C62828">
        <div style="font-size:28px;margin-bottom:8px">⚠️</div>
        <div style="font-weight:800;font-size:16px;margin-bottom:6px">Total = ${total}% (au lieu de 100%)</div>
        <div style="font-size:13px">Ajuste tes 3 curseurs (Charges + Plaisir + Épargne) pour arriver exactement à <b>100%</b>.<br>Les sous-catégories apparaîtront ensuite pour que tu puisses répartir plus finement.</div>
      </div>`;
    return;
  }

  // ─── Sous-catégories ÉDITABLES (modèle par défaut = DEFAULT_SUB_PCT, défini au niveau module) ─────────────

  // Répartition fine du mois affiché (propre à chaque mois)
  let userSubBudget = budgetData.sub_budget || null;
  // Sécurité : la Dîme n'est plus une épargne (c'est un don) → la déplacer vers Charges si d'anciennes données la contiennent
  if (userSubBudget && Array.isArray(userSubBudget.epargne)) {
    const di = userSubBudget.epargne.findIndex(it => it.cat === 'Dîme');
    if (di >= 0) {
      const dime = userSubBudget.epargne.splice(di, 1)[0];
      userSubBudget.charges = userSubBudget.charges || [];
      if (!userSubBudget.charges.some(it => it.cat === 'Dîme')) userSubBudget.charges.push(dime);
    }
  }
  const subBudget = userSubBudget || DEFAULT_SUB_PCT;

  // Rendu par bloc
  const renderBloc = (blocKey, blocLabel, blocPct, blocColor) => {
    const items = subBudget[blocKey] || [];
    const blocAmt = Math.round(rev * blocPct / 100);
    const totalBlocPct = items.reduce((s, it) => s + Number(it.pct || 0), 0);
    const totalBlocAmt = Math.round(rev * totalBlocPct / 100);
    const blocOK = totalBlocPct === blocPct;
    return `
      <div class="bud-sub-bloc" style="border-left:4px solid ${blocColor};padding-left:14px;margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="font-weight:800;color:${blocColor};font-size:14px">${blocLabel} — cible ${blocPct}% (${fmt(blocAmt)})</div>
          <div style="font-size:12px;font-weight:700;color:${blocOK ? 'var(--sage)' : '#E53935'}">
            Alloué : ${totalBlocPct}% ${blocOK ? '✓' : '⚠'}
          </div>
        </div>
        ${!blocOK ? `<div style="font-size:11px;color:#B7791F;background:rgba(232,184,77,0.16);padding:7px 10px;border-radius:8px;margin-bottom:10px;line-height:1.5">⚠ Ta répartition détaillée fait <b>${totalBlocPct}%</b> (${fmt(totalBlocAmt)}) alors que ta cible ${blocLabel.replace(/^[^ ]+ /, '').toLowerCase()} est <b>${blocPct}%</b> (${fmt(blocAmt)}). Ajuste les % ci-dessous pour retomber sur ${blocPct}%, ou modifie ta cible en haut de page.</div>` : ''}
        ${items.map((it, i) => {
          const amt = Math.round(rev * it.pct / 100);
          const _done = catStat(it.cat).done;
          const dkey = `${blocKey}-${i}`;
          const open = _openSubDetails.has(dkey);
          const subs = it.subs || [];
          const subTotalPct = subs.reduce((s, x) => s + Number(x.pct || 0), 0);
          const subOver = subTotalPct > Number(it.pct) + 0.001;
          const subColor = subOver ? '#E53935' : (Math.abs(subTotalPct - Number(it.pct)) < 0.01 && subs.length ? 'var(--sage)' : 'var(--muted)');
          return `
            <div class="bud-sub-row${_done ? ' done' : ''}">
              <div class="bud-sub-cat" onclick="toggleSubDetail('${blocKey}',${i})" style="cursor:pointer" title="Voir / remplir les postes de dépense">
                <span style="width:8px;height:8px;border-radius:50%;background:${catColor(it.cat)};display:inline-block"></span>
                ${catIcon(it.cat)} ${esc(it.cat)} <span style="color:var(--muted);font-size:10px">${open ? '▾' : '▸'}</span>${subs.length ? ` <span style="font-size:10px;color:${subColor}">(${subs.length})</span>` : ''}${it.note ? ` <span style="color:var(--muted);font-size:11px">${esc(it.note)}</span>` : ''}
              </div>
              <input type="number" step="0.5" min="0" max="100" class="bud-sub-inp" value="${it.pct}"
                     onchange="updateSubBudget('${blocKey}',${i},this.value)">
              <span style="font-size:11px;color:var(--muted)">%</span>
              <div class="bud-sub-amt" style="display:flex;align-items:center;gap:4px;justify-content:flex-end">
                <input type="number" min="0" step="1" value="${amt}" title="Entre un montant en € — le % se calcule tout seul"
                       onchange="updateSubBudgetAmount('${blocKey}',${i},this.value)"
                       style="width:58px;padding:6px 8px;border:1.5px solid var(--border);border-radius:6px;text-align:right;font-weight:700;font-family:var(--fm);background:white;color:var(--ink)">
                <span style="font-size:11px;color:var(--muted)">€</span>
              </div>
              <input type="checkbox" class="bud-sub-check" ${_done ? 'checked' : ''} onchange="toggleCatDone('${esc(it.cat)}')" title="Coche quand c'est payé / réglé ✓ (partagé avec le détail du poste)" aria-label="Marquer comme payé">
              <button class="bud-sub-del" onclick="deleteSubBudgetLine('${blocKey}',${i})" title="Supprimer cette ligne">🗑</button>
            </div>
            <div id="subdetail-${blocKey}-${i}" style="display:${open ? '' : 'none'};margin:2px 0 12px 22px;padding:10px 12px;background:var(--bg);border-radius:10px">
              <div style="font-size:11px;color:var(--muted);margin-bottom:8px">Postes de « ${esc(it.cat)} » — la somme doit tenir dans <b>${it.pct}%</b> (${fmt(amt)})</div>
              <datalist id="subdl-${blocKey}-${i}">${subcatDatalist(it.cat)}</datalist>
              ${subs.map((sc, j) => {
                const sAmt = Math.round(rev * (sc.pct || 0) / 100);
                const nItems = Array.isArray(sc.items) ? sc.items.length : 0;
                return `<div style="display:grid;grid-template-columns:minmax(0,1fr) 52px auto 62px auto 20px 22px;gap:5px;align-items:center;margin-bottom:6px${sc.done ? ';opacity:.5' : ''}">
                  <input class="inp" list="subdl-${blocKey}-${i}" value="${esc(sc.name || '')}" onchange="renameSubcatBudget('${blocKey}',${i},${j},this.value)" placeholder="Ex: ${esc((SUBCATS[it.cat] || []).slice(0, 3).join(', ') || 'un poste')}…" style="padding:5px 8px;font-size:12px;min-width:0">
                  <input type="number" min="0" step="0.5" value="${sc.pct || 0}" class="bud-sub-inp" onchange="updateSubcatBudget('${blocKey}',${i},${j},this.value)" style="padding:5px 6px">
                  <span style="font-size:11px;color:var(--muted)">%</span>
                  <div style="display:flex;align-items:center;gap:2px">
                    <input type="number" min="0" step="1" value="${sAmt}" title="Montant en € — le % se calcule tout seul" onchange="updateSubcatBudgetAmount('${blocKey}',${i},${j},this.value)" style="width:44px;padding:5px 5px;border:1.5px solid var(--border);border-radius:6px;text-align:right;font-weight:700;font-family:var(--fm);background:white;color:var(--ink)">
                    <span style="font-size:11px;color:var(--muted)">€</span>
                  </div>
                  <button type="button" onclick="openPosteItems('${blocKey}',${i},${j})" title="Ouvrir le détail (sous-postes)" style="background:var(--rose-soft);border:1px solid var(--rose);color:var(--rose);border-radius:6px;padding:4px 5px;font-size:11px;font-family:var(--fm);cursor:pointer;white-space:nowrap">▾${nItems ? nItems : ''}</button>
                  <input type="checkbox" class="bud-sub-check" ${sc.done ? 'checked' : ''} onchange="toggleSubcatDone('${blocKey}',${i},${j})" title="Cocher quand c'est validé / payé ✓">
                  <button class="bud-sub-del" onclick="deleteSubcatBudget('${blocKey}',${i},${j})" title="Supprimer">🗑</button>
                </div>`;
              }).join('')}
              <button class="btn-ghost" style="padding:4px 10px;font-size:12px;margin-top:2px" onclick="addSubcatBudget('${blocKey}',${i})">+ Ajouter un poste</button>
              <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px;font-weight:700;border-top:1px solid var(--border-soft);padding-top:6px">
                <span>Total postes</span>
                <span style="color:${subColor}">${subTotalPct}% / ${it.pct}%${subOver ? ' ⚠ dépasse !' : (subs.length && Math.abs(subTotalPct - Number(it.pct)) < 0.01 ? ' ✓' : '')}</span>
              </div>
            </div>`;
        }).join('')}
        <div class="bud-sub-total">
          <span>Total ${blocLabel}</span>
          <b style="color:${blocOK ? 'var(--sage)' : '#E53935'}">${totalBlocPct}%</b>
          <b>${fmt(totalBlocAmt)}</b>
        </div>
      </div>`;
  };

  const _im = budgetData.pct_imprevus || 0;
  const grandTotalPct = ['charges','plaisir','epargne'].reduce((s, k) =>
    s + (subBudget[k] || []).reduce((ss, it) => ss + Number(it.pct || 0), 0), 0) + _im;
  const grandTotalAmt = Math.round(rev * grandTotalPct / 100);

  $('bud-suggestions').innerHTML = `
    <div style="margin-bottom:14px;font-size:12px;color:var(--muted)">
      Modifie chaque % ci-dessous pour ajuster ta répartition fine. Le total de chaque bloc doit correspondre à ta cible.
    </div>
    ${renderBloc('charges', '🏠 Charges', c, '#DD7B85')}
    ${renderBloc('plaisir', '🌸 Plaisir', p, '#F4A993')}
    ${_im > 0 ? `<div class="bud-sub-bloc" style="border-left:4px solid #E8A317;padding-left:14px;margin-bottom:20px">
      <div style="font-weight:800;color:#B7791F;font-size:14px">⚡ Imprévus — ${_im}% (${fmt(Math.round(rev * _im / 100))})</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">Une seule catégorie « Imprévus ». Ajuste son % avec le curseur en haut.</div>
    </div>` : ''}
    ${renderBloc('epargne', '🌱 Épargne', e, '#7FB89E')}
    <div class="bud-grand-total">
      <span>TOTAL GÉNÉRAL</span>
      <span style="color:${grandTotalPct === 100 ? 'var(--sage)' : '#E53935'};font-weight:900">${grandTotalPct}%</span>
      <span style="font-weight:900">${fmt(grandTotalAmt)}</span>
    </div>
    <button class="btn-primary" onmousedown="event.preventDefault()" onclick="saveSubBudgetManual()" style="width:100%;margin-top:16px;padding:12px;font-size:15px">💾 Sauvegarder ma répartition</button>`;
}

// Bouton « Sauvegarder ma répartition » : valide la saisie en cours + confirme (les % sont déjà persistés à chaque modif)
function saveSubBudgetManual() {
  const el = document.activeElement;
  if (el && el.classList && el.classList.contains('bud-sub-inp')) el.dispatchEvent(new Event('change'));
  saveBudgetPrepNow();
  toast('✓ Répartition enregistrée', 'success');
}
function updateSubBudget(blocKey, index, newPct) {
  try {
    let subBudget = budgetData.sub_budget;
    if (!subBudget) subBudget = JSON.parse(JSON.stringify(DEFAULT_SUB_PCT));
    subBudget[blocKey][index].pct = Math.round(Math.max(0, parseFloat(newPct) || 0) * 10) / 10;
    budgetData.sub_budget = subBudget;
    saveBudgetPrep();          // enregistre dans budget_mensuel (mois affiché)
    renderBudget();
  } catch (e) { console.error(e); }
}

// ─── 3e niveau : postes de dépense d'une catégorie (doivent tenir dans le % de la catégorie) ───
let _openSubDetails = new Set();
function _budItem(blocKey, i) {
  const sub = _ensureSubBudget();
  return (sub[blocKey] && sub[blocKey][i]) ? sub[blocKey][i] : null;
}
function toggleSubDetail(blocKey, i) {
  const key = `${blocKey}-${i}`;
  const el = $(`subdetail-${blocKey}-${i}`);
  if (_openSubDetails.has(key)) { _openSubDetails.delete(key); if (el) el.style.display = 'none'; }
  else { _openSubDetails.add(key); if (el) el.style.display = ''; }
  // maj de la flèche ▸/▾
  renderBudget();
}
function addSubcatBudget(blocKey, i) {
  const it = _budItem(blocKey, i); if (!it) return;
  it.subs = it.subs || [];
  it.subs.push({ name: '', pct: 0 });
  _openSubDetails.add(`${blocKey}-${i}`);
  saveBudgetPrep(); renderBudget();
}
function updateSubcatBudget(blocKey, i, j, pct) {
  const it = _budItem(blocKey, i); if (!it || !it.subs || !it.subs[j]) return;
  it.subs[j].pct = Math.round(Math.max(0, parseFloat(pct) || 0) * 10) / 10;
  _openSubDetails.add(`${blocKey}-${i}`);
  saveBudgetPrep(); renderBudget();
}
// Saisie du MONTANT en € sur un poste → convertit en % automatiquement
function updateSubcatBudgetAmount(blocKey, i, j, amount) {
  const rev = budgetData.revenu_mensuel || 0;
  if (!rev) { toast('Renseigne d\'abord ton revenu mensuel', 'error'); renderBudget(); return; }
  const amt = Math.max(0, parseFloat(amount) || 0);
  const pct = Math.round(amt / rev * 1000) / 10;
  updateSubcatBudget(blocKey, i, j, pct);
}
function renameSubcatBudget(blocKey, i, j, name) {
  const it = _budItem(blocKey, i); if (!it || !it.subs || !it.subs[j]) return;
  it.subs[j].name = (name || '').trim();
  _openSubDetails.add(`${blocKey}-${i}`);
  saveBudgetPrep(); renderBudget();
}
function deleteSubcatBudget(blocKey, i, j) {
  const it = _budItem(blocKey, i); if (!it || !it.subs || !it.subs[j]) return;
  const nm = it.subs[j].name || 'ce poste';
  confirmDelete(`Supprimer le poste « ${esc(nm)} » ?`, () => {
    it.subs.splice(j, 1);
    _openSubDetails.add(`${blocKey}-${i}`);
    saveBudgetPrep(); renderBudget();
  });
}
// Coche/décoche un poste comme « validé / acheté » (par mois)
function toggleSubcatDone(blocKey, i, j) {
  const it = _budItem(blocKey, i); if (!it || !it.subs || !it.subs[j]) return;
  it.subs[j].done = !it.subs[j].done;
  _openSubDetails.add(`${blocKey}-${i}`);
  saveBudgetPrep(); renderBudget();
  if (typeof _navRefresh === 'function') _navRefresh();
}

// ─── 4e niveau : détail d'un poste (sous-postes) dans un pop-up ───
let _posteCtx = null;
function openPosteItems(bk, i, j) { _posteCtx = { bk, i, j }; renderPosteItems(); $('poste-modal').style.display = 'flex'; }
function closePosteItems() { const m = $('poste-modal'); if (m) m.style.display = 'none'; _posteCtx = null; }
function _posteObj() {
  if (!_posteCtx) return null;
  const it = _budItem(_posteCtx.bk, _posteCtx.i);
  return (it && it.subs && it.subs[_posteCtx.j]) ? it.subs[_posteCtx.j] : null;
}
function renderPosteItems() {
  const sc = _posteObj(); if (!sc) { closePosteItems(); return; }
  const rev = budgetData.revenu_mensuel || 0;
  const cat = (_budItem(_posteCtx.bk, _posteCtx.i) || {}).cat || '';
  sc.items = sc.items || [];
  const posteAmt = Math.round(rev * (sc.pct || 0) / 100);
  const itemsTotal = Math.round(sc.items.reduce((s, x) => s + Number(x.pct || 0), 0) * 10) / 10;
  const over = itemsTotal > Number(sc.pct) + 0.001;
  const okColor = over ? '#E53935' : (sc.items.length && Math.abs(itemsTotal - Number(sc.pct)) < 0.01 ? 'var(--sage)' : 'var(--muted)');
  set('poste-modal-title', `📂 ${sc.name || 'Poste'}`);
  set('poste-modal-sub', `Répartis en détail — doit tenir dans ${sc.pct || 0}% (${fmt(posteAmt)})`);
  const list = $('poste-modal-list');
  list.innerHTML = `<datalist id="poste-items-dl">${subcatDatalist(cat)}</datalist>`
    + (sc.items.length ? sc.items.map((x, k) => {
      const a = Math.round(rev * (x.pct || 0) / 100);
      return `<div style="display:grid;grid-template-columns:minmax(0,1fr) 50px auto 66px 20px 22px;gap:6px;align-items:center;margin-bottom:8px${x.done ? ';opacity:.5' : ''}">
        <input class="inp" list="poste-items-dl" value="${esc(x.name || '')}" onchange="renamePosteItem(${k},this.value)" placeholder="Ex: Produit ménager, Corps…" style="padding:6px 8px;font-size:13px;min-width:0">
        <input type="number" min="0" step="0.5" value="${x.pct || 0}" class="bud-sub-inp" onchange="updatePosteItemPct(${k},this.value)">
        <span style="font-size:11px;color:var(--muted)">%</span>
        <div style="display:flex;align-items:center;gap:2px;justify-content:flex-end">
          <input type="number" min="0" step="1" value="${a}" title="Montant en € — le % se calcule tout seul" onchange="updatePosteItemAmount(${k},this.value)" style="width:48px;padding:5px 5px;border:1.5px solid var(--border);border-radius:6px;text-align:right;font-weight:700;font-family:var(--fm);background:white;color:var(--ink)">
          <span style="font-size:11px;color:var(--muted)">€</span>
        </div>
        <input type="checkbox" class="bud-sub-check" ${x.done ? 'checked' : ''} onchange="togglePosteItemDone(${k})" title="Cocher quand c'est payé ✓">
        <button class="bud-sub-del" onclick="deletePosteItem(${k})" title="Supprimer">🗑</button>
      </div>`;
    }).join('') : '<div class="empty-sub" style="padding:8px 0">Aucun sous-poste. Ajoute-en un.</div>')
    + `<button class="btn-ghost" style="padding:5px 12px;font-size:13px;margin-top:4px" onclick="addPosteItem()">+ Ajouter un sous-poste</button>
       <div style="display:flex;justify-content:space-between;margin-top:12px;font-size:13px;font-weight:700;border-top:1px solid var(--border-soft);padding-top:8px">
         <span>Total réparti</span><span style="color:${okColor}">${itemsTotal}% / ${sc.pct || 0}%${over ? ' ⚠ dépasse !' : (sc.items.length && Math.abs(itemsTotal - Number(sc.pct)) < 0.01 ? ' ✓' : '')}</span>
       </div>`;
}
function _posteSave() { saveBudgetPrep(); renderPosteItems(); if (typeof renderBudget === 'function') renderBudget(); }
function addPosteItem() { const sc = _posteObj(); if (!sc) return; sc.items = sc.items || []; sc.items.push({ name: '', pct: 0 }); _posteSave(); }
function updatePosteItemPct(k, v) { const sc = _posteObj(); if (!sc || !sc.items || !sc.items[k]) return; sc.items[k].pct = Math.round(Math.max(0, parseFloat(v) || 0) * 10) / 10; _posteSave(); }
function updatePosteItemAmount(k, v) {
  const rev = budgetData.revenu_mensuel || 0;
  if (!rev) { toast('Renseigne d\'abord ton revenu mensuel', 'error'); renderPosteItems(); return; }
  const amt = Math.max(0, parseFloat(v) || 0);
  updatePosteItemPct(k, Math.round(amt / rev * 1000) / 10);
}
function renamePosteItem(k, v) { const sc = _posteObj(); if (!sc || !sc.items || !sc.items[k]) return; sc.items[k].name = (v || '').trim(); _posteSave(); }
function deletePosteItem(k) { const sc = _posteObj(); if (!sc || !sc.items || !sc.items[k]) return; const nm = sc.items[k].name || 'ce sous-poste'; confirmDelete(`Supprimer « ${esc(nm)} » ?`, () => { sc.items.splice(k, 1); _posteSave(); }); }
function togglePosteItemDone(k) { const sc = _posteObj(); if (!sc || !sc.items || !sc.items[k]) return; sc.items[k].done = !sc.items[k].done; _posteSave(); }
// Supprime une ligne de la répartition détaillée (ex : fusionner « restos » dans Alimentation)
function deleteSubBudgetLine(blocKey, index) {
  let subBudget = budgetData.sub_budget;
  if (!subBudget) subBudget = JSON.parse(JSON.stringify(DEFAULT_SUB_PCT));
  if (!subBudget[blocKey] || !subBudget[blocKey][index]) return;
  const removed = subBudget[blocKey][index];
  confirmDelete(`Supprimer la ligne « ${esc(removed.cat)}${removed.note ? ' ' + esc(removed.note) : ''} » (et son détail) ?`, () => {
    try {
      subBudget[blocKey].splice(index, 1);
      budgetData.sub_budget = subBudget;
      saveBudgetPrep();
      renderBudget();
      toast('✓ Ligne supprimée', 'success');
    } catch (e) { console.error(e); }
  });
}
// Coche/décoche une ligne comme « payé / réglé » (pense-bête mensuel, sauvegardé avec le budget du mois)
function toggleSubBudgetDone(blocKey, index) {
  try {
    let subBudget = budgetData.sub_budget;
    if (!subBudget) subBudget = JSON.parse(JSON.stringify(DEFAULT_SUB_PCT));
    if (subBudget[blocKey] && subBudget[blocKey][index]) {
      subBudget[blocKey][index].done = !subBudget[blocKey][index].done;
      budgetData.sub_budget = subBudget;
      saveBudgetPrep();
      renderBudget();
    }
  } catch (e) { console.error(e); }
}
// Saisie du MONTANT en € → convertit en % automatiquement
function updateSubBudgetAmount(blocKey, index, newAmount) {
  const rev = budgetData.revenu_mensuel || 0;
  if (!rev) { toast('Renseigne d\'abord ton revenu mensuel', 'error'); renderBudget(); return; }
  const amt = Math.max(0, parseFloat(newAmount) || 0);
  const pct = Math.round(amt / rev * 1000) / 10; // % avec 1 décimale
  updateSubBudget(blocKey, index, pct);
}

// ═══ INVESTISSEMENTS ═══════════════════════════════════════════
function renderInvestissements() {
  const totInv = investissements.reduce((s, i) => s + Number(i.montant_investi || 0), 0);
  const totVal = investissements.reduce((s, i) => s + Number(i.valeur_actuelle || 0), 0);
  const perf = totInv > 0 ? ((totVal - totInv) / totInv * 100) : 0;
  set('inv-total-inv', fmt(totInv));
  set('inv-total-val', fmt(totVal));
  const perfEl = $('inv-perf');
  perfEl.textContent = (perf >= 0 ? '+' : '') + perf.toFixed(1) + '%';
  perfEl.style.color = perf >= 0 ? 'var(--sage)' : 'var(--tender-rose)';
  set('inv-perf-hint', totVal - totInv >= 0 ? '+' + fmt(totVal - totInv) : fmt(totVal - totInv));

  const list = $('inv-list');
  if (!investissements.length) {
    list.innerHTML = '<div class="empty"><div class="empty-emoji">📈</div><div class="empty-title">Aucun investissement</div><div class="empty-sub">Ajoute ton premier placement pour commencer</div></div>';
    return;
  }
  list.innerHTML = investissements.map(inv => {
    const gain = Number(inv.valeur_actuelle || 0) - Number(inv.montant_investi || 0);
    const gainPct = inv.montant_investi > 0 ? (gain / inv.montant_investi * 100).toFixed(1) : '0';
    const posClass = gain >= 0 ? 'up' : 'down';
    const posSign = gain >= 0 ? '+' : '';
    return `
      <div class="inv-card" style="border-left-color:${inv.couleur || 'var(--sage)'}">
        <div class="inv-card-hd">
          <div>
            <div class="inv-card-title">📈 ${esc(inv.nom)}</div>
            <div class="inv-card-type">${esc(inv.type)}</div>
          </div>
          <div>
            <span class="inv-perf-badge ${posClass}">${posSign}${gainPct}% (${posSign}${fmt(gain)})</span>
          </div>
        </div>
        <div class="inv-card-body">
          <div class="inv-card-cell"><div class="inv-card-lbl">Investi</div><div class="inv-card-val">${fmt(inv.montant_investi || 0)}</div></div>
          <div class="inv-card-cell"><div class="inv-card-lbl">Valeur actuelle</div><div class="inv-card-val">${fmt(inv.valeur_actuelle || 0)}</div></div>
          <div class="inv-card-cell"><div class="inv-card-lbl">Ouverture</div><div class="inv-card-val" style="font-size:14px">${inv.date_ouverture ? new Date(inv.date_ouverture).toLocaleDateString('fr-FR') : '—'}</div></div>
        </div>
        <div class="inv-actions">
          <button class="btn-ghost" onclick="editInvest('${inv.id}')">✏️ Modifier</button>
          <button class="btn-ghost" onclick="deleteInvest('${inv.id}')" style="color:var(--tender-rose);border-color:var(--tender-rose-soft)">🗑️ Supprimer</button>
        </div>
      </div>
    `;
  }).join('');
}

function openInvestForm(inv) {
  const isEdit = !!inv;
  openModal(
    isEdit ? '✏️ Modifier investissement' : '📈 Nouvel investissement',
    'Renseigne les infos de ton placement',
    async () => {
      const nom = $('inv-form-nom').value.trim();
      const type = $('inv-form-type').value;
      const invested = parseFloat($('inv-form-invested').value) || 0;
      const current = parseFloat($('inv-form-current').value) || 0;
      const date = $('inv-form-date').value || null;
      if (!nom) { toast('Nom requis', 'error'); return false; }
      const payload = {
        user_id: currentUser.id,
        nom,
        type,
        montant_investi: invested,
        valeur_actuelle: current,
        date_ouverture: date
      };
      let error;
      if (isEdit) {
        ({ error } = await sb.from('investissements').update(payload).eq('id', inv.id));
      } else {
        ({ error } = await sb.from('investissements').insert(payload));
      }
      if (error) {
        console.error('investissements', error);
        toast('Erreur : ' + error.message, 'error');
        return false;
      }
      await loadInvestissements();
      renderInvestissements();
      toast(isEdit ? 'Mis à jour !' : 'Ajouté !', 'success');
    },
    `
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="auth-field"><label>Nom</label><input class="inp" id="inv-form-nom" value="${inv?.nom || ''}" placeholder="Ex: PEA Bourso"></div>
        <div class="auth-field"><label>Type</label>
          <select class="select" id="inv-form-type">
            <option value="PEA" ${inv?.type === 'PEA' ? 'selected' : ''}>PEA</option>
            <option value="Trading 212" ${inv?.type === 'Trading 212' ? 'selected' : ''}>Trading 212</option>
            <option value="Livret A" ${inv?.type === 'Livret A' ? 'selected' : ''}>Livret A</option>
            <option value="LDDS" ${inv?.type === 'LDDS' ? 'selected' : ''}>LDDS</option>
            <option value="Assurance vie" ${inv?.type === 'Assurance vie' ? 'selected' : ''}>Assurance vie</option>
            <option value="Crypto" ${inv?.type === 'Crypto' ? 'selected' : ''}>Crypto</option>
            <option value="Autre" ${inv?.type === 'Autre' ? 'selected' : ''}>Autre</option>
          </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="auth-field"><label>Montant investi (€)</label><input class="inp" type="number" step="0.01" id="inv-form-invested" value="${inv?.montant_investi || ''}" placeholder="0"></div>
          <div class="auth-field"><label>Valeur actuelle (€)</label><input class="inp" type="number" step="0.01" id="inv-form-current" value="${inv?.valeur_actuelle || ''}" placeholder="0"></div>
        </div>
        <div class="auth-field"><label>Date d'ouverture</label><input class="inp" type="date" id="inv-form-date" value="${inv?.date_ouverture || ''}"></div>
      </div>
    `
  );
}
function editInvest(id) {
  const inv = investissements.find(i => i.id === id);
  if (inv) openInvestForm(inv);
}
async function deleteInvest(id) {
  openModal('Supprimer', 'Supprimer cet investissement ?', async () => {
    if (!(await dbGuard(sb.from('investissements').delete().eq('id', id))).ok) return;
    await loadInvestissements();
    renderInvestissements();
    toast('Supprimé', 'success');
  });
}

// ═══ FAB ═══════════════════════════════════════════════════════
function quickAddOpen() {
  showTab('calendar');
  if (!selectedDay) selectDay(new Date().toISOString().slice(0, 10));
  $('qa-label').focus();
}

// ═══════════════════════════════════════════════════════════════
// 🤖 IA — Chatbot budgétaire + Conseils Analyse (via Edge Function « monie-ai »)
//    La clé API vit côté serveur ; ici on n'envoie qu'un CONTEXTE AGRÉGÉ.
// ═══════════════════════════════════════════════════════════════
let aiChatMsgs = [];      // historique de la conversation en cours
let aiBusy = false;

// Construit un résumé chiffré et compact des finances (jamais le relevé brut).
function buildAIContext(opts = {}) {
  if (!Array.isArray(transactions) || !transactions.length) return "Aucune transaction enregistrée pour l'instant.";
  const sIn = a => a.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.amount), 0);
  const sOut = a => a.filter(t => t.type === 'sortie').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const sEp = a => a.filter(t => t.type === 'epargne').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const L = [];

  // ── Périmètre EXACT choisi par l'utilisatrice (plus de biais « mois en cours ») ──
  const period = opts.periodType || 'all';
  let scope, label;
  if (period === 'month' && opts.month) {
    scope = transactions.filter(t => t.date_op.startsWith(opts.month));
    label = `${MONTHS[parseInt(opts.month.slice(5, 7)) - 1]} ${opts.month.slice(0, 4)}`;
  } else if (period === 'year' && opts.year) {
    scope = transactions.filter(t => t.date_op.startsWith(String(opts.year)));
    label = `année ${opts.year}`;
  } else {
    scope = transactions.slice();
    label = 'TOUTES les années confondues';
  }
  L.push(`PÉRIODE ANALYSÉE (à respecter strictement) : ${label}.`);
  if (!scope.length) return `Aucune transaction sur la période demandée (${label}).`;

  const nMonths = new Set(scope.map(t => t.date_op.slice(0, 7))).size || 1;
  const tin = sIn(scope), tout = sOut(scope), tep = sEp(scope);
  L.push(`Totaux sur la période : revenus ${Math.round(tin)}€, dépenses ${Math.round(tout)}€, épargne ${Math.round(tep)}€, sur ${nMonths} mois (~${Math.round(tout / nMonths)}€ de dépenses/mois). Taux d'épargne ${tin > 0 ? Math.round(tep / tin * 100) : 0}%.`);

  // Familles ciblées (facultatif)
  const fams = Array.isArray(opts.families) && opts.families.length ? opts.families : null;
  const inFam = c => !fams || fams.includes(BUDGET_BLOCK[c]);
  if (fams) L.push('FOCUS demandé sur les familles : ' + fams.map(f => FAMILY_LABEL[f] || f).join(', ') + '.');

  // Dépenses par catégorie (filtrées par familles si demandé)
  const catTot = {};
  scope.filter(t => t.type === 'sortie' && inFam(t.category)).forEach(t => { catTot[t.category] = (catTot[t.category] || 0) + Math.abs(Number(t.amount)); });
  const top = Object.entries(catTot).sort((a, b) => b[1] - a[1]).slice(0, 12);
  if (top.length) L.push('Dépenses par catégorie : ' + top.map(([c, v]) => `${c} ${Math.round(v)}€ (~${Math.round(v / nMonths)}€/mois)`).join(', ') + '.');

  // Répartition par famille
  const famTot = { charges: 0, plaisir: 0, imprevus: 0 };
  scope.filter(t => t.type === 'sortie').forEach(t => { const b = txBlock(t); if (famTot[b] !== undefined) famTot[b] += Math.abs(Number(t.amount)); else famTot.charges += Math.abs(Number(t.amount)); });
  L.push(`Répartition dépenses par famille : Charges ${Math.round(famTot.charges)}€, Plaisir ${Math.round(famTot.plaisir)}€, Imprévus ${Math.round(famTot.imprevus)}€ ; Épargne ${Math.round(tep)}€.`);

  // Ventilation temporelle selon la période
  if (period === 'all') {
    const years = [...new Set(scope.map(t => t.date_op.slice(0, 4)))].sort();
    L.push('Par année : ' + years.map(y => { const yt = scope.filter(t => t.date_op.startsWith(y)); return `${y} → dépenses ${Math.round(sOut(yt))}€, épargne ${Math.round(sEp(yt))}€`; }).join(' · ') + '.');
  } else if (period === 'year') {
    const parMois = [];
    for (let m = 0; m < 12; m++) { const k = `${opts.year}-${String(m + 1).padStart(2, '0')}`; const mt = scope.filter(t => t.date_op.startsWith(k)); if (mt.length) parMois.push(`${MONTHS_SHORT[m]} ${Math.round(sOut(mt))}€`); }
    if (parMois.length) L.push('Dépenses par mois : ' + parMois.join(', ') + '.');
  }

  // Détail MOIS PAR MOIS sur TOUT l'historique (permet de comparer 2 mois de 2 années différentes)
  const allMonths = period === 'all' ? [...new Set(transactions.map(t => t.date_op.slice(0, 7)))].sort().slice(-48) : [];
  if (allMonths.length) {
    const perMonth = allMonths.map(mk => {
      const mt = transactions.filter(t => t.date_op.startsWith(mk));
      return `${mk} (rev ${Math.round(sIn(mt))} / dép ${Math.round(sOut(mt))} / ép ${Math.round(sEp(mt))})`;
    });
    L.push("Historique mois par mois (revenus / dépenses / épargne, en €) — utilise-le pour toute comparaison entre mois/années : " + perMonth.join(' · ') + '.');
  }

  // Objectifs d'épargne (toujours utile)
  if (Array.isArray(goalsList) && goalsList.length) {
    const act = goalsList.filter(g => g.statut === 'en_cours');
    if (act.length) L.push("Objectifs d'épargne en cours : " + act.map(g => `${g.nom} ${Math.round(g.deja_epargne || 0)}/${Math.round(g.cible || 0)}€`).join(', ') + '.');
  }

  if (opts.focus) L.push("QUESTION PRÉCISE DE L'UTILISATRICE : " + opts.focus);
  return L.join('\n');
}

// Appel générique à l'Edge Function
async function callMonieAI(messages, mode, contextOpts) {
  const context = buildAIContext(contextOpts || {});
  const { data, error } = await sb.functions.invoke('monie-ai', { body: { messages, mode, context } });
  if (error) {
    // message d'erreur exploitable (fonction non déployée, etc.)
    let msg = 'IA indisponible.';
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch (e) {}
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data?.reply || '(réponse vide)';
}

// ─── Widget de chat flottant (présent sur toutes les pages) ───
function toggleAIChat(force) {
  const panel = $('ai-chat-panel');
  if (!panel) return;
  const open = force !== undefined ? force : panel.style.display === 'none' || !panel.style.display;
  panel.style.display = open ? 'flex' : 'none';
  if (open) {
    if (!aiChatMsgs.length) renderAIChat(); // affiche le message d'accueil
    setTimeout(() => { const i = $('ai-chat-input'); if (i) i.focus(); }, 50);
  }
}

function renderAIChat() {
  const box = $('ai-chat-msgs');
  if (!box) return;
  if (!aiChatMsgs.length) {
    box.innerHTML = `<div class="ai-msg ai-msg-bot">Coucou ! 🌸 Je suis Monie, ta conseillère budget. Pose-moi une question sur tes dépenses, ton épargne, ton budget… Ex : « Où est-ce que je dépense le plus ? » ou « Comment épargner 200€/mois ? »</div>`;
    return;
  }
  box.innerHTML = aiChatMsgs.map(m => `<div class="ai-msg ai-msg-${m.role === 'user' ? 'me' : 'bot'}">${aiFmt(m.content)}</div>`).join('') +
    (aiBusy ? `<div class="ai-msg ai-msg-bot ai-typing">Monie réfléchit…</div>` : '');
  box.scrollTop = box.scrollHeight;
}

// Rend le markdown léger (gras + retours ligne) de façon sûre (échappe le HTML)
function aiFmt(txt) {
  let s = esc(String(txt));
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/\n/g, '<br>');
  return s;
}

async function sendAIChat() {
  const inp = $('ai-chat-input');
  if (!inp) return;
  const text = inp.value.trim();
  if (!text || aiBusy) return;
  inp.value = '';
  aiChatMsgs.push({ role: 'user', content: text });
  aiBusy = true;
  renderAIChat();
  try {
    const reply = await callMonieAI(aiChatMsgs, 'chat');
    aiChatMsgs.push({ role: 'assistant', content: reply });
  } catch (e) {
    aiChatMsgs.push({ role: 'assistant', content: '⚠️ ' + (e.message || 'IA indisponible') + '\n\n(As-tu déployé la fonction « monie-ai » et configuré la clé ?)' });
  } finally {
    aiBusy = false;
    renderAIChat();
  }
}
function onAIChatKey(ev) { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); sendAIChat(); } }

// ─── Conseils IA : on POSE D'ABORD les questions (période, familles, focus) → PUIS on requête ───
function runAIConseils() {
  const years = [...new Set(transactions.map(t => t.date_op.slice(0, 4)))].sort().reverse();
  const months = [...new Set(transactions.map(t => t.date_op.slice(0, 7)))].sort().reverse().slice(0, 12);
  const periodOpts = '<option value="all">🌍 Toutes les années confondues</option>'
    + years.map(y => `<option value="year:${y}">Année ${y}</option>`).join('')
    + months.map(m => `<option value="month:${m}">${MONTHS[parseInt(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}</option>`).join('');
  const famChecks = [['charges', '🏠 Charges'], ['plaisir', '🌸 Plaisir'], ['imprevus', '⚡ Imprévus'], ['epargne', '🌱 Épargne']]
    .map(([k, l]) => `<label style="display:inline-flex;align-items:center;gap:5px;margin:0 12px 6px 0;font-size:13px;cursor:pointer"><input type="checkbox" class="ai-fam" value="${k}"> ${l}</label>`).join('');
  const body = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="auth-field"><label>📅 Période à analyser</label>
        <select class="select" id="ai-period" style="width:100%">${periodOpts}</select></div>
      <div class="auth-field"><label>🎯 Familles à cibler <span style="font-weight:400;color:var(--muted);font-size:11px">— aucune cochée = tout</span></label>
        <div style="display:flex;flex-wrap:wrap">${famChecks}</div></div>
      <div class="auth-field"><label>💬 Ta question / ce que tu veux savoir <span style="font-weight:400;color:var(--muted);font-size:11px">(facultatif)</span></label>
        <input class="inp" id="ai-focus" placeholder="Ex: où puis-je réduire ? comment atteindre mes objectifs ?" style="width:100%"></div>
      <div style="font-size:11px;color:var(--muted);background:var(--peach-soft);padding:8px 10px;border-radius:8px;line-height:1.5">⚡ En cliquant sur <b>OK</b>, une requête est envoyée à l'IA (consomme des tokens). <b>Rien n'est envoyé tant que tu n'as pas validé.</b></div>
    </div>`;
  openModal('🤖 Analyse IA — que veux-tu analyser ?', 'Choisis la période et le focus avant de lancer.', () => {
    const pv = ($('ai-period') && $('ai-period').value) || 'all';
    const opts = {};
    if (pv.startsWith('year:')) { opts.periodType = 'year'; opts.year = pv.slice(5); }
    else if (pv.startsWith('month:')) { opts.periodType = 'month'; opts.month = pv.slice(6); }
    else opts.periodType = 'all';
    opts.families = [...document.querySelectorAll('.ai-fam:checked')].map(x => x.value);
    opts.focus = ($('ai-focus') && $('ai-focus').value || '').trim();
    _launchAIConseils(opts);
  }, body);
  // Pré-sélectionne la période du filtre de la page si c'est une année précise
  const ySel = $('analyse-year');
  if (ySel && ySel.value && ySel.value !== '-1' && $('ai-period')) $('ai-period').value = 'year:' + ySel.value;
}
async function _launchAIConseils(opts) {
  const out = $('ai-conseils-out');
  const btn = $('ai-conseils-btn');
  if (!out || aiBusy) return;
  aiBusy = true;
  if (btn) { btn.disabled = true; btn.textContent = '🤖 Analyse en cours…'; }
  const hint = $('ai-conseils-hint'); if (hint) hint.style.display = 'none';
  out.style.display = 'block';
  out.innerHTML = '<div class="ai-msg ai-msg-bot ai-typing">Monie analyse tes chiffres…</div>';
  try {
    const q = opts.focus ? opts.focus : "Analyse ma situation financière sur la période choisie et donne-moi un bilan personnalisé et des conseils concrets.";
    const reply = await callMonieAI([{ role: 'user', content: q }], 'conseils', opts);
    out.innerHTML = `<div class="ai-conseils-card">${aiFmt(reply)}</div>`;
  } catch (e) {
    out.innerHTML = `<div class="ai-msg ai-msg-bot">⚠️ ${esc(e.message || 'IA indisponible')}<br><br><small>Vérifie que la fonction « monie-ai » est déployée sur Supabase et que la clé ANTHROPIC_API_KEY est configurée.</small></div>`;
  } finally {
    aiBusy = false;
    if (btn) { btn.disabled = false; btn.textContent = '🤖 Relancer l\'analyse IA'; }
  }
}

// ═══ 🔍 RECHERCHE GLOBALE (⌘K / Ctrl+K) ═══
function openSearch() {
  const m = $('search-modal'); if (!m) return;
  m.style.display = 'flex';
  const inp = $('search-input');
  if (inp) { inp.value = ''; setTimeout(() => inp.focus(), 50); }
  const box = $('search-results');
  if (box) box.innerHTML = '<div class="empty-sub" style="padding:16px;text-align:center">Tape pour chercher dans toutes tes opérations (libellé, catégorie, sous-catégorie, montant).</div>';
}
function closeSearch() { const m = $('search-modal'); if (m) m.style.display = 'none'; }
function doGlobalSearch() {
  const q = ($('search-input').value || '').trim().toLowerCase();
  const box = $('search-results');
  if (!box) return;
  if (!q) { box.innerHTML = '<div class="empty-sub" style="padding:16px;text-align:center">Tape pour chercher…</div>'; return; }
  const num = parseFloat(q.replace(',', '.'));
  const res = transactions.filter(t => {
    if (t.label && t.label.toLowerCase().includes(q)) return true;
    if (t.category && t.category.toLowerCase().includes(q)) return true;
    if (t.sub_category && t.sub_category.toLowerCase().includes(q)) return true;
    if (!isNaN(num) && num > 0 && Math.abs(Math.abs(Number(t.amount)) - num) < 0.005) return true;
    return false;
  }).slice(0, 40);
  if (!res.length) { box.innerHTML = '<div class="empty-sub" style="padding:16px;text-align:center">Aucun résultat.</div>'; return; }
  box.innerHTML = `<div style="font-size:11px;color:var(--muted);margin:0 4px 8px">${res.length} résultat(s)</div>` + res.map(t => {
    const sign = t.type === 'entree' ? '+' : (t.type === 'epargne' ? '' : '-');
    const cls = t.type === 'entree' ? 'amt-in' : (t.type === 'epargne' ? 'amt-save' : 'amt-out');
    return `<div class="day-tx-item" style="cursor:pointer" onclick="closeSearch();openTxEdit('${t.id}')" title="Modifier">
      <div class="day-tx-icon" style="background:${catColor(t.category)}18;color:${catColor(t.category)}">${catIcon(t.category)}</div>
      <div class="day-tx-info"><div class="tx-label">${esc(t.label)}</div><div class="tx-cat">${t.date_op} · ${esc(t.category || '')}${t.sub_category ? ' · ' + esc(t.sub_category) : ''}${t.sub_sub_category ? ' · ' + esc(t.sub_sub_category) : ''}</div></div>
      <div class="day-tx-amt ${cls}">${sign}${fmtD(Math.abs(Number(t.amount)))}</div>
    </div>`;
  }).join('');
}
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); openSearch(); }
  else if (e.key === 'Escape') { const m = $('search-modal'); if (m && m.style.display !== 'none') closeSearch(); const g = $('glossary-modal'); if (g && g.style.display !== 'none') closeGlossary(); const pm = $('poste-modal'); if (pm && pm.style.display !== 'none') closePosteItems(); }
});

// ═══ 🤝 REMBOURSEMENTS · 📦 ENVELOPPES · 💳 DETTES ═══
async function addRemboursement() {
  const tiers = ($('remb-tiers').value || '').trim();
  const montant = parseFloat($('remb-montant').value) || 0;
  const sens = $('remb-sens').value;
  const motif = ($('remb-motif').value || '').trim() || null;
  if (!tiers || montant <= 0) { toast('Un nom et un montant, s\'il te plaît', 'error'); return; }
  const r = await dbGuard(sb.from('remboursements').insert({ user_id: currentUser.id, tiers, montant, sens, motif }).select(), 'Ajout impossible (as-tu lancé le SQL-V317 ?)');
  if (!r.ok) return;
  if (r.data && r.data[0]) remboursementsList.unshift(r.data[0]);
  $('remb-tiers').value = ''; $('remb-montant').value = ''; $('remb-motif').value = '';
  renderRemboursements();
  toast('✓ Remboursement ajouté', 'success');
}
async function settleRemboursement(id) {
  const r = await dbGuard(sb.from('remboursements').update({ statut: 'regle' }).eq('id', id), 'Maj impossible');
  if (!r.ok) return;
  const e = remboursementsList.find(x => x.id === id); if (e) e.statut = 'regle';
  renderRemboursements(); toast('✓ Marqué réglé', 'success');
}
function deleteRemboursement(id) {
  const e = remboursementsList.find(x => x.id === id);
  confirmDelete(`Supprimer le remboursement${e ? ` « ${esc(e.tiers)} · ${fmt(e.montant)} »` : ''} ?`, async () => {
    const r = await dbGuard(sb.from('remboursements').delete().eq('id', id), 'Suppression impossible');
    if (!r.ok) return;
    remboursementsList = remboursementsList.filter(x => x.id !== id);
    renderRemboursements();
    toast('✓ Supprimé', 'success');
  });
}
// Repère les prêts dans les transactions (sous-catégorie « Prêt ») → qui te doit, sans re-saisie
function _autoPrets() {
  const norm = s => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const isPret = t => { const s = (t.sub_category || '').toLowerCase(); return s.includes('prêt') || s.includes('pret'); };
  const byPerson = {};
  transactions.filter(t => t.type === 'sortie' && isPret(t)).forEach(t => {
    const k = norm(t.label) || '?';
    if (!byPerson[k]) byPerson[k] = { name: t.label || 'Prêt', total: 0, n: 0, last: t.date_op };
    byPerson[k].total += Math.abs(Number(t.amount));
    byPerson[k].n++;
    if (t.date_op > byPerson[k].last) byPerson[k].last = t.date_op;
  });
  return Object.values(byPerson).sort((a, b) => b.total - a.total);
}
function renderRemboursements() {
  const el = $('remb-list'); if (!el) return;
  const pend = remboursementsList.filter(r => r.statut !== 'regle');
  const meDoit = pend.filter(r => r.sens === 'on_me_doit').reduce((s, r) => s + Number(r.montant), 0);
  const jeDois = pend.filter(r => r.sens === 'je_dois').reduce((s, r) => s + Number(r.montant), 0);
  const prets = _autoPrets();
  const pretTotal = prets.reduce((s, p) => s + p.total, 0);
  // Bloc auto : prêts repérés dans tes transactions (sous-catégorie « Prêt »)
  const autoHtml = prets.length ? `<div style="background:var(--sage-soft);border-radius:12px;padding:12px 14px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-weight:700;font-size:13px">🔎 Prêts repérés — on te doit <b style="color:var(--sage)">${fmt(Math.round(pretTotal))}</b></div>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px">Détectés automatiquement dans tes transactions (sous-catégorie « Prêt »). Aucune saisie à refaire.</div>
      ${prets.map(p => `<div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:4px 0">
        <span>💸 ${esc(p.name)}${p.n > 1 ? ` <span style="color:var(--muted);font-size:11px">×${p.n}</span>` : ''} <span style="color:var(--muted);font-size:11px">· ${p.last}</span></span>
        <b style="font-family:var(--fm);color:var(--sage)">${fmt(Math.round(p.total))}</b>
      </div>`).join('')}
    </div>` : '';
  if (!remboursementsList.length && !prets.length) { el.innerHTML = '<div class="empty-sub">Rien pour l\'instant. Ajoute ce qu\'on te doit (ou ce que tu dois), ou tague une transaction en sous-catégorie « Prêt ».</div>'; return; }
  if (!remboursementsList.length) { el.innerHTML = autoHtml; return; }
  el.innerHTML = autoHtml + `<div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:130px;background:var(--sage-soft);border-radius:10px;padding:10px 12px"><div style="font-size:11px;color:var(--muted)">On te doit (saisi)</div><div style="font-family:var(--fm);font-weight:800;color:var(--sage)">${fmt(meDoit)}</div></div>
      <div style="flex:1;min-width:130px;background:var(--tender-rose-soft);border-radius:10px;padding:10px 12px"><div style="font-size:11px;color:var(--muted)">Tu dois</div><div style="font-family:var(--fm);font-weight:800;color:var(--tender-rose)">${fmt(jeDois)}</div></div>
    </div>` + remboursementsList.map(r => {
    const reg = r.statut === 'regle';
    return `<div class="day-tx-item" style="${reg ? 'opacity:.5' : ''}">
      <div class="day-tx-icon" style="background:${r.sens === 'on_me_doit' ? 'var(--sage-soft)' : 'var(--tender-rose-soft)'};color:${r.sens === 'on_me_doit' ? 'var(--sage)' : 'var(--tender-rose)'}">${r.sens === 'on_me_doit' ? '↩️' : '➡️'}</div>
      <div class="day-tx-info"><div class="tx-label">${esc(r.tiers)}${r.motif ? ' · ' + esc(r.motif) : ''}</div><div class="tx-cat">${r.sens === 'on_me_doit' ? 'te doit' : 'tu dois'}${reg ? ' · réglé ✓' : ''}</div></div>
      <div class="day-tx-amt" style="font-family:var(--fm);font-weight:700">${fmt(r.montant)}</div>
      ${reg ? '' : `<button class="goal-btn" onclick="settleRemboursement('${r.id}')" title="Marquer réglé">✓</button>`}
      <button class="goal-btn danger" onclick="deleteRemboursement('${r.id}')" title="Supprimer">🗑</button>
    </div>`;
  }).join('');
}

function openEnveloppeForm(existing) {
  const e = existing || {};
  openModal(existing ? 'Modifier l\'enveloppe' : 'Nouvelle enveloppe', 'Une cagnotte que tu remplis mois après mois.', async () => {
    const nom = ($('env-nom').value || '').trim();
    const emoji = ($('env-emoji').value || '📦').trim() || '📦';
    const objectif = parseFloat($('env-obj').value) || 0;
    const mensuel = parseFloat($('env-mensuel').value) || 0;
    if (!nom) { toast('Un nom, s\'il te plaît', 'error'); return false; }
    const payload = { user_id: currentUser.id, nom, emoji, objectif, mensuel };
    let res;
    if (e.id) res = await dbGuard(sb.from('enveloppes').update(payload).eq('id', e.id).select(), 'Maj impossible');
    else res = await dbGuard(sb.from('enveloppes').insert(payload).select(), 'Ajout impossible (SQL-V317 lancé ?)');
    if (!res.ok) return false;
    await loadExtra(); renderEnveloppes(); toast('✓ Enregistré', 'success');
  }, `<div style="display:flex;flex-direction:column;gap:10px">
    <div style="display:flex;gap:8px"><input class="inp" id="env-emoji" value="${esc(e.emoji || '📦')}" style="width:56px;text-align:center"><input class="inp" id="env-nom" value="${esc(e.nom || '')}" placeholder="Ex: Noël, Vacances, Impôts" style="flex:1"></div>
    <div class="auth-field"><label>Objectif (€, facultatif)</label><input class="inp" id="env-obj" type="number" step="1" value="${e.objectif || ''}"></div>
    <div class="auth-field"><label>Je mets chaque mois (€)</label><input class="inp" id="env-mensuel" type="number" step="1" value="${e.mensuel || ''}"></div>
  </div>`);
}
async function addToEnveloppe(id, montant) {
  const e = enveloppesList.find(x => x.id === id); if (!e) return;
  const nv = Number(e.actuel || 0) + montant;
  const r = await dbGuard(sb.from('enveloppes').update({ actuel: nv }).eq('id', id), 'Maj impossible');
  if (!r.ok) return;
  e.actuel = nv; renderEnveloppes();
}
async function deleteEnveloppe(id) {
  openModal('Supprimer l\'enveloppe ?', '', async () => {
    const r = await dbGuard(sb.from('enveloppes').delete().eq('id', id), 'Suppression impossible');
    if (!r.ok) return;
    enveloppesList = enveloppesList.filter(x => x.id !== id); renderEnveloppes(); toast('✓ Supprimée', 'success');
  });
}
function renderEnveloppes() {
  const el = $('env-list'); if (!el) return;
  if (!enveloppesList.length) { el.innerHTML = '<div class="empty-sub">Crée une enveloppe pour provisionner tes dépenses futures (cadeaux, vacances…).</div>'; return; }
  el.innerHTML = enveloppesList.map(e => {
    const pct = e.objectif > 0 ? Math.min(100, Math.round(e.actuel / e.objectif * 100)) : 0;
    return `<div style="padding:12px 0;border-bottom:1px solid var(--border-soft)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <span style="font-size:20px">${esc(e.emoji || '📦')}</span>
        <div style="flex:1"><b>${esc(e.nom)}</b>${e.mensuel > 0 ? ` <span style="font-size:11px;color:var(--muted)">· ${fmt(e.mensuel)}/mois</span>` : ''}</div>
        <div style="font-family:var(--fm);font-weight:800">${fmt(e.actuel || 0)}${e.objectif > 0 ? ` <span style="color:var(--muted);font-weight:600">/ ${fmt(e.objectif)}</span>` : ''}</div>
      </div>
      ${e.objectif > 0 ? `<div style="height:6px;background:var(--border-soft);border-radius:100px;overflow:hidden;margin-bottom:6px"><div style="height:100%;width:${pct}%;background:var(--sage);border-radius:100px"></div></div>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${e.mensuel > 0 ? `<button class="goal-btn" onclick="addToEnveloppe('${e.id}', ${Number(e.mensuel)})">+ ${fmt(e.mensuel)} (mois)</button>` : ''}
        <button class="goal-btn" onclick="addToEnveloppe('${e.id}', 10)">+10</button>
        <button class="goal-btn" onclick="openEnveloppeForm(enveloppesList.find(x=>x.id==='${e.id}'))">✏️</button>
        <button class="goal-btn danger" onclick="deleteEnveloppe('${e.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function openDetteForm(existing) {
  const d = existing || {};
  openModal(existing ? 'Modifier la dette' : 'Nouvelle dette / échelonné', 'Suis où tu en es dans ton remboursement.', async () => {
    const nom = ($('dette-nom').value || '').trim();
    const total = parseFloat($('dette-total').value) || 0;
    const mensualite = parseFloat($('dette-mens').value) || 0;
    const deja = parseFloat($('dette-deja').value) || 0;
    if (!nom || total <= 0) { toast('Un nom et un montant total', 'error'); return false; }
    const payload = { user_id: currentUser.id, nom, montant_total: total, mensualite, deja_paye: deja };
    let res;
    if (d.id) res = await dbGuard(sb.from('dettes').update(payload).eq('id', d.id).select(), 'Maj impossible');
    else res = await dbGuard(sb.from('dettes').insert(payload).select(), 'Ajout impossible (SQL-V317 lancé ?)');
    if (!res.ok) return false;
    await loadExtra(); renderDettes(); toast('✓ Enregistré', 'success');
  }, `<div style="display:flex;flex-direction:column;gap:10px">
    <div class="auth-field"><label>Nom</label><input class="inp" id="dette-nom" value="${esc(d.nom || '')}" placeholder="Ex: Klarna canapé, Prêt"></div>
    <div class="auth-field"><label>Montant total (€)</label><input class="inp" id="dette-total" type="number" step="1" value="${d.montant_total || ''}"></div>
    <div class="auth-field"><label>Mensualité (€)</label><input class="inp" id="dette-mens" type="number" step="1" value="${d.mensualite || ''}"></div>
    <div class="auth-field"><label>Déjà payé (€)</label><input class="inp" id="dette-deja" type="number" step="1" value="${d.deja_paye || 0}"></div>
  </div>`);
}
async function payDette(id) {
  const d = dettesList.find(x => x.id === id); if (!d) return;
  const nv = Math.min(Number(d.montant_total), Number(d.deja_paye || 0) + Number(d.mensualite || 0));
  const r = await dbGuard(sb.from('dettes').update({ deja_paye: nv }).eq('id', id), 'Maj impossible');
  if (!r.ok) return;
  d.deja_paye = nv; renderDettes();
  if (nv >= Number(d.montant_total)) { toast('🎉 Dette remboursée, bravo !', 'success'); _confettiBurst(); }
}
async function deleteDette(id) {
  openModal('Supprimer cette dette ?', '', async () => {
    const r = await dbGuard(sb.from('dettes').delete().eq('id', id), 'Suppression impossible');
    if (!r.ok) return;
    dettesList = dettesList.filter(x => x.id !== id); renderDettes(); toast('✓ Supprimée', 'success');
  });
}
// Petit graphique en cercle (donut) : part payée vs restante
function _donutSVG(done, total, size = 60, color = 'var(--gold)') {
  const r = size / 2 - 5, c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, done / total) : 0;
  const off = c * (1 - pct);
  const cx = size / 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="flex-shrink:0">
    <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="var(--border-soft)" stroke-width="6"/>
    <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 ${cx} ${cx})"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-size="${Math.round(size * 0.26)}" font-weight="800" fill="var(--ink)" font-family="var(--fm)">${Math.round(pct * 100)}%</text>
  </svg>`;
}
function renderDettes() {
  const el = $('dette-list'); if (!el) return;
  // 🔎 Auto : paiements échelonnés repérés dans tes transactions (Klarna, Scalapay, catégorie « Paiement échelonné »)
  const echTx = transactions.filter(t => t.type === 'sortie' && t.category === 'Paiement échelonné');
  const echPaid = echTx.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  let autoBanner = '';
  if (echTx.length) {
    autoBanner = `<div style="background:rgba(183,156,214,0.12);border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:12px;line-height:1.5">
      🔎 J'ai repéré <b>${echTx.length} paiement(s)</b> en catégorie « Paiement échelonné » dans tes transactions (<b>${fmt(Math.round(echPaid))}</b> déjà débités).
      Crée un plan ci-dessous avec le <b>montant total</b> pour voir ce qu'il te reste à payer.</div>`;
  }
  if (!dettesList.length) {
    el.innerHTML = autoBanner + '<div class="empty-sub">Ajoute un paiement en plusieurs fois (ou un prêt) avec « + Nouvelle » pour suivre total / payé / reste.</div>';
    return;
  }
  // Résumé global — UNIQUEMENT s'il y a plusieurs plans (sinon c'est un doublon avec la seule ligne)
  const gTotal = dettesList.reduce((s, d) => s + Number(d.montant_total || 0), 0);
  const gPaid = dettesList.reduce((s, d) => s + Number(d.deja_paye || 0), 0);
  const gReste = Math.max(0, gTotal - gPaid);
  const summary = dettesList.length > 1 ? `<div style="display:flex;align-items:center;gap:14px;background:var(--bg);border-radius:12px;padding:12px 14px;margin-bottom:14px">
      ${_donutSVG(gPaid, gTotal, 64, 'var(--plum)')}
      <div style="display:flex;gap:16px;flex-wrap:wrap;flex:1">
        <div><div style="font-size:11px;color:var(--muted)">Total déjà payé</div><div style="font-family:var(--fm);font-weight:800;color:var(--sage)">${fmt(Math.round(gPaid))}</div></div>
        <div><div style="font-size:11px;color:var(--muted)">Total reste à payer</div><div style="font-family:var(--fm);font-weight:800;color:var(--tender-rose)">${fmt(Math.round(gReste))}</div></div>
        <div><div style="font-size:11px;color:var(--muted)">Montant total</div><div style="font-family:var(--fm);font-weight:800">${fmt(Math.round(gTotal))}</div></div>
      </div>
    </div>` : '';
  el.innerHTML = autoBanner + summary + dettesList.map(d => {
    const total = Number(d.montant_total) || 0;
    const paid = Number(d.deja_paye || 0);
    const reste = Math.max(0, total - paid);
    const nbRest = d.mensualite > 0 ? Math.ceil(reste / d.mensualite) : null;
    return `<div style="display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid var(--border-soft)">
      ${_donutSVG(paid, total, 58, reste === 0 ? 'var(--sage)' : 'var(--gold)')}
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;margin-bottom:2px">${esc(d.nom)} ${reste === 0 ? '<span style="font-size:11px;color:var(--sage)">soldé 🎉</span>' : (nbRest != null ? `<span style="font-size:11px;color:var(--muted)">· ${nbRest} × ${fmt(d.mensualite)}</span>` : '')}</div>
        <div style="font-size:12px;color:var(--muted)">Payé <b style="color:var(--sage)">${fmt(Math.round(paid))}</b> · Reste <b style="color:var(--tender-rose)">${fmt(Math.round(reste))}</b> · Total ${fmt(Math.round(total))}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
          ${reste > 0 && d.mensualite > 0 ? `<button class="goal-btn" onclick="payDette('${d.id}')">+ payer ${fmt(d.mensualite)}</button>` : ''}
          <button class="goal-btn" onclick="openDetteForm(dettesList.find(x=>x.id==='${d.id}'))">✏️</button>
          <button class="goal-btn danger" onclick="deleteDette('${d.id}')">🗑</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ═══ 🔥 GAMIFICATION (séries + badges) ═══
function renderGamification() {
  const el = $('dash-gamif'); if (!el) return;
  const now = new Date();
  let streak = 0;
  for (let i = 1; i <= 36; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const hasData = transactions.some(t => t.date_op.startsWith(k));
    if (!hasData) break;
    const ep = transactions.filter(t => t.date_op.startsWith(k) && t.type === 'epargne').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    if (ep > 0) streak++; else break;
  }
  const totalEp = transactions.filter(t => t.type === 'epargne').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const nAtteints = (goalsList || []).filter(g => g.statut === 'atteint').length;
  const nMonths = new Set(transactions.map(t => t.date_op.slice(0, 7))).size;
  const badges = [];
  if (totalEp > 0) badges.push('🌱 Épargnant·e');
  if (totalEp >= 1000) badges.push('🐷 1 000 € épargnés');
  if (totalEp >= 5000) badges.push('💰 5 000 € épargnés');
  if (nAtteints >= 1) badges.push(`🏆 ${nAtteints} objectif(s) atteint(s)`);
  if (nMonths >= 6) badges.push(`📆 ${nMonths} mois suivis`);
  if (!streak && !badges.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="card" style="margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <div style="text-align:center;min-width:96px"><div style="font-size:26px">🔥</div><div style="font-size:22px;font-weight:900;font-family:var(--fm)">${streak}</div><div style="font-size:11px;color:var(--muted)">mois d'épargne d'affilée</div></div>
      <div style="flex:1;min-width:160px;display:flex;flex-wrap:wrap;gap:6px">${badges.map(b => `<span style="background:var(--sage-soft);color:var(--sage);border-radius:100px;padding:5px 12px;font-size:12px;font-weight:600">${b}</span>`).join('') || '<span style="font-size:12px;color:var(--muted)">Mets de l\'argent de côté pour lancer ta série 🌱</span>'}</div>
    </div></div>`;
}

// ═══ ⚙️ DASHBOARD PERSONNALISABLE (masquer/afficher des blocs) ═══
const DASH_BLOCKS = [
  { id: 'dash-alerts', label: '🔔 Alertes à surveiller' },
  { id: 'dash-recap', label: '📅 Récap du mois' },
  { id: 'dash-patrimoine', label: '💎 Patrimoine' },
  { id: 'dash-gamif', label: '🔥 Séries & badges' }
];
function _getDashHidden() { try { return JSON.parse(localStorage.getItem('monie_dash_hidden') || '[]'); } catch (e) { return []; } }
function applyDashHidden() { const hid = _getDashHidden(); DASH_BLOCKS.forEach(b => { const el = $(b.id); if (el && el.dataset.forcedEmpty !== '1') el.style.display = hid.includes(b.id) ? 'none' : ''; }); }
function openDashCustomize() {
  const hid = _getDashHidden();
  const body = `<div style="display:flex;flex-direction:column;gap:10px">${DASH_BLOCKS.map(b => `<label style="display:flex;align-items:center;gap:10px;font-size:14px;cursor:pointer"><input type="checkbox" class="dash-block-tog" value="${b.id}" ${hid.includes(b.id) ? '' : 'checked'} style="width:18px;height:18px;accent-color:var(--rose)"> ${b.label}</label>`).join('')}</div>`;
  openModal('⚙️ Personnaliser le tableau de bord', 'Coche les blocs que tu veux voir apparaître.', () => {
    const shown = [...document.querySelectorAll('.dash-block-tog:checked')].map(x => x.value);
    const hidden = DASH_BLOCKS.map(b => b.id).filter(id => !shown.includes(id));
    try { localStorage.setItem('monie_dash_hidden', JSON.stringify(hidden)); } catch (e) {}
    applyDashHidden();
    toast('✓ Tableau de bord personnalisé', 'success');
  }, body);
}

// ═══ 📖 GLOSSAIRE ═══
const GLOSSARY = [
  ['Reste à dépenser', 'Ton revenu du mois − ce que tu as déjà dépensé. Ce qu\'il te reste, en théorie, pour le reste du mois.'],
  ['Reste à vivre par jour', 'Le reste à dépenser (revenu − déjà dépensé) divisé par les jours restants du mois. Combien tu peux dépenser par jour. Le « à prévoir » n\'entre PAS dans ce calcul (ce sont juste tes notes).'],
  ['Ton rythme récent', 'La moyenne de tes dépenses des 3 derniers mois, comparée à ton revenu. Une estimation indicative — pas une fatalité.'],
  ['Famille', 'Les 4 grands blocs de ton budget : 🏠 Charges (nécessités), 🌸 Plaisir (envies), 🌱 Épargne, ⚡ Imprévus. Leurs % font 100 % ensemble.'],
  ['Cible', 'Le montant que tu prévois pour une famille ou une catégorie. C\'est ton objectif de budget (le plan).'],
  ['Réparti / suggéré', 'La somme de tes sous-lignes détaillées. Idéalement, elle doit correspondre exactement à ta cible.'],
  ['Réel dépensé', 'Ce qui est vraiment sorti de ton compte (tes vraies transactions), par opposition au budget prévu.'],
  ['Catégorie', 'Le classement d\'une opération (Alimentation, Loyer, Mode…). Chaque catégorie appartient à une famille.'],
  ['Sous-catégorie', 'Une étiquette plus fine sur une transaction (ex : Banque → « Frais bancaires »). Sert à analyser en détail.'],
  ['Poste de dépense', 'Le 3ᵉ niveau de budget : dans une catégorie, tu répartis en postes (ex : Vie quotidienne → Hygiène corps, Produits ménagers…). La somme doit tenir dans le % de la catégorie.'],
  ['À prévoir', 'Un pense-bête des dépenses que tu sais devoir faire ce mois. Ce n\'est PAS déduit du reste à dépenser — juste un rappel.'],
  ['Objectif d\'épargne', 'Une cagnotte que tu remplis (+ Ajouter) et dans laquelle tu pioches dedans (− Utiliser) quand tu dépenses ce que tu as mis de côté.'],
  ['Contribuer / Ajouter', 'Mettre de l\'argent sur un objectif d\'épargne.'],
  ['Utiliser (retirer)', 'Reprendre de l\'argent d\'un objectif quand tu dépenses ce que tu avais provisionné.'],
  ['Terminé / Annulé', 'États d\'un objectif : ✅ Terminé (atteint, réactivable), 🚫 Annulé (mis de côté, grisé, réactivable).'],
  ['Taux d\'épargne', 'La part de ton revenu que tu mets de côté (épargne ÷ revenus) sur la période.'],
  ['Épargne (type)', 'Une opération qui n\'est ni une dépense ni un revenu : de l\'argent déplacé pour être mis de côté.'],
  ['Récurrents', 'Tes dépenses qui reviennent chaque mois (loyer, abonnements…). Monie les détecte automatiquement et te propose de les mettre « à prévoir ».'],
  ['Remboursements', 'Le suivi de « qui te doit de l\'argent » et « à qui tu dois » (ex : Julien te doit 183 €).'],
  ['Dettes & échelonné', 'Klarna, prêts, paiements en plusieurs fois : combien il reste, en combien de mensualités.'],
  ['Patrimoine', 'La somme de tout ce que tu possèdes : comptes courants + épargne + placements. Sa courbe montre si ça monte.'],
  ['Règles de catégorisation', 'Des règles « quand le libellé contient X → catégorie Y » que Monie applique automatiquement à tes imports et saisies.'],
  ['Alertes', 'Monie te prévient d\'une dépense inhabituelle ou d\'un dépassement de budget, sans que tu aies à chercher.'],
  ['Récap du mois', 'Un bilan personnalisé (par l\'IA) de ton mois écoulé, généré quand TU valides que le mois est complet. Archivé dans Analyse.'],
  ['Séries & badges', 'Ta motivation : nombre de mois d\'épargne d\'affilée, objectifs atteints, mois suivis…'],
  ['File à catégoriser', 'Les opérations rangées dans « Autres » (non reconnues) que tu peux reclasser rapidement.'],
  ['Moyen de paiement', 'Carte, espèces, virement, prélèvement, chèque, ticket resto — comment l\'opération a été réglée.']
];
function openGlossary() { const m = $('glossary-modal'); if (!m) return; m.style.display = 'flex'; if ($('glossary-search')) $('glossary-search').value = ''; renderGlossary(); }
function closeGlossary() { const m = $('glossary-modal'); if (m) m.style.display = 'none'; }
function renderGlossary() {
  const box = $('glossary-list'); if (!box) return;
  const q = ($('glossary-search') && $('glossary-search').value || '').trim().toLowerCase();
  const list = GLOSSARY.filter(([t, d]) => !q || t.toLowerCase().includes(q) || d.toLowerCase().includes(q))
    .sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  box.innerHTML = list.length ? list.map(([t, d]) => `<div style="padding:10px 0;border-bottom:1px solid var(--border-soft)">
    <div style="font-weight:800;font-size:14px;margin-bottom:2px">${esc(t)}</div>
    <div style="font-size:13px;color:var(--muted);line-height:1.5">${esc(d)}</div>
  </div>`).join('') : '<div class="empty-sub" style="padding:16px;text-align:center">Aucune définition ne correspond.</div>';
}
