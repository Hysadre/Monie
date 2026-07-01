// ═══════════════════════════════════════════════════════════════
// 🌸 MONIE V3 — App logic
// ═══════════════════════════════════════════════════════════════
const SUPABASE_URL = 'https://clcurpkixduhggefsilk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsY3VycGtpeGR1aGdnZWZzaWxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4ODk1NDcsImV4cCI6MjA5ODQ2NTU0N30.ngTHdm87bpFn2N1jMHw2sEwJuelLM3woO1EM1skwk6k';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = id => document.getElementById(id);
const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
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
  'Maison & Logement': { emoji: '🏡', color: '#DD7B85' },
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
  'Aide au logement': { emoji: '🏘️', color: '#7FB89E' },
  'Autres': { emoji: '📌', color: '#A0AEC0' }
};
// Métadonnées des banques source (pastilles LCL / BoursoBank)
const BANK_META = {
  'LCL':        { label: 'LCL',    color: '#0059A5', bg: '#E3EEFB' },
  'BoursoBank': { label: 'Bourso', color: '#E52A5A', bg: '#FCE4EC' },
  'Boursobank': { label: 'Bourso', color: '#E52A5A', bg: '#FCE4EC' }
};
const catIcon = c => CAT_META[c]?.emoji || '📌';
const catColor = c => CAT_META[c]?.color || '#A0AEC0';
// Petite pastille pour indiquer la banque source (LCL / BoursoBank)
function bankBadge(bs) {
  if (!bs) return '';
  const m = BANK_META[bs];
  if (!m) return '';
  return `<span class="bank-badge" style="color:${m.color};background:${m.bg}" title="Compte ${m.label}">${m.label}</span>`;
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
let budgetData = { revenu_mensuel: 0, pct_charges: 50, pct_plaisir: 30, pct_epargne: 20 };
let investissements = [];
let goalsList = [];
let contribList = [];
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
function toast(msg, type = '') {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' toast-' + type : '');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3000);
}
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
  populateYearSelect();
  populateDateSelects();
  renderCalendar();
  renderDashboard();
  populateCategorySelects();
  restoreHelpBanners();
  initHeaderAutoHide();
}

async function loadGoals() {
  const { data, error } = await sb.from('epargne_objectifs').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
  if (error) { console.error('loadGoals', error); return; }
  goalsList = data || [];
  const { data: cdata } = await sb.from('epargne_contributions').select('*').eq('user_id', currentUser.id).order('date_contrib', { ascending: false });
  contribList = cdata || [];
}

async function loadBudgetPrep() {
  const { data } = await sb.from('budget_prep').select('*').eq('user_id', currentUser.id).maybeSingle();
  if (data) budgetData = data;
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
  const rulesRes = await sb.from('merchant_rules').select('*').or(`user_id.eq.${currentUser.id},user_id.is.null`).order('priority', { ascending: false });
  rules = rulesRes.data || [];
  await loadProfile();
  console.log(`📊 ${transactions.length} transactions, ${rules.length} règles, profil chargé`);
}

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
  if (name === 'transactions') renderTransactionsList();
  if (name === 'suivi') renderSuivi();
  if (name === 'epargne') renderEpargne();
  if (name === 'annuelle') renderVueAnnuelle();
  if (name === 'budget') renderBudget();
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

