/* ═══════════════════════════════════════════════════════════════════
   MONIE BOOST — rend ta plateforme vivante, sans réécrire ton code.
   -------------------------------------------------------------------
   Installation (2 lignes, à la fin de <body> dans index.html) :
       <link rel="stylesheet" href="monie-boost.css">
       <script src="monie-boost.js"></script>
   Charge-le APRÈS app.js. C'est tout — il s'accroche tout seul à tes
   classes existantes (.kpi-val, .nav-btn, .toast, .btn-primary…).

   Ce qu'il ajoute automatiquement :
   • Compteurs animés  : chaque .kpi-val / .cal-summary-val / .perf-val
     qui reçoit un nombre monte de l'ancienne à la nouvelle valeur.
   • Sons de feedback  : clic (boutons/nav), succès & erreur (branchés
     sur TES toasts existants), tintement « pièce ».
   • Skeletons         : shimmer bref au changement d'onglet.
   • Barres brillantes : reflet qui balaie les barres de progression.
   • Micro-interactions: gérées surtout par monie-boost.css.

   Tout est désactivable : window.MonieBoost.config (voir plus bas).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var config = {
    sound: true,          // sons de feedback
    countUp: true,        // compteurs animés
    skeleton: true,       // shimmer au changement d'onglet
    sheen: true,          // reflet sur les barres de progression
    countUpMs: 900,       // durée du comptage
    respectReducedMotion: true
  };

  var reduce = config.respectReducedMotion &&
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ─────────────────────────  SONS  ───────────────────────── */
  var actx = null;
  function ac() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
    if (actx && actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(freq, start, dur, type, gain) {
    var c = ac(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    o.connect(g); g.connect(c.destination);
    var t = c.currentTime + start;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain || 0.12, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function beep(kind) {
    if (!config.sound) return;
    if (kind === 'click')      { tone(520, 0, 0.06, 'triangle', 0.07); }
    else if (kind === 'success') { tone(660, 0, 0.09, 'sine', 0.12); tone(988, 0.09, 0.14, 'sine', 0.11); }
    else if (kind === 'error')   { tone(200, 0, 0.16, 'sawtooth', 0.09); tone(150, 0.09, 0.18, 'sawtooth', 0.08); }
    else if (kind === 'coin')    { tone(880, 0, 0.05, 'square', 0.07); tone(1320, 0.05, 0.10, 'square', 0.06); }
  }

  // clic sur les éléments interactifs
  var CLICKABLE = '.btn-primary,.btn-ghost,.btn-auth,.nav-btn,.bnav-btn,.dash-view-btn,.cal-nav button';
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest(CLICKABLE);
    if (t) beep('click');
  }, true);

  // jour de calendrier : clic + petit pop
  document.addEventListener('click', function (e) {
    var d = e.target.closest && e.target.closest('.cal-day');
    if (d && !d.classList.contains('empty')) {
      beep('click');
      d.classList.remove('mb-just-selected'); void d.offsetWidth;
      d.classList.add('mb-just-selected');
    }
  }, true);

  /* ─── Sons branchés sur TES toasts existants (.toast success/error) ─── */
  function watchToasts() {
    var mo = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType !== 1) return;
          var el = n.classList && n.classList.contains('toast') ? n : (n.querySelector && n.querySelector('.toast'));
          if (!el) return;
          if (el.classList.contains('toast-error')) beep('error');
          else beep('success');
        });
      });
      // toasts réutilisés (classe .show ajoutée)
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  /* ────────────────────  COMPTEURS ANIMÉS  ──────────────────── */
  // Anime tout élément .kpi-val / .cal-summary-val / .perf-val quand son
  // texte devient un nombre. Conserve le format (espace milliers, €, %, +/-).
  var COUNT_SEL = '.kpi-val, .cal-summary-val, .perf-val';

  function parseNum(txt) {
    // ex: "+2 640 €" -> {num:2640, prefix:"+", suffix:" €", dec:0}
    if (txt == null) return null;
    var m = txt.match(/-?\d[\d\s\u00a0\u202f]*(?:[.,]\d+)?/);
    if (!m) return null;
    var raw = m[0];
    var idx = txt.indexOf(raw);
    var prefix = txt.slice(0, idx);
    var suffix = txt.slice(idx + raw.length);
    var cleaned = raw.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
    var num = parseFloat(cleaned);
    if (isNaN(num)) return null;
    var decMatch = cleaned.match(/\.(\d+)/);
    var dec = decMatch ? decMatch[1].length : 0;
    return { num: num, prefix: prefix, suffix: suffix, dec: dec };
  }
  function fmt(v, dec) {
    return v.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function animateCount(el, from, to, dec, prefix, suffix) {
    if (reduce || !config.countUp) { el.textContent = prefix + fmt(to, dec) + suffix; return; }
    el.classList.add('mb-counting');
    var t0 = Date.now(), dur = config.countUpMs;
    el.__mbTarget = to;
    (function step() {
      if (el.__mbTarget !== to) return; // une valeur plus récente a pris le relais
      var p = Math.min(1, (Date.now() - t0) / dur);
      p = 1 - Math.pow(1 - p, 3);
      var v = from + (to - from) * p;
      el.__mbSet = true;
      el.textContent = prefix + fmt(dec ? v : Math.round(v), dec) + suffix;
      el.__mbSet = false;
      if (p < 1) setTimeout(step, 24);
      else el.classList.remove('mb-counting');
    })();
  }
  function watchCounts() {
    var observed = new WeakSet();
    function hook(el) {
      if (observed.has(el)) return;
      observed.add(el);
      el.__mbLast = parseNum(el.textContent);
      var mo = new MutationObserver(function () {
        if (el.__mbSet) return; // c'est nous qui écrivons, on ignore
        var cur = parseNum(el.textContent);
        if (!cur) { el.__mbLast = null; return; }
        var from = (el.__mbLast && isFinite(el.__mbLast.num)) ? el.__mbLast.num : 0;
        el.__mbLast = cur;
        if (from === cur.num) return;
        animateCount(el, from, cur.num, cur.dec, cur.prefix, cur.suffix);
      });
      mo.observe(el, { childList: true, characterData: true, subtree: true });
    }
    function scan() { document.querySelectorAll(COUNT_SEL).forEach(hook); }
    scan();
    // ré-scan si de nouveaux KPIs apparaissent
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
    // première animation depuis 0 pour les valeurs déjà présentes
    document.querySelectorAll(COUNT_SEL).forEach(function (el) {
      var cur = parseNum(el.textContent);
      if (cur && cur.num !== 0) animateCount(el, 0, cur.num, cur.dec, cur.prefix, cur.suffix);
    });
  }

  /* ──────────────────  BARRES BRILLANTES  ────────────────── */
  function applySheen() {
    if (!config.sheen || reduce) return;
    // barres de progression connues de Monie + heuristique générique
    var sel = '#dash-goal-fill, [id$="-fill"], [id$="-bar"], .progress-fill, .goal-fill, .bar-fill';
    document.querySelectorAll(sel).forEach(function (el) {
      if (!el.classList.contains('mb-sheen')) el.classList.add('mb-sheen');
    });
  }

  /* ────────────────  SKELETON AU CHANGEMENT D'ONGLET  ──────────────── */
  // Enrobe la fonction globale showTab(...) sans la modifier.
  function wrapShowTab() {
    if (!config.skeleton || reduce) return;
    if (typeof window.showTab !== 'function' || window.showTab.__mbWrapped) return;
    var orig = window.showTab;
    var main = document.querySelector('.main') || document.body;
    function skeleton() {
      var ov = document.createElement('div');
      ov.className = 'mb-skel-overlay';
      ov.innerHTML =
        '<div class="mb-skel" style="height:34px;width:220px"></div>' +
        '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">' +
          '<div class="mb-skel" style="height:92px"></div><div class="mb-skel" style="height:92px"></div>' +
          '<div class="mb-skel" style="height:92px"></div><div class="mb-skel" style="height:92px"></div></div>' +
        '<div class="mb-skel" style="height:220px"></div>';
      var cs = getComputedStyle(main);
      if (cs.position === 'static') main.style.position = 'relative';
      main.appendChild(ov);
      setTimeout(function () { ov.remove(); }, 380);
    }
    window.showTab = function () {
      skeleton();
      return orig.apply(this, arguments);
    };
    window.showTab.__mbWrapped = true;
  }

  /* ────────────────────────  API PUBLIQUE  ──────────────────────── */
  window.MonieBoost = {
    config: config,
    sound: beep,
    // toast maison optionnel (si tu veux un toast rapide avec son)
    toast: function (msg, kind) {
      kind = kind || 'info';
      beep(kind === 'error' ? 'error' : (kind === 'success' ? 'success' : 'click'));
      var t = document.createElement('div');
      t.className = 'mb-toast ' + kind;
      t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(function () { t.style.transition = 'opacity .35s,transform .35s'; t.style.opacity = '0'; t.style.transform = 'translate(-50%,10px)'; setTimeout(function () { t.remove(); }, 360); }, 2200);
    },
    // feedback flottant "+50 €" au-dessus d'un élément
    floatUp: function (el, text, color) {
      var r = el.getBoundingClientRect();
      var f = document.createElement('div');
      f.className = 'mb-float';
      f.textContent = text;
      f.style.left = (r.left + r.width / 2) + 'px';
      f.style.top = (r.top + window.scrollY) + 'px';
      f.style.color = color || 'var(--sage,#34D399)';
      document.body.appendChild(f);
      setTimeout(function () { f.remove(); }, 1000);
    },
    coin: function () { beep('coin'); }
  };

  /* ────────────────────────  DÉMARRAGE  ──────────────────────── */
  function start() {
    watchToasts();
    watchCounts();
    applySheen();
    wrapShowTab();
    // re-tente d'enrober showTab + sheen une fois l'app chargée
    var tries = 0;
    var iv = setInterval(function () { wrapShowTab(); applySheen(); if (++tries > 20) clearInterval(iv); }, 500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
