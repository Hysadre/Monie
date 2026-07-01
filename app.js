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
  'Autres': { emoji: '📌', color: '#A0AEC0' }
};
const catIcon = c => CAT_META[c]?.emoji || '📌';
const catColor = c => CAT_META[c]?.color || '#A0AEC0';

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
  $('modal').classList.add('show');
}
function closeModal() {
  $('modal').classList.remove('show');
  _modalCb = null;
}
function confirmModal() {
  if (_modalCb) _modalCb();
  closeModal();
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
  populateYearSelect();
  renderCalendar();
  renderDashboard();
  populateCategorySelects();
}
async function loadAllData() {
  const [txRes, rulesRes] = await Promise.all([
    sb.from('transactions').select('*').eq('user_id', currentUser.id).order('date_op', { ascending: false }).limit(20000),
    sb.from('merchant_rules').select('*').or(`user_id.eq.${currentUser.id},user_id.is.null`).order('priority', { ascending: false })
  ]);
  transactions = txRes.data || [];
  rules = rulesRes.data || [];
  console.log(`📊 ${transactions.length} transactions, ${rules.length} règles`);
}

// ═══ TABS ══════════════════════════════════════════════════════
function showTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn, .bnav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  const el = $('tab-' + name);
  if (el) el.classList.add('active');
  if (name === 'calendar') renderCalendar();
  if (name === 'dashboard') renderDashboard();
  if (name === 'transactions') renderTransactionsList();
  if (name === 'suivi') renderSuivi();
  if (name === 'epargne') renderEpargne();
  if (name === 'import') { $('import-preview').style.display = 'none'; }
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
  // Filter select
  const catsAll = Object.keys(CAT_META).sort();
  const filtCur = $('tx-filter-cat').value;
  $('tx-filter-cat').innerHTML = '<option value="all">Toutes catégories</option>' + catsAll.map(c => `<option value="${c}" ${filtCur === c ? 'selected' : ''}>${c}</option>`).join('');
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
    merchant_key: merchantKey(label)
  };
  const { data, error } = await sb.from('transactions').insert(newTx).select().single();
  if (error) { toast('Erreur : ' + error.message, 'error'); return; }
  transactions.unshift(data);
  $('qa-label').value = '';
  $('qa-amount').value = '';
  toast('Ajouté !', 'success');
  renderCalendar();
  selectDay(selectedDay);
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

  // Évolution 12 mois se termine au mois sélectionné
  const evoLabels = [];
  const evoIn = [];
  const evoOut = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(dashYear, dashMonth - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    evoLabels.push(MONTHS_SHORT[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2));
    const mtx = transactions.filter(t => t.date_op.startsWith(key));
    evoIn.push(mtx.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.amount), 0));
    evoOut.push(mtx.filter(t => t.type === 'sortie').reduce((s, t) => s + Math.abs(Number(t.amount)), 0));
  }
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
function renderTransactionsList() {
  set('tx-total-count', transactions.length);
  const search = $('tx-search').value.toLowerCase();
  const filtCat = $('tx-filter-cat').value;
  const filtered = transactions.filter(t => {
    if (filtCat !== 'all' && t.category !== filtCat) return false;
    if (search && !t.label.toLowerCase().includes(search)) return false;
    return true;
  }).slice(0, 300);
  const list = $('tx-list-all');
  if (!filtered.length) { list.innerHTML = '<div class="empty"><div class="empty-title">Aucune transaction</div></div>'; return; }
  list.innerHTML = filtered.map(t => `
    <div class="tx-row">
      <div class="tx-date">${t.date_op.slice(8)}/${t.date_op.slice(5, 7)}<br><span style="font-size:10px">${t.date_op.slice(0, 4)}</span></div>
      <div class="tx-icon" style="background:${catColor(t.category)}15;color:${catColor(t.category)}">${catIcon(t.category)}</div>
      <div class="tx-info"><div class="tx-label">${t.label}</div><div class="tx-cat">${t.category}${t.sub_category ? ' · ' + t.sub_category : ''}</div></div>
      <div class="tx-amt ${t.type === 'entree' ? 'amt-in' : 'amt-out'}">${t.type === 'entree' ? '+' : '-'}${fmtD(Math.abs(Number(t.amount)))}</div>
    </div>
  `).join('');
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
  toast('Analyse de ' + file.name + '…');
  try {
    let parsed = [];
    if (name.endsWith('.csv')) parsed = await parseCSV(file);
    else if (name.endsWith('.pdf')) parsed = await parsePDF(file);
    else if (name.endsWith('.json')) parsed = await parseJSON(file);
    else { toast('Format non supporté', 'error'); return; }
    if (!parsed.length) { toast('Aucune transaction détectée', 'error'); return; }
    // Catégorise
    parsed.forEach(t => {
      const c = categorize(t.label, t.amount);
      t.category = c.category;
      t.sub_category = c.sub_category;
      t.merchant_key = merchantKey(t.label);
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
    // Legacy format Monie
    return d.transactions.filter(t => t.label && t.amount && t.date).map(t => ({
      date_op: t.date,
      label: t.label,
      amount: t.type === 'entree' ? Math.abs(t.amount) : -Math.abs(t.amount),
      type: t.type || (t.amount > 0 ? 'entree' : 'sortie')
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

function showImportPreview() {
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
  const catsInImport = [...new Set(importPreviewData.map(t => t.category))].sort();

  let html = `
    <div class="card">
      <div class="card-hd">
        <div class="card-title">📥 Analyse de l'import</div>
        <div style="display:flex;gap:8px">
          <button class="btn-ghost" onclick="cancelImport()">Annuler</button>
          <button class="btn-primary" onclick="confirmImport()">Confirmer l'import (${nNew})</button>
        </div>
      </div>
      <div class="kpi-grid">
        <div class="kpi kpi-sage"><div class="kpi-label">Nouvelles</div><div class="kpi-val kpi-val-sage">${nNew}</div><div class="kpi-hint">à ajouter</div></div>
        <div class="kpi kpi-peach"><div class="kpi-label">Doublons</div><div class="kpi-val" style="color:var(--peach)">${nDup}</div><div class="kpi-hint">à vérifier</div></div>
        <div class="kpi kpi-rose"><div class="kpi-label">Total lu</div><div class="kpi-val">${importPreviewData.length}</div><div class="kpi-hint">lignes</div></div>
        <div class="kpi kpi-gold"><div class="kpi-label">Auto-catégorisées</div><div class="kpi-val kpi-val-gold">${importPreviewData.filter(t => t.category !== 'Autres').length}</div><div class="kpi-hint">reconnues</div></div>
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

  // Filtres + liste
  html += `
    <div style="margin-top:20px">
      <div class="card-hd">
        <div class="card-title">✨ Nouvelles transactions</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
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
            ${catsInImport.map(c => `<option value="${c}" ${previewFilterCat === c ? 'selected' : ''}>${catIcon(c)} ${c}</option>`).join('')}
          </select>
        </div>
      </div>`;

  // Filtrage
  let filtered = importPreviewData.filter(t => !t._duplicate);
  if (previewFilterYear !== 'all') filtered = filtered.filter(t => t.date_op.startsWith(previewFilterYear));
  if (previewFilterMonth !== 'all') filtered = filtered.filter(t => t.date_op.slice(5, 7) === previewFilterMonth);
  if (previewFilterCat !== 'all') filtered = filtered.filter(t => t.category === previewFilterCat);
  const displayed = filtered.slice(0, 100);

  html += `<div style="font-size:12px;color:var(--muted);margin-bottom:12px">Affiché : ${displayed.length} / ${filtered.length} · Tape sur une catégorie pour la changer et enseigner à Monie 🌸</div>`;

  displayed.forEach((t, idx) => {
    const globalIdx = importPreviewData.indexOf(t);
    html += `
      <div class="tx-row" style="border-bottom:1px solid var(--border-soft)">
        <div class="tx-date">${t.date_op.slice(8)}/${t.date_op.slice(5, 7)}<br><span style="font-size:10px">${t.date_op.slice(0, 4)}</span></div>
        <div class="tx-icon" style="background:${catColor(t.category)}15;color:${catColor(t.category)}">${catIcon(t.category)}</div>
        <div class="tx-info">
          <div class="tx-label">${t.label}</div>
          <select class="select" style="margin-top:4px;padding:4px 8px;font-size:11px;width:auto;min-width:180px" onchange="recategorizeImportTx(${globalIdx}, this.value)">
            ${cats.map(c => `<option value="${c}" ${t.category === c ? 'selected' : ''}>${catIcon(c)} ${c}</option>`).join('')}
          </select>
        </div>
        <div class="tx-amt ${t.type === 'entree' ? 'amt-in' : 'amt-out'}">${t.type === 'entree' ? '+' : '-'}${fmtD(Math.abs(t.amount))}</div>
        <button class="import-del-btn" onclick="deleteImportTx(${globalIdx})" title="Supprimer de l'import (n'apparaîtra pas ce mois-ci)">✕</button>
      </div>`;
  });

  if (filtered.length > 100) html += `<div class="empty-sub" style="margin-top:12px;text-align:center">… ${filtered.length - 100} autres — utilise les filtres pour affiner</div>`;
  if (!filtered.length) html += `<div class="empty"><div class="empty-title">Aucune transaction pour ce filtre</div></div>`;

  html += `</div></div>`;
  wrap.innerHTML = html;
  if (wrap.scrollIntoView && previewFilterYear === 'all' && previewFilterMonth === 'all' && previewFilterCat === 'all') {
    wrap.scrollIntoView({ behavior: 'smooth' });
  }
}

function deleteImportTx(idx) {
  if (idx < 0 || idx >= importPreviewData.length) return;
  const t = importPreviewData[idx];
  const dateStr = t.date_op ? new Date(t.date_op).toLocaleDateString('fr-FR') : '';
  // Retire la transaction
  importPreviewData.splice(idx, 1);
  // Retire aussi des matches si présent
  importMatches = importMatches.filter(m => m.new !== t);
  toast(`"${t.label.substring(0, 30)}..." retirée de l'import`, 'success');
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
    account: t.account || 'Compte courant'
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
  const year = new Date().getFullYear();
  const yearTx = transactions.filter(t => t.date_op.startsWith(String(year)));
  const totalIn = yearTx.filter(t => t.type === 'entree').reduce((s, t) => s + Number(t.amount), 0);
  const yearRows = Object.entries(suiviData).filter(([k]) => k.startsWith(String(year)));
  const epReel = yearRows.reduce((s, [_, r]) => s + (r.epargne_reel || 0), 0);
  const epCible = yearRows.reduce((s, [_, r]) => s + (r.epargne_cible || 0), 0);
  set('ep-year', fmt(epReel));
  set('ep-year-hint', yearRows.length + ' mois saisis');
  set('ep-cible', fmt(epCible));
  const ecart = epReel - epCible;
  set('ep-ecart', (ecart >= 0 ? '+' : '') + fmt(ecart));
  const rate = totalIn > 0 ? Math.round(epReel / totalIn * 100) : 0;
  set('ep-rate', rate + '%');
  // TODO: goals CRUD
  $('goals-list').innerHTML = '<div class="empty"><div class="empty-emoji">🎯</div><div class="empty-title">Aucun objectif défini</div><div class="empty-sub">Utilise le bouton + Ajouter</div></div>';
}
function addGoal() {
  toast('Bientôt disponible 🌸');
}

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

// ═══ FAB ═══════════════════════════════════════════════════════
function quickAddOpen() {
  showTab('calendar');
  if (!selectedDay) selectDay(new Date().toISOString().slice(0, 10));
  $('qa-label').focus();
}