async function uploadAvatar(file) {
  if (!file) return;
  if (!currentUser) return;
  if (!file.type.startsWith('image/')) { toast('Ce n\'est pas une image', 'error'); return; }
  if (file.size > 8 * 1024 * 1024) { toast('Image trop lourde (>8 Mo)', 'error'); return; }
  toast('📷 Redimensionnement…');
  try {
    const blob = await resizeImage(file, 400);
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
      await sb.from('transactions').delete().eq('user_id', currentUser.id);
      await sb.from('merchant_rules').delete().eq('user_id', currentUser.id);
      await sb.from('epargne_objectifs').delete().eq('user_id', currentUser.id);
      await sb.from('epargne_contributions').delete().eq('user_id', currentUser.id);
      await sb.from('investissements').delete().eq('user_id', currentUser.id);
      await sb.from('budget_prep').delete().eq('user_id', currentUser.id);
      await sb.from('profiles').delete().eq('user_id', currentUser.id);
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

  const buildMonthOpts = (selected) => MONTHS.map((m, i) => `<option value="${i}" ${i === selected ? 'selected' : ''}>${m}</option>`).join('');
  const buildYearOpts = (selected) => years.map(y => `<option value="${y}" ${y === selected ? 'selected' : ''}>${y}</option>`).join('');

  if ($('cal-month-select')) $('cal-month-select').innerHTML = buildMonthOpts(calMonth);
  if ($('cal-year-select')) $('cal-year-select').innerHTML = buildYearOpts(calYear);
  if ($('dash-month-select')) $('dash-month-select').innerHTML = buildMonthOpts(dashMonth);
  if ($('dash-year-select')) $('dash-year-select').innerHTML = buildYearOpts(dashYear);
  if ($('ep-month-select')) $('ep-month-select').innerHTML = buildMonthOpts(epargneMonth);
  if ($('ep-year-select')) $('ep-year-select').innerHTML = buildYearOpts(epargneYear);
  if ($('annuelle-year')) {
    $('annuelle-year').innerHTML = '';
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
      const badge = t.source === 'manual' ? '<span class="tx-source-badge badge-manual">saisi</span>' : '<span class="tx-source-badge badge-import">import</span>';
      el.innerHTML = `
        <div class="day-tx-icon" style="background:${catColor(t.category)}15;color:${catColor(t.category)}">${catIcon(t.category)}</div>
        <div class="day-tx-info">
          <div class="day-tx-label">${t.label}${badge}</div>
          <div class="day-tx-cat">${t.category}${t.sub_category ? ' · ' + t.sub_category : ''}</div>
        </div>
        <div class="day-tx-amt ${t.type === 'entree' ? 'amt-in' : 'amt-out'}">${t.type === 'entree' ? '+' : '-'}${fmtD(Math.abs(Number(t.amount)))}</div>
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
  updatePayMethodOptions();
  // Filter select
  const catsAll = Object.keys(CAT_META).sort();
  const filtCur = $('tx-filter-cat').value;
  $('tx-filter-cat').innerHTML = '<option value="all">Toutes catégories</option>' + catsAll.map(c => `<option value="${c}" ${filtCur === c ? 'selected' : ''}>${c}</option>`).join('');
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
  const methods = type === 'sortie' ? PAY_METHODS_SORTIE : PAY_METHODS_ENTREE;
  const currentValue = sel.value;
  sel.innerHTML = methods.map(m => `<option value="${m.v}">${m.l}</option>`).join('');
  // Garder la valeur si toujours possible, sinon défaut (carte pour sortie, virement pour entrée)
  if (methods.find(m => m.v === currentValue)) {
    sel.value = currentValue;
  } else {
    sel.value = type === 'sortie' ? 'carte' : 'virement';
  }
  const lbl = $('qa-paymethod-label');
  if (lbl) lbl.textContent = type === 'sortie' ? '💳 Payé avec :' : '💰 Reçu par :';
}
document.addEventListener('change', e => {
  if (e.target.matches('input[name="qa-type"]')) populateCategorySelects();
});
async function quickAddTx() {
  if (!selectedDay) { toast('Sélectionne un jour d\'abord', 'error'); return; }
  const label = $('qa-label').value.trim();
  const amount = parseFloat($('qa-amount').value);
  const type = document.querySelector('input[name="qa-type"]:checked').value;
  const category = $('qa-cat').value;
  const payMethod = $('qa-paymethod') ? $('qa-paymethod').value : null;
  if (!label || !amount || amount <= 0) { toast('Description et montant requis', 'error'); return; }
  const newTx = {
    user_id: currentUser.id,
    date_op: selectedDay,
    label: label,
    amount: type === 'entree' ? amount : -amount,
    type: type,
    category: category,
    sub_category: null,
    source: 'manual',
    merchant_key: merchantKey(label),
    payment_method: payMethod || null
  };
  const { data, error } = await sb.from('transactions').insert(newTx).select().single();
  if (error) { toast('Erreur : ' + error.message, 'error'); return; }
  transactions.unshift(data);
  $('qa-label').value = '';
  $('qa-amount').value = '';
  toast('✓ Ajouté dans le calendrier et les transactions', 'success');
  renderCalendar();
  selectDay(selectedDay);
  // Rafraîchir la vue Transactions pour que la nouvelle op y apparaisse
  if (typeof renderTransactionsList === 'function') renderTransactionsList();
  // Rafraîchir le dashboard aussi (KPIs, graphique du mois)
  if (typeof renderDashboard === 'function') renderDashboard();
}

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
function renderDashboard() {
  set('dash-month-lbl', MONTHS[dashMonth] + ' ' + dashYear);
  if ($('dash-month-select')) $('dash-month-select').value = dashMonth;
  if ($('dash-year-select')) $('dash-year-select').value = dashYear;
  const monthPrefix = `${dashYear}-${String(dashMonth + 1).padStart(2, '0')}`;
  const monthTx = transactions.filter(t => t.date_op.startsWith(monthPrefix));
  const totalIn = monthTx.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = monthTx.filter(t => t.type === 'sortie').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const bal = totalIn - totalOut;
  set('dash-rev', fmt(totalIn));
  set('dash-dep', fmt(totalOut));
  const balEl = $('dash-bal');
  balEl.textContent = (bal >= 0 ? '+' : '') + fmt(bal);
  balEl.style.color = bal >= 0 ? 'var(--sage)' : 'var(--tender-rose)';
  set('dash-bal-hint', bal >= 0 ? 'Positif ce mois' : 'Négatif ce mois');
  set('dash-count', monthTx.length);
  set('dash-rev-hint', `${monthTx.filter(t => t.type === 'entree').length} entrées`);
  set('dash-dep-hint', `${monthTx.filter(t => t.type === 'sortie').length} sorties`);

  // ═══ Performance vs M-1 ═══
  renderPerfCards(monthPrefix, totalIn, totalOut, bal);

  // ═══ Widget "Prochain objectif" ═══
  renderDashGoalWidget();

  // Évolution 12 mois : FIGÉE sur Jan-Déc de l'année sélectionnée
  const evoLabels = [];
  const evoIn = [];
  const evoOut = [];
  for (let m = 0; m < 12; m++) {
    const key = `${dashYear}-${String(m + 1).padStart(2, '0')}`;
    evoLabels.push(MONTHS_SHORT[m]);
    const mtx = transactions.filter(t => t.date_op.startsWith(key));
    evoIn.push(mtx.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.amount), 0));
    evoOut.push(mtx.filter(t => t.type === 'sortie').reduce((s, t) => s + Math.abs(Number(t.amount)), 0));
  }
  // Totaux annuels
  const yearTx = transactions.filter(t => t.date_op.startsWith(String(dashYear)));
  const yearIn = yearTx.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.amount), 0);
  const yearOut = yearTx.filter(t => t.type === 'sortie').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const yearBal = yearIn - yearOut;
  // MAJ des labels pour afficher aussi les totaux annuels
  if ($('dash-year-total-rev')) set('dash-year-total-rev', fmt(yearIn));
  if ($('dash-year-total-dep')) set('dash-year-total-dep', fmt(yearOut));
  if ($('dash-year-total-bal')) {
    const el = $('dash-year-total-bal');
    el.textContent = (yearBal >= 0 ? '+' : '') + fmt(yearBal);
    el.style.color = yearBal >= 0 ? 'var(--sage)' : 'var(--tender-rose)';
  }
  if ($('dash-year-display')) set('dash-year-display', dashYear);
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

  // Répartition catégories (mois courant)
  const catTotals = {};
  monthTx.filter(t => t.type === 'sortie').forEach(t => {
    catTotals[t.category] = (catTotals[t.category] || 0) + Math.abs(Number(t.amount));
  });
  const entries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  updateChart('chart-categories', 'doughnut', {
    labels: entries.map(e => e[0]),
    datasets: [{ data: entries.map(e => e[1]), backgroundColor: entries.map(e => catColor(e[0])), borderWidth: 0 }]
  }, { plugins: { legend: { display: false } }, cutout: '65%' });
  const leg = $('cat-legend');
  leg.innerHTML = entries.slice(0, 6).map(([cat, val]) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:12px;border-bottom:1px solid var(--border-soft)">
      <span style="width:10px;height:10px;border-radius:2px;background:${catColor(cat)}"></span>
      <span style="flex:1">${catIcon(cat)} ${cat}</span>
      <span style="font-family:var(--fm);color:var(--muted)">${fmt(val)}</span>
    </div>
  `).join('') || '<div class="empty-sub">Aucune sortie ce mois</div>';

  // Top dépenses
  const topExp = $('top-expenses');
  const sortedTx = monthTx.filter(t => t.type === 'sortie').sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 8);
  if (!sortedTx.length) {
    topExp.innerHTML = '<div class="empty"><div class="empty-title">Aucune dépense ce mois</div></div>';
  } else {
    topExp.innerHTML = sortedTx.map(t => `
      <div class="tx-row">
        <div class="tx-date">${t.date_op.slice(8)}/${t.date_op.slice(5, 7)}</div>
        <div class="tx-icon" style="background:${catColor(t.category)}15;color:${catColor(t.category)}">${catIcon(t.category)}</div>
        <div class="tx-info"><div class="tx-label">${t.label}</div><div class="tx-cat">${t.category}</div></div>
        <div class="tx-amt amt-out">-${fmtD(Math.abs(Number(t.amount)))}</div>
      </div>
    `).join('');
  }
}
function updateChart(id, type, data, opts = {}) {
  const canvas = $(id);
  if (!canvas) return;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(canvas, { type, data, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, ...opts.plugins }, ...opts } });
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

  const allFiltered = transactions.filter(t => {
    if (filtCat !== 'all' && t.category !== filtCat) return false;
    if (filtYear !== 'all' && !t.date_op.startsWith(filtYear)) return false;
    if (filtMonth !== 'all' && t.date_op.slice(5, 7) !== filtMonth) return false;
    if (filtDate && t.date_op !== filtDate) return false;
    if (search && !t.label.toLowerCase().includes(search)) return false;
    return true;
  });
  const filtered = allFiltered.slice(0, 300);
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
          <button class="bulk-btn danger" onclick="deleteTxBulkSelection()">🗑 Supprimer</button>
          <button class="bulk-btn" onclick="clearTxSelection()">Annuler</button>
        </div>
      </div>`;
  }

  if (!filtered.length) { list.innerHTML = bulkHtml + '<div class="empty"><div class="empty-title">Aucune transaction</div></div>'; return; }

  const allChecked = filtered.every(t => txSelectedIds.has(t.id));
  list.innerHTML = bulkHtml + `
    <div class="select-all-bar">
      <label>
        <input type="checkbox" class="tx-checkbox" onchange="toggleAllTxVisible(this.checked)" ${allChecked ? 'checked' : ''}>
        <span>${allChecked ? 'Tout désélectionner' : 'Tout sélectionner sur cette page'}</span>
      </label>
      ${txSelectedIds.size > 0 ? `<span style="margin-left:auto;font-weight:700;color:var(--rose)">${txSelectedIds.size} sélectionnée(s)</span>` : ''}
    </div>
    ${filtered.map(t => {
      const isSelected = txSelectedIds.has(t.id);
      const catsSel = cats.map(c => `<option value="${c}" ${t.category === c ? 'selected' : ''}>${catIcon(c)} ${c}</option>`).join('');
      return `
        <div class="tx-row ${isSelected ? 'selected' : ''}">
          <input type="checkbox" class="tx-checkbox" ${isSelected ? 'checked' : ''} onchange="toggleTxSelect('${t.id}', this.checked)">
          <div class="tx-date">${t.date_op.slice(8)}/${t.date_op.slice(5, 7)}<br><span style="font-size:10px">${t.date_op.slice(0, 4)}</span></div>
          <div class="tx-icon" style="background:${catColor(t.category)}15;color:${catColor(t.category)}">${catIcon(t.category)}</div>
          <div class="tx-info">
            <div class="tx-label">${t.label} ${bankBadge(t.bank_source)}</div>
            <select class="select" style="margin-top:4px;padding:4px 8px;font-size:11px;width:auto;min-width:180px" onchange="recategorizeTx('${t.id}', this.value)">
              ${catsSel}
            </select>
          </div>
          <div class="tx-amt ${t.type === 'entree' ? 'amt-in' : 'amt-out'}">${t.type === 'entree' ? '+' : '-'}${fmtD(Math.abs(Number(t.amount)))}</div>
          <button class="import-del-btn" onclick="deleteTx('${t.id}')" title="Supprimer">✕</button>
        </div>`;
    }).join('')}`;
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
  ['tx-filter-cat','tx-filter-year','tx-filter-month'].forEach(id => { if ($(id)) $(id).value = 'all'; });
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

async function recategorizeTx(id, newCat) {
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;
  const { error } = await sb.from('transactions').update({ category: newCat, sub_category: null }).eq('id', id);
  if (error) { toast('Erreur: ' + error.message, 'error'); return; }
  tx.category = newCat;
  tx.sub_category = null;
  toast('✓ Catégorie mise à jour', 'success');
  renderTransactionsList();
}

async function deleteTx(id) {
  openModal('Supprimer cette transaction ?', 'Cette action est irréversible.', async () => {
    const { error } = await sb.from('transactions').delete().eq('id', id);
    if (error) { toast('Erreur: ' + error.message, 'error'); return; }
    transactions = transactions.filter(t => t.id !== id);
    txSelectedIds.delete(id);
    toast('✓ Supprimée', 'success');
    renderTransactionsList();
  });
}

async function applyTxBulkCategory() {
  const newCat = $('tx-bulk-cat').value;
  if (!newCat) { toast('Choisis une catégorie', 'error'); return; }
  const ids = [...txSelectedIds];
  if (!ids.length) return;
  const { error } = await sb.from('transactions').update({ category: newCat, sub_category: null }).in('id', ids);
  if (error) { toast('Erreur: ' + error.message, 'error'); return; }
  transactions.forEach(t => { if (ids.includes(t.id)) { t.category = newCat; t.sub_category = null; } });
  toast(`✓ ${ids.length} tx catégorisées`, 'success');
  txSelectedIds.clear();
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
async function handleImportFile(file) {
  if (!file) return;
  const name = file.name.toLowerCase();
  // Reset l'état de preview pour repartir propre
  previewTab = 'todo';
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
  const lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items;
    // Grouper par ligne (y similaire)
    const rowsMap = {};
    items.forEach(it => {
      const y = Math.round(it.transform[5]);
      if (!rowsMap[y]) rowsMap[y] = [];
      rowsMap[y].push({ x: it.transform[4], text: it.str });
    });
    Object.keys(rowsMap).sort((a, b) => b - a).forEach(y => {
      const line = rowsMap[y].sort((a, b) => a.x - b.x).map(t => t.text).join(' ').trim();
      if (line) lines.push(line);
    });
  }
  // Détecte transactions : ligne avec date + montant
  const out = [];
  const amountRe = /(-?\d{1,3}(?:\s?\d{3})*(?:,\d{2}))\s*€?$/;
  const dateRe = /(\d{2})[.\/](\d{2})(?:[.\/](\d{2,4}))?/;
  const currentYear = new Date().getFullYear();
  for (const line of lines) {
    const dm = line.match(dateRe);
    const am = line.match(amountRe);
    if (dm && am) {
      let year = dm[3] || currentYear;
      if (year.length === 2) year = '20' + year;
      const date = `${year}-${dm[2]}-${dm[1]}`;
      const amtStr = am[1].replace(/\s/g, '').replace(',', '.');
      const amt = parseFloat(amtStr);
      if (isNaN(amt) || amt === 0) continue;
      let label = line.replace(am[0], '').replace(dm[0], '').trim();
      // Si le montant n'a pas de signe, on suppose négatif (dépense)
      const signedAmt = /(-|\bDEBIT\b)/i.test(line.substring(0, line.length - am[0].length)) || !line.includes('+') ? -Math.abs(amt) : amt;
      if (label.length > 3) {
        out.push({ date_op: date, label: label.substring(0, 100), amount: signedAmt, type: signedAmt > 0 ? 'entree' : 'sortie' });
      }
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
let previewTab = 'todo'; // 'todo' | 'done' | 'auto'
let previewPage = 1;
const PREVIEW_PAGE_SIZE = 50;
let preservedScroll = 0;
let selectedIndexes = new Set();
let bulkCategory = '';

function showImportPreview() {
  preservedScroll = window.scrollY;
  const wrap = $('import-preview');
  wrap.style.display = 'block';
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

  if (nDup > 0) {
    html += `<div style="margin-top:16px"><div class="card-title" style="margin-bottom:10px">🔍 Doublons potentiels détectés</div>`;
    importMatches.forEach((m, i) => {
      html += `
        <div class="match-card">
          <div class="match-tx"><span>📱 Toi : "${m.existing.label}" le ${m.existing.date_op}</span><span class="tx-amt ${m.existing.type === 'entree' ? 'amt-in' : 'amt-out'}">${m.existing.type === 'entree' ? '+' : '-'}${fmtD(Math.abs(m.existing.amount))}</span></div>
          <div class="match-tx"><span>🏦 Import : "${m.new.label}" le ${m.new.date_op}</span><span class="tx-amt ${m.new.type === 'entree' ? 'amt-in' : 'amt-out'}">${m.new.type === 'entree' ? '+' : '-'}${fmtD(Math.abs(m.new.amount))}</span></div>
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
  let filtered = previewTab === 'todo' ? todo : previewTab === 'done' ? done : auto;
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
                 value="${(t.comment || '').replace(/"/g, '&quot;')}"
                 oninput="setImportTxNote(${globalIdx}, this.value)">
        </div>` : '';
      html += `
        <div class="tx-row ${isSelected ? 'selected' : ''}" style="border-bottom:1px solid var(--border-soft)" data-tx-idx="${globalIdx}">
          <input type="checkbox" class="tx-checkbox" ${isSelected ? 'checked' : ''} onchange="toggleSelectTx(${globalIdx}, this.checked)" title="Sélectionner">
          <div class="tx-date">${t.date_op.slice(8)}/${t.date_op.slice(5, 7)}<br><span style="font-size:10px">${t.date_op.slice(0, 4)}</span></div>
          <div class="tx-icon" style="background:${catColor(t.category)}15;color:${catColor(t.category)}">${catIcon(t.category)}</div>
          <div class="tx-info">
            <div class="tx-label">${t.label} ${bankBadge(t.bank_source)}</div>
            <select class="select" style="margin-top:4px;padding:4px 8px;font-size:11px;width:auto;min-width:180px" onchange="recategorizeImportTx(${globalIdx}, this.value)">
              ${catsToShow}
            </select>
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
    const wrap = $('import-preview');
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
  $('import-preview').style.display = 'none';
  $('import-preview').innerHTML = '';
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
    source: 'import_' + (t._source || 'csv'),
    merchant_key: t.merchant_key,
    account: t.account || 'Compte courant',
    comment: t.comment || null,
    payment_method: t.payment_method || null,
    bank_source: t.bank_source || null
  }));
  if (!toAdd.length) { toast('Rien à importer', 'error'); return; }
  toast(`Import de ${toAdd.length} transactions…`);
  // Insert en batch
  const batchSize = 200;
  for (let i = 0; i < toAdd.length; i += batchSize) {
    const batch = toAdd.slice(i, i + batchSize);
    const { error } = await sb.from('transactions').insert(batch);
    if (error) { toast('Erreur : ' + error.message, 'error'); console.error(error); return; }
  }
  await loadAllData();
  cancelImport();
  toast(`✓ ${toAdd.length} transactions ajoutées`, 'success');
  showTab('calendar');
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
  for (let m = 0; m < 12; m++) {
    if (new Date(year, m, 1) > new Date(now.getFullYear(), now.getMonth() + 1, 1)) break;
    const key = `${year}-${String(m + 1).padStart(2, '0')}`;
    const r = suiviData[key] || {};
    // Auto revenus depuis transactions
    const monthTx = transactions.filter(t => t.date_op.startsWith(key));
    const autoSal = monthTx.filter(t => t.category === 'Salaire').reduce((s, t) => s + Number(t.amount), 0);
    const autoTic = monthTx.filter(t => t.category === 'Tickets restaurant').reduce((s, t) => s + Number(t.amount), 0);
    const autoRem = monthTx.filter(t => t.category === 'Remboursements').reduce((s, t) => s + Number(t.amount), 0);
    const salaire = r.salaire || autoSal || 0;
    const tickets = r.tickets_resto || autoTic || 0;
    const rembours = r.remboursements || autoRem || 0;
    const autres = r.autres_revenus || 0;
    const patTot = (r.lcl || 0) + (r.bourso || 0) + (r.especes || 0) + (r.esalia || 0) + (r.banque_postale || 0) + (r.investissements || 0) + (r.autre || 0);
    const revTot = salaire + tickets + rembours + autres;
    const autoStyle = 'style="color:var(--sage);background:var(--sage-soft);font-family:var(--fm);font-weight:600" title="Calculé auto depuis tes transactions"';
    body.innerHTML += `<tr data-month="${key}">
      <td>${MONTHS_SHORT[m]} ${year}</td>
      <td><input class="suivi-inp" type="number" step="0.01" value="${r.lcl > 0 ? r.lcl : ''}" placeholder="0" oninput="saveSuivi('${key}','lcl',this.value)"></td>
      <td><input class="suivi-inp" type="number" step="0.01" value="${r.bourso > 0 ? r.bourso : ''}" placeholder="0" oninput="saveSuivi('${key}','bourso',this.value)"></td>
      <td><input class="suivi-inp" type="number" step="0.01" value="${r.especes > 0 ? r.especes : ''}" placeholder="0" oninput="saveSuivi('${key}','especes',this.value)"></td>
      <td><input class="suivi-inp" type="number" step="0.01" value="${r.esalia > 0 ? r.esalia : ''}" placeholder="0" oninput="saveSuivi('${key}','esalia',this.value)"></td>
      <td><input class="suivi-inp" type="number" step="0.01" value="${r.banque_postale > 0 ? r.banque_postale : ''}" placeholder="0" oninput="saveSuivi('${key}','banque_postale',this.value)"></td>
      <td><input class="suivi-inp" type="number" step="0.01" value="${r.investissements > 0 ? r.investissements : ''}" placeholder="0" oninput="saveSuivi('${key}','investissements',this.value)"></td>
      <td><input class="suivi-inp" type="number" step="0.01" value="${r.autre > 0 ? r.autre : ''}" placeholder="0" oninput="saveSuivi('${key}','autre',this.value)"></td>
      <td style="font-weight:700;color:var(--rose);background:var(--rose-soft)">${patTot > 0 ? fmt(patTot) : '—'}</td>
      <td ${autoStyle}>${autoSal > 0 ? fmt(autoSal) : '—'}</td>
      <td ${autoStyle}>${autoTic > 0 ? fmt(autoTic) : '—'}</td>
      <td ${autoStyle}>${autoRem > 0 ? fmt(autoRem) : '—'}</td>
      <td><input class="suivi-inp" type="number" step="0.01" value="${autres > 0 ? autres : ''}" placeholder="0" oninput="saveSuivi('${key}','autres_revenus',this.value)"></td>
      <td style="font-weight:700;color:var(--sage);background:var(--sage-soft)">${revTot > 0 ? fmt(revTot) : '—'}</td>
      <td><input class="suivi-inp" type="number" step="0.01" value="${r.epargne_cible > 0 ? r.epargne_cible : ''}" placeholder="0" oninput="saveSuivi('${key}','epargne_cible',this.value)"></td>
      <td><input class="suivi-inp" type="number" step="0.01" value="${r.epargne_reel > 0 ? r.epargne_reel : ''}" placeholder="0" oninput="saveSuivi('${key}','epargne_reel',this.value)"></td>
    </tr>`;
  }
}
let suiviSaveTimers = {};
async function saveSuivi(key, col, val) {
  if (!suiviData[key]) suiviData[key] = { month: key + '-01' };
  suiviData[key][col] = parseFloat(val) || 0;
  clearTimeout(suiviSaveTimers[key]);
  suiviSaveTimers[key] = setTimeout(async () => {
    const payload = { user_id: currentUser.id, month: key + '-01' };
    ['lcl','bourso','especes','esalia','banque_postale','investissements','autre','salaire','tickets_resto','remboursements','autres_revenus','epargne_cible','epargne_reel'].forEach(c => {
      if (suiviData[key][c] !== undefined) payload[c] = suiviData[key][c];
    });
    await sb.from('tracker_mensuel').upsert(payload, { onConflict: 'user_id,month' });
  }, 1200);
}
async function resyncSuivi() {
  await loadSuivi();
  renderSuivi();
  toast('Sync !', 'success');
}

