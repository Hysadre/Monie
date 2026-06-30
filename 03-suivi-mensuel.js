// ════════════════════════════════════════════════════════════
// 🌸 MONIE V2 — Page Suivi mensuel (logique JS)
// À coller dans app.js, avant la section // ─── BOOT ───
// ════════════════════════════════════════════════════════════

// ─── STATE ──────────────────────────────────────────────────
let suiviData = {}; // { '2026-05': { lcl, bourso, ..., salaire, ..., epargne_cible, epargne_reel } }
let suiviYear = new Date().getFullYear();
let suiviSaveTimers = {}; // par mois pour debounce

const SUIVI_COLS_PAT = ['lcl', 'bourso', 'especes', 'esalia', 'banque_postale', 'investissements', 'autre'];
const SUIVI_COLS_REV = ['salaire', 'tickets_resto', 'remboursements', 'autres_revenus'];
const SUIVI_COLS_EP = ['epargne_cible', 'epargne_reel'];
const SUIVI_ALL_COLS = [...SUIVI_COLS_PAT, ...SUIVI_COLS_REV, ...SUIVI_COLS_EP];

// ─── CHARGEMENT INITIAL ─────────────────────────────────────
async function loadSuiviData() {
  if (!currentUser) return;
  const { data, error } = await sb.from('tracker_mensuel')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('month');
  if (error) { console.error('Erreur chargement suivi:', error); return; }
  suiviData = {};
  (data || []).forEach(row => {
    const key = row.month.slice(0, 7); // YYYY-MM
    suiviData[key] = row;
  });
}

// ─── RENDER ──────────────────────────────────────────────────
async function renderSuivi() {
  if (!Object.keys(suiviData).length) await loadSuiviData();

  // Filtre année — populate select
  const yearSel = $('suivi-year-filter');
  if (yearSel && !yearSel.options.length) {
    const nowY = new Date().getFullYear();
    for (let y = nowY + 1; y >= 2021; y--) {
      const o = document.createElement('option');
      o.value = y;
      o.textContent = y;
      if (y === suiviYear) o.selected = true;
      yearSel.appendChild(o);
    }
  }
  if (yearSel) suiviYear = parseInt(yearSel.value);

  renderSuiviKPIs();
  renderSuiviTable();
  renderSuiviMobileCards();
}

// ─── KPIs récap année ───────────────────────────────────────
function renderSuiviKPIs() {
  const yearData = getYearRows(suiviYear);

  // Patrimoine fin d'année = dernier mois non-vide
  let patFin = 0, patFinMonth = null;
  yearData.slice().reverse().some(row => {
    const total = SUIVI_COLS_PAT.reduce((s, c) => s + (parseFloat(row[c]) || 0), 0);
    if (total > 0) { patFin = total; patFinMonth = row.month; return true; }
    return false;
  });
  set('suivi-pat-fin', fmt(patFin));

  // Évolution patrimoine vs début d'année
  let patDeb = 0;
  yearData.some(row => {
    const total = SUIVI_COLS_PAT.reduce((s, c) => s + (parseFloat(row[c]) || 0), 0);
    if (total > 0) { patDeb = total; return true; }
    return false;
  });
  const evol = patFin - patDeb;
  const evolPct = patDeb > 0 ? Math.round(evol / patDeb * 100) : 0;
  const evolEl = $('suivi-pat-evol');
  if (evolEl) {
    evolEl.textContent = (evol >= 0 ? '+' : '') + fmt(evol) + ' (' + (evolPct >= 0 ? '+' : '') + evolPct + '%)';
    evolEl.style.color = evol >= 0 ? '#2ECBA1' : '#FF6B8A';
  }

  // Revenus année
  const revYear = yearData.reduce((s, row) =>
    s + SUIVI_COLS_REV.reduce((sub, c) => sub + (parseFloat(row[c]) || 0), 0), 0);
  set('suivi-rev-year', fmt(revYear));
  const monthsCount = yearData.filter(row =>
    SUIVI_COLS_REV.some(c => (parseFloat(row[c]) || 0) > 0)
  ).length;
  set('suivi-rev-hint', monthsCount > 0 ? Math.round(revYear / monthsCount) + ' € / mois' : '—');

  // Épargne cumulée
  const epReel = yearData.reduce((s, row) => s + (parseFloat(row.epargne_reel) || 0), 0);
  const epCible = yearData.reduce((s, row) => s + (parseFloat(row.epargne_cible) || 0), 0);
  set('suivi-ep-year', fmt(epReel));
  const epHint = $('suivi-ep-hint');
  if (epHint) {
    const pct = epCible > 0 ? Math.round(epReel / epCible * 100) : 0;
    epHint.textContent = epCible > 0 ? pct + '% de la cible (' + fmt(epCible) + ')' : 'Aucune cible définie';
    epHint.style.color = pct >= 100 ? '#2ECBA1' : pct >= 50 ? '#FFC107' : '#FF6B8A';
  }
}

// ─── Helper : récupère les 12 lignes d'une année ─────────────
function getYearRows(year) {
  const rows = [];
  for (let m = 0; m < 12; m++) {
    const monthDate = new Date(year, m, 1);
    // Ne pas afficher futur (au-delà du mois en cours +1)
    const now = new Date();
    if (monthDate > new Date(now.getFullYear(), now.getMonth() + 1, 1)) break;
    const key = year + '-' + String(m + 1).padStart(2, '0');
    rows.push(suiviData[key] || { month: key + '-01' });
  }
  return rows;
}

// ─── TABLEAU DESKTOP ────────────────────────────────────────
function renderSuiviTable() {
  const tbody = $('suivi-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const rows = getYearRows(suiviYear);
  let prevTotal = 0;

  rows.forEach((row, idx) => {
    const key = row.month.slice(0, 7);
    const tr = document.createElement('tr');
    tr.className = 'suivi-row';
    tr.dataset.month = key;

    // Mois
    const mIdx = parseInt(key.slice(5, 7)) - 1;
    const mLabel = MONTHS[mIdx].substring(0, 3) + ' ' + key.slice(0, 4);
    tr.innerHTML = `<td class="td-mois">${mLabel}</td>`;

    // PATRIMOINE
    SUIVI_COLS_PAT.forEach(col => {
      const v = parseFloat(row[col]) || 0;
      tr.innerHTML += `<td><input class="suivi-inp" type="number" step="0.01" min="0"
        value="${v > 0 ? v : ''}" placeholder="0"
        onchange="updateSuiviCell('${key}','${col}',this.value)"
        oninput="updateSuiviCell('${key}','${col}',this.value)"></td>`;
    });

    // TOTAL patrimoine
    const total = SUIVI_COLS_PAT.reduce((s, c) => s + (parseFloat(row[c]) || 0), 0);
    tr.innerHTML += `<td class="td-total">${total > 0 ? fmt(total) : '—'}</td>`;

    // ÉVOLUTION
    let evolStr = '—', evolColor = 'var(--mt)';
    if (total > 0 && prevTotal > 0) {
      const e = total - prevTotal;
      evolStr = (e >= 0 ? '+' : '') + fmt(e);
      evolColor = e >= 0 ? '#2ECBA1' : '#FF6B8A';
    }
    tr.innerHTML += `<td class="td-evol" style="color:${evolColor}">${evolStr}</td>`;
    if (total > 0) prevTotal = total;

    // REVENUS
    SUIVI_COLS_REV.forEach(col => {
      const v = parseFloat(row[col]) || 0;
      tr.innerHTML += `<td><input class="suivi-inp suivi-inp-rev" type="number" step="0.01" min="0"
        value="${v > 0 ? v : ''}" placeholder="0"
        onchange="updateSuiviCell('${key}','${col}',this.value)"></td>`;
    });

    // TOTAL revenus
    const revTot = SUIVI_COLS_REV.reduce((s, c) => s + (parseFloat(row[c]) || 0), 0);
    tr.innerHTML += `<td class="td-total">${revTot > 0 ? fmt(revTot) : '—'}</td>`;

    // ÉPARGNE
    SUIVI_COLS_EP.forEach(col => {
      const v = parseFloat(row[col]) || 0;
      const isReel = col === 'epargne_reel';
      const cible = parseFloat(row.epargne_cible) || 0;
      const reel = parseFloat(row.epargne_reel) || 0;
      let cls = 'suivi-inp suivi-inp-ep';
      if (isReel && cible > 0) cls += reel >= cible ? ' suivi-cell-ok' : reel > 0 ? ' suivi-cell-warn' : '';
      tr.innerHTML += `<td><input class="${cls}" type="number" step="0.01" min="0"
        value="${v > 0 ? v : ''}" placeholder="0"
        onchange="updateSuiviCell('${key}','${col}',this.value)"></td>`;
    });

    tbody.appendChild(tr);
  });
}

// ─── CARTES MOBILE ──────────────────────────────────────────
function renderSuiviMobileCards() {
  const wrap = $('suivi-mobile-cards');
  if (!wrap) return;
  wrap.innerHTML = '';

  const rows = getYearRows(suiviYear);
  let prevTotal = 0;

  rows.forEach(row => {
    const key = row.month.slice(0, 7);
    const mIdx = parseInt(key.slice(5, 7)) - 1;
    const mLabel = MONTHS[mIdx] + ' ' + key.slice(0, 4);

    const patTotal = SUIVI_COLS_PAT.reduce((s, c) => s + (parseFloat(row[c]) || 0), 0);
    const revTotal = SUIVI_COLS_REV.reduce((s, c) => s + (parseFloat(row[c]) || 0), 0);
    const cible = parseFloat(row.epargne_cible) || 0;
    const reel = parseFloat(row.epargne_reel) || 0;

    const evolHTML = (patTotal > 0 && prevTotal > 0)
      ? `<span style="font-size:11px;color:${patTotal >= prevTotal ? '#2ECBA1' : '#FF6B8A'}">
          (${patTotal >= prevTotal ? '+' : ''}${fmt(patTotal - prevTotal)})
        </span>`
      : '';

    const card = document.createElement('div');
    card.className = 'suivi-mcard';
    card.innerHTML = `
      <div class="suivi-mcard-hd" onclick="this.parentElement.classList.toggle('open')">
        <span class="suivi-mcard-month">${mLabel}</span>
        <span class="suivi-mcard-pat">${patTotal > 0 ? fmt(patTotal) : '—'} ${evolHTML}</span>
        <span class="suivi-mcard-toggle">▾</span>
      </div>
      <div class="suivi-mcard-body">
        <div class="suivi-mcard-section">
          <div class="suivi-mcard-title">💎 Patrimoine</div>
          ${SUIVI_COLS_PAT.map(c => `
            <div class="suivi-mcard-row">
              <label>${labelOfCol(c)}</label>
              <input class="inp inp-r" type="number" step="0.01" min="0"
                value="${parseFloat(row[c]) > 0 ? row[c] : ''}" placeholder="0"
                onchange="updateSuiviCell('${key}','${c}',this.value)">
            </div>`).join('')}
          <div class="suivi-mcard-sub">Total : ${patTotal > 0 ? fmt(patTotal) : '—'}</div>
        </div>
        <div class="suivi-mcard-section">
          <div class="suivi-mcard-title">💰 Revenus</div>
          ${SUIVI_COLS_REV.map(c => `
            <div class="suivi-mcard-row">
              <label>${labelOfCol(c)}</label>
              <input class="inp inp-r" type="number" step="0.01" min="0"
                value="${parseFloat(row[c]) > 0 ? row[c] : ''}" placeholder="0"
                onchange="updateSuiviCell('${key}','${c}',this.value)">
            </div>`).join('')}
          <div class="suivi-mcard-sub">Total : ${revTotal > 0 ? fmt(revTotal) : '—'}</div>
        </div>
        <div class="suivi-mcard-section">
          <div class="suivi-mcard-title">🎯 Épargne</div>
          <div class="suivi-mcard-row">
            <label>Cible</label>
            <input class="inp inp-r" type="number" step="0.01" min="0"
              value="${cible > 0 ? cible : ''}" placeholder="0"
              onchange="updateSuiviCell('${key}','epargne_cible',this.value)">
          </div>
          <div class="suivi-mcard-row">
            <label>Réel</label>
            <input class="inp inp-r" type="number" step="0.01" min="0"
              value="${reel > 0 ? reel : ''}" placeholder="0"
              onchange="updateSuiviCell('${key}','epargne_reel',this.value)">
          </div>
          ${cible > 0 ? `
            <div class="suivi-mcard-sub" style="color:${reel >= cible ? '#2ECBA1' : '#FF6B8A'}">
              ${reel >= cible ? '✓ Cible atteinte' : `Écart : ${fmt(cible - reel)}`}
            </div>` : ''}
        </div>
      </div>
    `;
    wrap.appendChild(card);
    if (patTotal > 0) prevTotal = patTotal;
  });
}

function labelOfCol(c) {
  const m = {
    lcl: 'LCL', bourso: 'BoursoBank', especes: 'Espèces',
    esalia: 'Esalia (SG)', banque_postale: 'Banque Postale',
    investissements: 'Investissements', autre: 'Autre',
    salaire: 'Salaire', tickets_resto: 'Tickets resto',
    remboursements: 'Remboursements', autres_revenus: 'Autres revenus',
    epargne_cible: 'Cible', epargne_reel: 'Réel'
  };
  return m[c] || c;
}

// ─── MISE À JOUR D'UNE CELLULE ──────────────────────────────
function updateSuiviCell(monthKey, col, value) {
  const val = Math.max(0, parseFloat(value) || 0);
  if (!suiviData[monthKey]) suiviData[monthKey] = { month: monthKey + '-01' };
  suiviData[monthKey][col] = val;

  // Update visual (totaux + évolution)
  renderSuiviKPIs();
  // Recalc totaux pour la ligne seulement (sans full re-render pour préserver focus)
  updateRowTotals(monthKey);

  // Debounced save
  clearTimeout(suiviSaveTimers[monthKey]);
  suiviSaveTimers[monthKey] = setTimeout(() => saveSuiviRow(monthKey), 1500);

  const status = $('suivi-status');
  if (status) { status.textContent = '✓ Sauvegarde…'; status.style.color = '#FFC107'; }
}

function updateRowTotals(monthKey) {
  const row = document.querySelector(`tr[data-month="${monthKey}"]`);
  if (!row) return;
  const data = suiviData[monthKey] || {};
  const cells = row.querySelectorAll('td');
  // Cell index : 0=mois, 1-7=pat, 8=total, 9=evol, 10-13=rev, 14=tot_rev, 15-16=ep
  const totalPat = SUIVI_COLS_PAT.reduce((s, c) => s + (parseFloat(data[c]) || 0), 0);
  const totalRev = SUIVI_COLS_REV.reduce((s, c) => s + (parseFloat(data[c]) || 0), 0);
  if (cells[8]) cells[8].textContent = totalPat > 0 ? fmt(totalPat) : '—';
  if (cells[14]) cells[14].textContent = totalRev > 0 ? fmt(totalRev) : '—';
}

// ─── SAUVEGARDE SUPABASE ────────────────────────────────────
async function saveSuiviRow(monthKey) {
  if (!currentUser) return;
  const row = suiviData[monthKey];
  if (!row) return;

  const payload = {
    user_id: currentUser.id,
    month: monthKey + '-01',
  };
  SUIVI_ALL_COLS.forEach(c => {
    payload[c] = parseFloat(row[c]) || 0;
  });

  const { error } = await sb.from('tracker_mensuel')
    .upsert(payload, { onConflict: 'user_id,month' });

  const status = $('suivi-status');
  if (status) {
    if (error) {
      status.textContent = '⚠ Erreur sauvegarde';
      status.style.color = '#FF6B8A';
      console.error(error);
    } else {
      status.textContent = '✓ Sauvegardé';
      status.style.color = '#2ECBA1';
      setTimeout(() => { if (status) status.textContent = ''; }, 2500);
    }
  }
}

// ─── RESYNC DEPUIS LES TRANSACTIONS ─────────────────────────
function resyncSuiviFromTransactions() {
  if (!S.transactions?.length) {
    toast('Aucune transaction à utiliser — importe d\'abord tes relevés', 'error');
    return;
  }

  const rows = getYearRows(suiviYear);
  let updated = 0;

  rows.forEach(row => {
    const key = row.month.slice(0, 7);
    const monthTx = S.transactions.filter(t => t.date && t.date.startsWith(key));

    if (!monthTx.length) return;

    if (!suiviData[key]) suiviData[key] = { month: key + '-01' };
    const data = suiviData[key];

    // Salaire = catégorie "Salaire"
    const salaire = monthTx.filter(t => t.type === 'entree' && (t.cat === 'Salaire' || /salaire/i.test(t.cat)))
      .reduce((s, t) => s + t.amount, 0);
    if (salaire > 0) { data.salaire = salaire; updated++; }

    // Tickets resto
    const tickets = monthTx.filter(t => t.type === 'entree' && /ticket/i.test(t.cat))
      .reduce((s, t) => s + t.amount, 0);
    if (tickets > 0) { data.tickets_resto = tickets; updated++; }

    // Remboursements (Wero, Lydia, ami)
    const remb = monthTx.filter(t => t.type === 'entree' && /rembours/i.test(t.cat))
      .reduce((s, t) => s + t.amount, 0);
    if (remb > 0) { data.remboursements = remb; updated++; }

    // Autres revenus
    const autres = monthTx.filter(t => t.type === 'entree' &&
      !(/salaire|ticket|rembours/i.test(t.cat))).reduce((s, t) => s + t.amount, 0);
    if (autres > 0) { data.autres_revenus = autres; updated++; }

    // Épargne réelle (virements vers épargne)
    const epReel = monthTx.filter(t => t.type === 'sortie' &&
      /epargne|livret|pea|investissement/i.test((t.label || '') + ' ' + (t.cat || ''))
    ).reduce((s, t) => s + t.amount, 0);
    if (epReel > 0) { data.epargne_reel = epReel; updated++; }
  });

  if (updated > 0) {
    toast(`${updated} valeurs synchronisées depuis tes transactions`);
    // Save toutes les lignes modifiées
    rows.forEach(row => {
      const key = row.month.slice(0, 7);
      if (suiviData[key]) saveSuiviRow(key);
    });
    renderSuivi();
  } else {
    toast('Aucune correspondance trouvée dans les transactions', 'error');
  }
}

// ════════════════════════════════════════════════════════════
// 🔧 INTÉGRATION
// ════════════════════════════════════════════════════════════
// 1. Dans `showTab(name)`, ajoute :
//      if (name === 'suivi') renderSuivi();
//
// 2. Dans `renderAll()`, ajoute :
//      renderSuivi();
//
// 3. Dans `showApp(user)`, après loadFromSupabase(), ajoute :
//      await loadSuiviData();
// ════════════════════════════════════════════════════════════