// ═══ ÉPARGNE ═══════════════════════════════════════════════════
function renderEpargne() {
  if ($('ep-month-select')) $('ep-month-select').value = epargneMonth;
  if ($('ep-year-select')) $('ep-year-select').value = epargneYear;
  const monthKey = `${epargneYear}-${String(epargneMonth + 1).padStart(2, '0')}`;
  const yearTx = transactions.filter(t => t.date_op.startsWith(String(epargneYear)));
  const totalIn = yearTx.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.amount), 0);

  // Contributions du mois sélectionné
  const monthContribs = contribList.filter(c => c.date_contrib && c.date_contrib.startsWith(monthKey));
  const totalMoisEpargne = monthContribs.reduce((s, c) => s + Number(c.montant), 0);

  const active = goalsList.filter(g => g.statut === 'en_cours');
  const achieved = goalsList.filter(g => g.statut === 'atteint');
  const abandoned = goalsList.filter(g => g.statut === 'abandonne');

  const totalCible = active.reduce((s, g) => s + Number(g.cible || 0), 0);
  const totalEpargne = active.reduce((s, g) => s + Number(g.deja_epargne || 0), 0);
  const reste = Math.max(0, totalCible - totalEpargne);

  set('ep-year', fmt(totalMoisEpargne));
  set('ep-year-hint', `${monthContribs.length} contribution(s) en ${MONTHS[epargneMonth]}`);
  set('ep-cible', fmt(totalCible));
  set('ep-cible-hint', `${active.length} en cours`);
  set('ep-ecart', fmt(reste));
  set('ep-ecart-hint', totalCible > 0 ? `${Math.round(totalEpargne / totalCible * 100)}% atteint total` : 'pour tout finir');
  const rate = totalIn > 0 ? Math.round(totalEpargne / totalIn * 100) : 0;
  set('ep-rate', rate + '%');

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

  const actions = isAchieved
    ? `<button class="goal-btn danger" onclick="deleteGoal('${g.id}')">🗑️ Supprimer</button>`
    : isAbandoned
      ? `<button class="goal-btn" onclick="reactivateGoal('${g.id}')">🔄 Réactiver</button>
         <button class="goal-btn danger" onclick="deleteGoal('${g.id}')">🗑️</button>`
      : `<button class="goal-btn primary" onclick="openContribForm('${g.id}')">+ Contribuer</button>
         <button class="goal-btn" onclick="editGoal('${g.id}')">✏️</button>
         ${pct >= 100 ? `<button class="goal-btn" onclick="markAchieved('${g.id}')" style="color:var(--gold);border-color:var(--gold)">🏆 Atteint !</button>` : ''}
         <button class="goal-btn" onclick="abandonGoal('${g.id}')">💤</button>
         <button class="goal-btn danger" onclick="deleteGoal('${g.id}')">🗑️</button>`;

  const dateAtteintStr = isAchieved && g.updated_at ? new Date(g.updated_at).toLocaleDateString('fr-FR') : '';

  return `
    <div class="goal-card ${isAchieved ? 'achieved' : ''} ${isAbandoned ? 'abandoned' : ''}" style="border-left-color:${g.couleur || 'var(--sage)'}">
      <div class="goal-hd">
        <div class="goal-title-block">
          <div class="goal-emoji" style="background:${g.couleur ? g.couleur + '20' : 'var(--sage-soft)'}">${g.emoji || '🎯'}</div>
          <div style="min-width:0;flex:1">
            <div class="goal-name">${g.nom}</div>
            <div class="goal-sub">
              ${isAchieved ? `🏆 Atteint le ${dateAtteintStr}` : isAbandoned ? '💤 Abandonné' : `Depuis le ${new Date(g.date_debut).toLocaleDateString('fr-FR')}`}
              ${g.note ? ' · ' + g.note : ''}
            </div>
          </div>
        </div>
        <div class="goal-actions">${actions}</div>
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
        <input class="inp" id="goal-form-nom" value="${existing?.nom || ''}" placeholder="Ex: Vacances Bali, Fonds urgence, Nouvel ordi"></div>
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
        <input class="inp" id="goal-form-note" value="${existing?.note || ''}" placeholder="Ex: pour août"></div>
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
      const newDeja = Number(g.deja_epargne || 0) + montant;
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
  await sb.from('epargne_objectifs').update({ statut: 'atteint' }).eq('id', id);
  await loadGoals();
  renderEpargne();
  toast('🏆 Bravo ! Objectif atteint !', 'success');
}

async function abandonGoal(id) {
  const g = goalsList.find(g => g.id === id);
  if (!g) return;
  openModal('Abandonner cet objectif ?', `"${g.nom}" sera déplacé dans les abandonnés. Tu pourras le réactiver plus tard.`, async () => {
    await sb.from('epargne_objectifs').update({ statut: 'abandonne' }).eq('id', id);
    await loadGoals();
    renderEpargne();
    toast('Objectif déplacé dans les abandonnés');
  });
}

async function reactivateGoal(id) {
  await sb.from('epargne_objectifs').update({ statut: 'en_cours' }).eq('id', id);
  await loadGoals();
  renderEpargne();
  toast('Objectif réactivé 🌱', 'success');
}

async function deleteGoal(id) {
  const g = goalsList.find(g => g.id === id);
  if (!g) return;
  openModal('Supprimer', `Supprimer définitivement "${g.nom}" ?`, async () => {
    await sb.from('epargne_objectifs').delete().eq('id', id);
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

  // ─── 2. Épargne du mois : transactions vers épargne + tracker_mensuel epargne_reel ───
  // Sources d'épargne : Investissements + tracker_mensuel[month].epargne_reel
  const invTx = transactions.filter(t => t.date_op.startsWith(currentKey) && t.category === 'Investissements');
  const curInvest = invTx.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const curTrackerEp = (suiviData[currentKey]?.epargne_reel) || 0;
  const curSavings = Math.max(curInvest, curTrackerEp); // prend le plus grand (évite double compte)

  const prevInvTx = transactions.filter(t => t.date_op.startsWith(prevKey) && t.category === 'Investissements');
  const prevInvest = prevInvTx.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const prevTrackerEp = (suiviData[prevKey]?.epargne_reel) || 0;
  const prevSavings = Math.max(prevInvest, prevTrackerEp);

  const savingsVal = $('perf-savings-val');
  savingsVal.textContent = fmt(curSavings);
  savingsVal.className = 'perf-val ' + (curSavings > 0 ? 'positive' : '');

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

  // Sparkline épargne : 6 derniers mois
  const sparkSav = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(dashYear, dashMonth - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const inv = transactions.filter(t => t.date_op.startsWith(key) && t.category === 'Investissements').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const tr = (suiviData[key]?.epargne_reel) || 0;
    sparkSav.push(Math.max(inv, tr));
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
const EXP_CATS = ['Loyer', 'Alimentation', 'Transport', 'Maison & Logement', 'Cosmétique', 'Mode', 'Santé', 'Administratif', 'Vie quotidienne', 'Abonnements', 'Dîme', 'Dons', 'Investissements', 'Banque', 'Impôts', 'Transactions', 'Autres'];

function renderVueAnnuelle() {
  if ($('annuelle-year')) annuelleYear = parseInt($('annuelle-year').value) || annuelleYear;
  const yearTx = transactions.filter(t => t.date_op.startsWith(String(annuelleYear)));

  // Compute par cat × mois
  const catByMonth = {};
  yearTx.forEach(t => {
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

  // Dépenses
  let totalExp = new Array(12).fill(0);
  EXP_CATS.forEach(cat => {
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
function normalizeBudgetPct(changed) {
  const c = Math.max(0, Math.min(100, parseInt($('bud-pct-charges').value) || 0));
  const p = Math.max(0, Math.min(100, parseInt($('bud-pct-plaisir').value) || 0));
  const e = Math.max(0, Math.min(100, parseInt($('bud-pct-epargne').value) || 0));
  budgetData.pct_charges = c;
  budgetData.pct_plaisir = p;
  budgetData.pct_epargne = e;
  const total = c + p + e;
  const totalEl = $('bud-total-pct');
  totalEl.textContent = total + '%';
  totalEl.style.color = total === 100 ? 'var(--sage)' : total > 100 ? 'var(--tender-rose)' : 'var(--peach)';
  renderBudget();
  saveBudgetPrep();
}

let budgetSaveTimer = null;
async function saveBudgetPrep() {
  clearTimeout(budgetSaveTimer);
  budgetSaveTimer = setTimeout(async () => {
    const rev = parseFloat($('bud-revenu').value) || 0;
    budgetData.revenu_mensuel = rev;
    await sb.from('budget_prep').upsert({
      user_id: currentUser.id,
      revenu_mensuel: budgetData.revenu_mensuel,
      pct_charges: budgetData.pct_charges,
      pct_plaisir: budgetData.pct_plaisir,
      pct_epargne: budgetData.pct_epargne
    }, { onConflict: 'user_id' });
  }, 1000);
}

function renderBudget() {
  if ($('bud-revenu').value === '' && budgetData.revenu_mensuel) $('bud-revenu').value = budgetData.revenu_mensuel;
  if (budgetData.pct_charges) $('bud-pct-charges').value = budgetData.pct_charges;
  if (budgetData.pct_plaisir) $('bud-pct-plaisir').value = budgetData.pct_plaisir;
  if (budgetData.pct_epargne) $('bud-pct-epargne').value = budgetData.pct_epargne;

  const rev = parseFloat($('bud-revenu').value) || 0;
  budgetData.revenu_mensuel = rev;
  const c = budgetData.pct_charges;
  const p = budgetData.pct_plaisir;
  const e = budgetData.pct_epargne;
  const total = c + p + e;
  $('bud-total-pct').textContent = total + '%';
  $('bud-total-pct').style.color = total === 100 ? 'var(--sage)' : '#E53935';
  $('bud-total-pct').style.fontWeight = '900';
  $('bud-total-pct').style.fontSize = total !== 100 ? '18px' : '';

  const revCharges = Math.round(rev * c / 100);
  const revPlaisir = Math.round(rev * p / 100);
  const revEpargne = Math.round(rev * e / 100);

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
    <div class="bud-breakdown-item epargne">
      <div class="bud-breakdown-title">🌱 Épargne & Investissement (${e}%)</div>
      <div class="bud-breakdown-val">${fmt(revEpargne)}</div>
      <div class="bud-breakdown-sub">Livret A, PEA, dîme, objectifs perso</div>
    </div>
  `;

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

  // ─── Sous-catégories ÉDITABLES ─────────────
  // Structure par défaut (poids relatifs pour chaque sous-catégorie)
  const DEFAULT_SUB_PCT = {
    charges: [
      { cat: 'Loyer',        pct: 30 },
      { cat: 'Alimentation', pct: 10 },
      { cat: 'Transport',    pct: 5 },
      { cat: 'Santé',        pct: 3 },
      { cat: 'Abonnements',  pct: 2 },
      { cat: 'Maison & Logement', pct: 5 },
      { cat: 'Administratif',pct: 2 }
    ],
    plaisir: [
      { cat: 'Vie quotidienne', pct: 8 },
      { cat: 'Mode',            pct: 5 },
      { cat: 'Cosmétique',      pct: 5 },
      { cat: 'Alimentation',    pct: 5, note: '(restos)' },
      { cat: 'Dons',            pct: 2 },
      { cat: 'Amis & Famille',  pct: 3 },
      { cat: 'Divertissement',  pct: 2 }
    ],
    epargne: [
      { cat: 'Dîme',           pct: 10 },
      { cat: 'Investissements',pct: 5 },
      { cat: 'Épargne libre',  pct: 5 }
    ]
  };

  // Charge les valeurs éditées depuis localStorage si dispo
  let userSubBudget;
  try { userSubBudget = JSON.parse(localStorage.getItem('monie_sub_budget') || 'null'); } catch (e) {}
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
        ${items.map((it, i) => {
          const amt = Math.round(rev * it.pct / 100);
          return `
            <div class="bud-sub-row">
              <div class="bud-sub-cat">
                <span style="width:8px;height:8px;border-radius:50%;background:${catColor(it.cat)};display:inline-block"></span>
                ${catIcon(it.cat)} ${it.cat}${it.note ? ` <span style="color:var(--muted);font-size:11px">${it.note}</span>` : ''}
              </div>
              <input type="number" step="0.5" min="0" max="100" class="bud-sub-inp" value="${it.pct}"
                     onchange="updateSubBudget('${blocKey}',${i},this.value)">
              <span style="font-size:11px;color:var(--muted)">%</span>
              <div class="bud-sub-amt">${fmt(amt)}</div>
            </div>`;
        }).join('')}
        <div class="bud-sub-total">
          <span>Total ${blocLabel}</span>
          <b style="color:${blocOK ? 'var(--sage)' : '#E53935'}">${totalBlocPct}%</b>
          <b>${fmt(totalBlocAmt)}</b>
        </div>
      </div>`;
  };

  const grandTotalPct = ['charges','plaisir','epargne'].reduce((s, k) =>
    s + (subBudget[k] || []).reduce((ss, it) => ss + Number(it.pct || 0), 0), 0);
  const grandTotalAmt = Math.round(rev * grandTotalPct / 100);

  $('bud-suggestions').innerHTML = `
    <div style="margin-bottom:14px;font-size:12px;color:var(--muted)">
      Modifie chaque % ci-dessous pour ajuster ta répartition fine. Le total de chaque bloc doit correspondre à ta cible.
    </div>
    ${renderBloc('charges', '🏠 Charges', c, '#DD7B85')}
    ${renderBloc('plaisir', '🌸 Plaisir', p, '#F4A993')}
    ${renderBloc('epargne', '🌱 Épargne', e, '#7FB89E')}
    <div class="bud-grand-total">
      <span>TOTAL GÉNÉRAL</span>
      <span style="color:${grandTotalPct === 100 ? 'var(--sage)' : '#E53935'};font-weight:900">${grandTotalPct}%</span>
      <span style="font-weight:900">${fmt(grandTotalAmt)}</span>
    </div>`;
}

function updateSubBudget(blocKey, index, newPct) {
  try {
    let subBudget = JSON.parse(localStorage.getItem('monie_sub_budget') || 'null');
    if (!subBudget) {
      // Copie les DEFAULT
      subBudget = {
        charges: [
          { cat: 'Loyer', pct: 30 }, { cat: 'Alimentation', pct: 10 }, { cat: 'Transport', pct: 5 },
          { cat: 'Santé', pct: 3 }, { cat: 'Abonnements', pct: 2 }, { cat: 'Maison & Logement', pct: 5 },
          { cat: 'Administratif', pct: 2 }
        ],
        plaisir: [
          { cat: 'Vie quotidienne', pct: 8 }, { cat: 'Mode', pct: 5 }, { cat: 'Cosmétique', pct: 5 },
          { cat: 'Alimentation', pct: 5, note: '(restos)' }, { cat: 'Dons', pct: 2 },
          { cat: 'Amis & Famille', pct: 3 }, { cat: 'Divertissement', pct: 2 }
        ],
        epargne: [
          { cat: 'Dîme', pct: 10 }, { cat: 'Investissements', pct: 5 }, { cat: 'Épargne libre', pct: 5 }
        ]
      };
    }
    subBudget[blocKey][index].pct = Math.max(0, parseFloat(newPct) || 0);
    localStorage.setItem('monie_sub_budget', JSON.stringify(subBudget));
    renderBudget();
  } catch (e) { console.error(e); }
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
            <div class="inv-card-title">📈 ${inv.nom}</div>
            <div class="inv-card-type">${inv.type}</div>
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
    await sb.from('investissements').delete().eq('id', id);
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
