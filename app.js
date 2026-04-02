// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://stkktwlxzgmxxxnmipfg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0a2t0d2x4emdteHh4bm1pcGZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjk0MzcsImV4cCI6MjA5MDY0NTQzN30.HBSfJA-Yw7gteumgLkJEvs4KDwSTJQp49rNyKtrqZJY';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── STATE ────────────────────────────────────────────────────────────────────
let currentUser = null, saveTimer = null, charts = {};

const DEFAULT_STATE = () => ({
  salaire: 0, tr: 0, dimePct: 10, prov: 0,
  loyer: 0, transport: 0, sante: 0, alim: 0, loisirs: 0, shopping: 0, divers: 0,
  matelas: 0, invest: 0,
  revenuItems: [], abonnements: [], customSaves: [], transactions: [], comptes: [],
  repartPcts: { charges: 50, variable: 30, epargne: 20 }
});
let S = DEFAULT_STATE();
let curMonth = new Date().getMonth(), curYear = new Date().getFullYear();

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const CAT_COLORS = {
  'Alimentation':'#FF8C42','Loyer & charges':'#4F8EF7','Transport':'#2ECBA1',
  'Santé':'#FF6B9D','Loisirs':'#FF6B6B','Vêtements':'#63D68D',
  'Épargne':'#38ef7d','Salaire':'#2ECBA1','Dîme':'#C084FC',
  'Tickets restaurant':'#8E54E9','Autre':'#7B7A8E'
};
const PALETTE = ['#FF6B6B','#FF8E53','#FFC107','#2ECBA1','#4F8EF7','#8E54E9','#FF6B9D','#63D68D','#38ef7d','#C084FC'];

// ─── UTILS ────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const set = (id, v) => { const el=$(id); if(el) el.textContent=v; };
const fmt = n => Math.round(Math.abs(n)).toLocaleString('fr-FR') + ' €';
const fmtD = n => Math.abs(n).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €';
const getN = id => Math.max(0, parseFloat($(id)?.value) || 0);

function toast(msg, type='default') {
  const t=$('toast'); t.textContent=msg;
  t.className='toast show'+(type==='error'?' toast-error':'');
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),2800);
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
function switchAuthTab(tab) {
  $('auth-login').style.display = tab==='login' ? '' : 'none';
  $('auth-signup').style.display = tab==='signup' ? '' : 'none';
  document.querySelectorAll('.auth-tab').forEach((b,i)=>b.classList.toggle('active',(i===0&&tab==='login')||(i===1&&tab==='signup')));
}

async function login() {
  const email=$('login-email')?.value.trim(), pw=$('login-password')?.value;
  clearAuthMsg('login-error');
  if(!email||!pw){showAuthMsg('login-error','Remplis tous les champs.');return;}
  $('btn-login').querySelector('span').textContent='Connexion…';
  const {error}=await sb.auth.signInWithPassword({email,password:pw});
  $('btn-login').querySelector('span').textContent='Se connecter';
  if(error) showAuthMsg('login-error', error.message==='Invalid login credentials'?'Email ou mot de passe incorrect.':error.message);
}

async function signup() {
  const email=$('signup-email')?.value.trim(), pw=$('signup-password')?.value, conf=$('signup-confirm')?.value;
  clearAuthMsg('signup-error');
  if(!email||!pw){showAuthMsg('signup-error','Remplis tous les champs.');return;}
  if(pw.length<6){showAuthMsg('signup-error','Mot de passe minimum 6 caractères.');return;}
  if(pw!==conf){showAuthMsg('signup-error','Les mots de passe ne correspondent pas.');return;}
  $('btn-signup').querySelector('span').textContent='Création…';
  const {error}=await sb.auth.signUp({email,password:pw});
  $('btn-signup').querySelector('span').textContent='Créer mon compte';
  if(error){showAuthMsg('signup-error',error.message);return;}
  showAuthMsg('signup-error','Compte créé ! Connecte-toi maintenant.','success');
}

function showAuthMsg(id,msg,type='error') {
  const el=$(id); if(!el)return;
  el.textContent=msg;
  el.className='auth-msg auth-msg-'+(type==='success'?'success':'error')+' show';
}
function clearAuthMsg(id) { const el=$(id); if(el){el.textContent='';el.className='auth-msg';} }

function confirmLogout() {
  openModal('Déconnexion','Tu vas être déconnecté(e). Tes données sont sauvegardées.',logout);
}
async function logout() {
  closeModal(); await sb.auth.signOut();
  currentUser=null; S=DEFAULT_STATE();
  $('auth-screen').style.display=''; $('app').style.display='none';
  toast('Déconnecté(e)');
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
let _modalCb=null;
function openModal(title,msg,cb) {
  set('modal-title',title); set('modal-msg',msg); _modalCb=cb;
  $('modal').style.display='flex';
}
function closeModal() { $('modal').style.display='none'; _modalCb=null; }

// ─── SHOW APP ─────────────────────────────────────────────────────────────────
async function showApp(user) {
  currentUser=user;
  $('auth-screen').style.display='none'; $('app').style.display='flex';
  const short=user.email.split('@')[0];
  set('user-avatar',short.charAt(0).toUpperCase()); set('user-email-short',user.email);
  const h=new Date().getHours(), greet=h<12?'Bonjour':h<18?'Bon après-midi':'Bonsoir';
  set('dash-greeting',`${greet}, ${short} 👋`);
  await loadFromSupabase();
  initUI();
}

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
function scheduleSave() { clearTimeout(saveTimer); saveTimer=setTimeout(saveToSupabase,1500); }

async function saveToSupabase() {
  if(!currentUser)return;
  const {error}=await sb.from('budgets').upsert({user_id:currentUser.id,data:buildPayload()},{onConflict:'user_id'});
  if(!error) {
    ['save-indicator','save-indicator-m'].forEach(id=>{const d=$(id);if(d){d.textContent='✓ Sauvegardé';setTimeout(()=>{d.textContent='';},2200);}});
  }
}

function buildPayload() {
  return {
    salaire:getN('inp-salaire'),tr:getN('inp-tr'),dimePct:getN('inp-dime-pct'),prov:getN('inp-prov'),
    loyer:getN('inp-loyer'),transport:getN('inp-transport'),sante:getN('inp-sante'),
    alim:getN('inp-alim'),loisirs:getN('inp-loisirs'),shopping:getN('inp-shopping'),divers:getN('inp-divers'),
    matelas:getN('inp-matelas'),invest:getN('inp-invest'),
    revenuItems:S.revenuItems,abonnements:S.abonnements,
    customSaves:S.customSaves,transactions:S.transactions,
    comptes:S.comptes,repartPcts:S.repartPcts,_at:new Date().toISOString()
  };
}

async function loadFromSupabase() {
  if(!currentUser)return;
  const {data}=await sb.from('budgets').select('data').eq('user_id',currentUser.id).single();
  if(data?.data) applyPayload(data.data);
  else initComptes(); // nouveau user = comptes vides par défaut
}

function applyPayload(d) {
  const map={salaire:'inp-salaire',tr:'inp-tr',dimePct:'inp-dime-pct',prov:'inp-prov',
    loyer:'inp-loyer',transport:'inp-transport',sante:'inp-sante',
    alim:'inp-alim',loisirs:'inp-loisirs',shopping:'inp-shopping',divers:'inp-divers',
    matelas:'inp-matelas',invest:'inp-invest'};
  Object.entries(map).forEach(([k,id])=>{ const el=$(id); if(el&&d[k]!==undefined) el.value=d[k]; });
  if(d.revenuItems) S.revenuItems=d.revenuItems;
  if(d.abonnements) S.abonnements=d.abonnements;
  if(d.customSaves) S.customSaves=d.customSaves;
  if(d.transactions) S.transactions=d.transactions;
  if(d.comptes?.length) S.comptes=d.comptes; else initComptes();
  if(d.repartPcts) S.repartPcts=d.repartPcts;
}

// ─── EXPORT / IMPORT ──────────────────────────────────────────────────────────
function exportData() {
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(buildPayload(),null,2)],{type:'application/json'}));
  a.download='monie_backup.json'; a.click(); URL.revokeObjectURL(a.href);
  toast('Données exportées !');
}
function importData(input) {
  const file=input.files[0]; if(!file)return;
  const reader=new FileReader();
  reader.onload=async e=>{
    try { const d=JSON.parse(e.target.result); applyPayload(d); renderAll(); await saveToSupabase(); toast('Données importées !'); }
    catch { toast('Fichier invalide','error'); }
  };
  reader.readAsText(file); input.value='';
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
function initComptes() {
  S.comptes=[
    {id:1,label:'Compte courant',amount:0,type:'free'},
    {id:2,label:'Épargne',amount:0,type:'res'},
  ];
}

function initUI() {
  const di=$('tx-date-inp'); if(di) di.value=new Date().toISOString().split('T')[0];
  const ml=MONTHS[curMonth]+' '+curYear;
  ['dash-month-label','tx-month-label','badge-month-overview','badge-month-tx'].forEach(id=>set(id,ml));
  renderAll();
}

function renderAll() {
  updateAll(); renderPatrimoine(); renderRevList();
  renderAboList(); renderCustomSaveList(); renderGoals(); renderTransactions();
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
function showTab(name) {
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
  document.querySelectorAll('.mnav-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
  const el=$('tab-'+name); if(el) el.classList.add('active');
  closeSidebar();
  if(name==='dashboard') renderDashboard();
  if(name==='transactions') renderTransactions();
  if(name==='patrimoine') renderPatrimoine();
  if(name==='charges'){renderChargesPie();renderRepartition();}
  if(name==='epargne') renderGoals();
}

// ─── MONTH ────────────────────────────────────────────────────────────────────
function changeMonth(dir) {
  curMonth+=dir;
  if(curMonth>11){curMonth=0;curYear++;} if(curMonth<0){curMonth=11;curYear--;}
  const ml=MONTHS[curMonth]+' '+curYear;
  ['dash-month-label','tx-month-label','badge-month-overview','badge-month-tx'].forEach(id=>set(id,ml));
  renderDashboard(); renderTransactions();
}

// ─── DERIVED ──────────────────────────────────────────────────────────────────
const getSalaire=()=>getN('inp-salaire');
const getTR=()=>getN('inp-tr');
const getDimePct=()=>getN('inp-dime-pct');
// FIXÉ : dîme sur salaire net uniquement (comportement intentionnel, précisé dans le label)
const getDime=()=>Math.round(getSalaire()*getDimePct()/100*100)/100;
const getProv=()=>getN('inp-prov');
const getRevCompl=()=>S.revenuItems.reduce((s,e)=>s+e.amount,0);
const getRevTotal=()=>getSalaire()+getTR()+getRevCompl();
const getAboTotal=()=>S.abonnements.reduce((s,a)=>s+a.amount,0);
const getFixedTotal=()=>getN('inp-loyer')+getN('inp-transport')+getN('inp-sante')+getAboTotal();
const getVarTotal=()=>getN('inp-alim')+getN('inp-loisirs')+getN('inp-shopping')+getN('inp-divers');
const getSaveTotal=()=>getN('inp-matelas')+getN('inp-invest')+S.customSaves.reduce((s,c)=>s+c.monthly,0);
// FIXÉ : charges ≠ épargne. Charges = fixed+var+dîme+prov. Épargne = séparé.
const getChargesTotal=()=>getFixedTotal()+getVarTotal()+getDime()+getProv();
const getSortiesTotal=()=>getChargesTotal()+getSaveTotal();

// ─── UPDATE ALL ───────────────────────────────────────────────────────────────
function updateAll() {
  const rev=getRevTotal(),dime=getDime(),prov=getProv();
  const fixed=getFixedTotal(),variable=getVarTotal(),save=getSaveTotal();
  const soldeAfterFixed=rev-(dime+prov+fixed);
  const soldeAfterAll=rev-getSortiesTotal();

  // Revenus
  set('dime-calc',fmtD(dime));
  set('dime-base-hint','sur salaire net uniquement');
  set('rev-dispo',fmt(rev-dime-prov));

  // Charges
  set('fixed-total',fmt(fixed)); set('var-total',fmt(variable));
  // FIXÉ : banner charges montre clairement ce qui est inclus
  setBanner('charges-banner',soldeAfterFixed,rev,'avant vie courante et épargne · dîme et provision incluses');

  // Épargne
  set('save-total',fmt(save));
  setBanner('save-banner',soldeAfterAll,rev,'après toutes les épargnes');

  renderDashboard(); renderChargesPie(); renderRepartition();
  scheduleSave();
}

// ─── BANNER ───────────────────────────────────────────────────────────────────
function setBanner(bid,solde,rev,ctx) {
  const b=$(bid); if(!b)return;
  const pct=rev>0?Math.round(Math.abs(solde)/rev*100):0;
  b.className='banner '+(solde>100?'banner-ok':solde>=0?'banner-warn':'banner-bad');
  const col=solde>100?'#2ECBA1':solde>=0?'#FFC107':'#FF6B8A';
  const tv=$(bid+'-val'),tt=$(bid+'-title'),ts=$(bid+'-sub');
  if(tv){tv.textContent=(solde<0?'- ':'')+fmt(solde);tv.style.color=col;}
  if(tt) tt.style.color=col;
  if(ts){ts.textContent=solde>=0?pct+'% restant · '+ctx:'Dépassement de '+fmt(Math.abs(solde));ts.style.color=col;}
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function renderDashboard() {
  const rev=getRevTotal(), charges=getChargesTotal(), save=getSaveTotal(), sorties=getSortiesTotal();
  const solde=rev-sorties;
  // Transactions du mois pour les KPI réels
  const monthTx=getMonthTx();
  const txEntrees=monthTx.filter(t=>t.type==='entree').reduce((s,t)=>s+t.amount,0);
  const txSorties=monthTx.filter(t=>t.type==='sortie').reduce((s,t)=>s+t.amount,0);
  const hasTx=monthTx.length>0;

  // KPI — prévisionnel si pas de transactions, réel sinon
  set('kpi-rev',fmt(hasTx?txEntrees:rev));
  set('kpi-rev-hint',hasTx?'Transactions saisies ce mois':'Budget prévisionnel');
  // FIXÉ : "Charges" = charges uniquement, PAS l'épargne
  set('kpi-dep',fmt(hasTx?txSorties:charges));
  set('kpi-dep-hint',hasTx?'Sorties réelles ce mois':'Prévisionnel · hors épargne');
  set('kpi-save',fmt(save));
  set('kpi-save-hint',rev>0?Math.round(save/rev*100)+'% du revenu prévisionnel':'—');
  // FIXÉ : solde = réel si transactions, sinon prévisionnel
  const soldeAff=hasTx?(txEntrees-txSorties):solde;
  set('kpi-solde',(soldeAff<0?'- ':'')+fmt(soldeAff));
  set('kpi-solde-hint',hasTx?'Solde réel du mois':'Budget prévisionnel');
  const sc=$('kpi-solde-card');
  if(sc) sc.className='kpi '+(soldeAff>=0?'kpi-grad-green':'kpi-grad-red');

  // Label mode prévisionnel/réel
  const modeEl=$('dash-mode-badge');
  if(modeEl){modeEl.textContent=hasTx?'Données réelles':'Prévisionnel';modeEl.style.background=hasTx?'rgba(46,203,161,0.15)':'rgba(255,193,7,0.15)';modeEl.style.color=hasTx?'#2ECBA1':'#FFC107';}

  // Bar chart — Budget prévisionnel structuré
  updateChart('chart-overview','bar',{
    labels:['Revenus','Charges','Épargne','Solde'],
    datasets:[{
      data:[Math.round(rev),Math.round(charges),Math.round(save),Math.max(0,Math.round(solde))],
      backgroundColor:['#2ECBA1','#FF6B6B','#8E54E9',solde>=0?'#4F8EF7':'#7B7A8E'],
      borderRadius:7,borderSkipped:false,borderWidth:0
    }]
  },{
    plugins:{legend:{display:false}},
    scales:{
      x:{grid:{display:false},ticks:{color:'#7B7A8E',font:{size:11,family:"'Plus Jakarta Sans'"}}},
      y:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{callback:v=>v.toLocaleString('fr-FR')+' €',color:'#7B7A8E',font:{size:10}}}
    }
  });

  // Pie répartition
  const cats=[
    {l:'Dîme',c:'#C084FC',v:getDime()},{l:'Impôts',c:'#FFC107',v:getProv()},
    {l:'Loyer',c:'#4F8EF7',v:getN('inp-loyer')},{l:'Transport',c:'#2ECBA1',v:getN('inp-transport')},
    {l:'Santé',c:'#FF6B9D',v:getN('inp-sante')},
    ...S.abonnements.map(a=>({l:a.label,c:a.color,v:a.amount})),
    {l:'Alimentation',c:'#FF8C42',v:getN('inp-alim')},{l:'Loisirs',c:'#FF6B6B',v:getN('inp-loisirs')},
    {l:'Vêtements',c:'#63D68D',v:getN('inp-shopping')},{l:'Divers',c:'#7B7A8E',v:getN('inp-divers')},
  ].filter(c=>c.v>0);

  updateChart('chart-pie-dash','doughnut',{
    labels:cats.map(c=>c.l),
    datasets:[{data:cats.map(c=>Math.round(c.v)),backgroundColor:cats.map(c=>c.c),borderWidth:0}]
  },{plugins:{legend:{display:false}},cutout:'60%'});

  const dl=$('dash-pie-legend');
  if(dl){dl.innerHTML='';cats.slice(0,6).forEach(c=>{const d=document.createElement('div');d.className='legend-item';d.innerHTML=`<span class="legend-dot" style="background:${c.c}"></span><span style="flex:1">${c.l}</span><span style="font-family:var(--font-mono);font-size:11px;color:var(--c-muted)">${fmt(c.v)}</span>`;dl.appendChild(d);});}

  // Transactions récentes
  const dtl=$('dash-tx-list');
  if(dtl){
    if(!monthTx.length){dtl.innerHTML='<div class="empty" style="padding:20px 0">Aucune transaction ce mois.<br><span style="font-size:11px;opacity:.6">Va dans Transactions pour en saisir.</span></div>';}
    else{
      dtl.innerHTML='';
      [...monthTx].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,8).forEach(t=>{
        const d=document.createElement('div');d.className='tx-mini';
        const col=t.type==='entree'?'#2ECBA1':'#FF6B8A',sign=t.type==='entree'?'+':'-';
        const ds=new Date(t.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'});
        d.innerHTML=`<span style="width:8px;height:8px;border-radius:50%;background:${CAT_COLORS[t.cat]||'#7B7A8E'};flex-shrink:0;display:inline-block"></span>
          <span style="flex:1">${t.label}</span>
          <span style="font-size:11px;color:var(--c-muted)">${t.cat}</span>
          <span style="font-size:11px;color:var(--c-muted);min-width:32px;text-align:right">${ds}</span>
          <span style="color:${col};font-weight:700;font-family:var(--font-mono);font-size:12px;min-width:68px;text-align:right">${sign}${fmt(t.amount)}</span>`;
        dtl.appendChild(d);
      });
    }
  }

  // Santé budgétaire
  const loyerPct=rev>0?Math.round(getN('inp-loyer')/rev*100):0;
  // FIXÉ : taux épargne inclut dîme si > 0 (engagement financier)
  const savePct=rev>0?Math.round(save/rev*100):0;
  const dimePct=rev>0?Math.round(getDime()/rev*100):0;
  const engagePct=savePct+dimePct;
  const hl=$('health-list');
  if(hl){
    const items=[
      {l:'Loyer / revenu',v:loyerPct+'%',ok:loyerPct<=33,warn:loyerPct<=40,hint:loyerPct<=33?'Optimal (≤33%)':loyerPct<=40?'Limite':'Élevé !'},
      {l:'Taux d\'épargne',v:savePct+'%',ok:savePct>=15,warn:savePct>=10,hint:'Objectif : 15-20%'},
      {l:'Engagement total',v:engagePct+'%',ok:engagePct>=20,warn:engagePct>=12,hint:'Épargne + dîme'},
      {l:'Budget',v:solde>=0?'+'+fmt(solde):'-'+fmt(solde),ok:solde>=0,warn:solde>=-100,hint:solde>=0?'Équilibré ✓':'Dépassement'},
    ];
    hl.innerHTML='';
    items.forEach(i=>{
      const st=i.ok?'ok':i.warn?'warn':'bad';
      const bg={ok:'rgba(46,203,161,0.09)',warn:'rgba(255,193,7,0.09)',bad:'rgba(255,65,108,0.09)'}[st];
      const col={ok:'#2ECBA1',warn:'#FFC107',bad:'#FF6B8A'}[st];
      const d=document.createElement('div');d.className='health-item';d.style.background=bg;
      d.innerHTML=`<div><div style="font-size:12px;font-weight:600;color:${col}">${i.l}</div><div style="font-size:11px;color:${col};opacity:0.7;margin-top:2px">${i.hint}</div></div><div style="font-size:15px;font-weight:700;color:${col};font-family:var(--font-mono)">${i.v}</div>`;
      hl.appendChild(d);
    });
  }
}

// ─── CHART HELPER ─────────────────────────────────────────────────────────────
function updateChart(id,type,data,opts={}) {
  const canvas=$(id); if(!canvas)return;
  if(charts[id])charts[id].destroy();
  charts[id]=new Chart(canvas,{type,data,options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},...opts.plugins},...opts}});
}

// ─── PATRIMOINE ───────────────────────────────────────────────────────────────
function renderPatrimoine() {
  const total=S.comptes.reduce((s,c)=>s+c.amount,0);
  const libre=S.comptes.filter(c=>c.type==='free').reduce((s,c)=>s+c.amount,0);
  const res=S.comptes.filter(c=>c.type==='res').reduce((s,c)=>s+c.amount,0);
  const lock=S.comptes.filter(c=>c.type==='lock').reduce((s,c)=>s+c.amount,0);
  set('pat-total',fmtD(total)); set('pat-libre',fmtD(libre)); set('pat-locked',fmtD(res+lock));
  // FIXÉ : détail Réservé / Intouchable séparé
  set('pat-reserved',fmtD(res)); set('pat-intouchable',fmtD(lock));

  const list=$('pat-list'); if(!list)return; list.innerHTML='';
  S.comptes.forEach(c=>{
    const d=document.createElement('div');d.className='pat-row';
    const typeColor={free:'#2ECBA1',res:'#FFC107',lock:'#8E54E9'}[c.type]||'#7B7A8E';
    d.innerHTML=`<input class="inp" type="text" value="${c.label}" onchange="updateCompte(${c.id},'label',this.value)" aria-label="Nom">
      <input class="inp inp-r" type="number" value="${c.amount}" min="0" step="0.01" onchange="updateCompte(${c.id},'amount',this.value)" aria-label="Montant">
      <select class="sel" onchange="updateCompte(${c.id},'type',this.value)" style="border-left:2px solid ${typeColor}" aria-label="Statut">
        <option value="free" ${c.type==='free'?'selected':''}>Libre</option>
        <option value="res" ${c.type==='res'?'selected':''}>Réservé</option>
        <option value="lock" ${c.type==='lock'?'selected':''}>Intouchable</option>
      </select>
      <button class="btn-del" onclick="removeCompte(${c.id})" aria-label="Supprimer">×</button>`;
    list.appendChild(d);
  });

  const cats=[
    {l:'Libre',v:libre,c:'#2ECBA1'},{l:'Réservé',v:res,c:'#FFC107'},{l:'Intouchable',v:lock,c:'#8E54E9'}
  ].filter(c=>c.v>0);
  const canvas=$('chart-patrimoine');
  if(canvas){
    if(charts['chart-patrimoine'])charts['chart-patrimoine'].destroy();
    charts['chart-patrimoine']=new Chart(canvas,{type:'doughnut',data:{labels:cats.map(c=>c.l),datasets:[{data:cats.map(c=>Math.round(c.v)),backgroundColor:cats.map(c=>c.c),borderWidth:0}]},options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{display:false}},cutout:'58%'}});
    const leg=$('pat-legend');if(leg)leg.innerHTML=cats.map(c=>`<div class="legend-item"><span class="legend-dot" style="background:${c.c}"></span><span style="flex:1">${c.l}</span><span style="font-family:var(--font-mono);font-size:11px;color:var(--c-muted)">${fmtD(c.v)}</span></div>`).join('');
  }
}
function updateCompte(id,f,v){const c=S.comptes.find(c=>c.id===id);if(!c)return;c[f]=f==='amount'?Math.max(0,parseFloat(v)||0):v;renderPatrimoine();scheduleSave();}
function removeCompte(id){S.comptes=S.comptes.filter(c=>c.id!==id);renderPatrimoine();scheduleSave();}
function addCompte(){
  const lbl=$('pat-new-label').value.trim(),amt=Math.max(0,parseFloat($('pat-new-amount').value)||0),type=$('pat-new-type').value;
  if(!lbl){toast('Saisis un nom de compte.','error');$('pat-new-label').style.borderColor='#FF416C';setTimeout(()=>$('pat-new-label').style.borderColor='',2000);return;}
  S.comptes.push({id:Date.now(),label:lbl,amount:amt,type});
  $('pat-new-label').value='';$('pat-new-amount').value='';
  renderPatrimoine();scheduleSave();
}

// ─── REVENUS ──────────────────────────────────────────────────────────────────
function addRevenu(){
  const lbl=$('rev-label').value.trim(),amt=parseFloat($('rev-amount').value)||0;
  if(!lbl||amt<=0){toast('Remplis le libellé et le montant.','error');return;}
  S.revenuItems.push({id:Date.now(),label:lbl,amount:amt});
  $('rev-label').value='';$('rev-amount').value='';
  renderRevList();updateAll();
}
function removeRevenu(id){S.revenuItems=S.revenuItems.filter(e=>e.id!==id);renderRevList();updateAll();}
function renderRevList(){
  const list=$('rev-list');if(!list)return;list.innerHTML='';
  S.revenuItems.forEach(e=>{
    const d=document.createElement('div');d.className='field-row';
    d.innerHTML=`<label><span class="dot-col" style="background:#2ECBA1"></span>${e.label}</label>
      <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px">
        <span style="font-family:var(--font-mono);font-size:13px">${fmt(e.amount)}</span>
        <button class="btn-del" onclick="removeRevenu(${e.id})" aria-label="Supprimer">×</button>
      </div>`;
    list.appendChild(d);
  });
}

// ─── ABONNEMENTS ─────────────────────────────────────────────────────────────
function addAbonnement(){
  const lbl=$('abo-new-label').value.trim(),amt=parseFloat($('abo-new-amount').value)||0;
  if(!lbl||amt<=0){toast('Remplis le libellé et le montant.','error');return;}
  S.abonnements.push({id:Date.now(),label:lbl,amount:amt,color:PALETTE[S.abonnements.length%PALETTE.length]});
  $('abo-new-label').value='';$('abo-new-amount').value='';
  renderAboList();updateAll();
}
function removeAbonnement(id){S.abonnements=S.abonnements.filter(a=>a.id!==id);renderAboList();updateAll();}
function updateAbo(id,v){const a=S.abonnements.find(a=>a.id===id);if(a){a.amount=Math.max(0,parseFloat(v)||0);updateAll();}}
function renderAboList(){
  const list=$('abo-list');if(!list)return;list.innerHTML='';
  S.abonnements.forEach(a=>{
    const d=document.createElement('div');d.className='field-row';
    d.innerHTML=`<label><span class="dot-col" style="background:${a.color}"></span>${a.label}</label>
      <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px">
        <input class="inp inp-r" style="width:90px" type="number" value="${a.amount}" min="0" step="0.01" oninput="updateAbo(${a.id},this.value)" aria-label="Montant">
        <button class="btn-del" onclick="removeAbonnement(${a.id})" aria-label="Supprimer">×</button>
      </div>`;
    list.appendChild(d);
  });
}

// ─── RÉPARTITION ─────────────────────────────────────────────────────────────
const RPART=[{key:'charges',label:'Charges fixes & dîme',color:'#4F8EF7'},{key:'variable',label:'Vie courante',color:'#FF8C42'},{key:'epargne',label:'Épargne',color:'#2ECBA1'}];
function renderRepartition(){
  const list=$('rpart-list');if(!list)return;
  const rev=getRevTotal();let tot=0;list.innerHTML='';
  RPART.forEach(r=>{
    const pct=S.repartPcts[r.key]||0;tot+=pct;
    const euros=Math.round(rev*pct/100);
    const d=document.createElement('div');d.className='rpart-row';
    d.innerHTML=`<div style="display:flex;align-items:center;gap:8px;font-size:13px"><span class="dot-col" style="background:${r.color}"></span>${r.label}</div>
      <input class="inp inp-r" type="number" value="${pct}" min="0" max="100" step="1" oninput="updateRepartPct('${r.key}',this.value)" aria-label="${r.label}">
      <span style="font-size:12px;font-family:var(--font-mono);text-align:right;color:var(--c-muted)">${fmt(euros)}</span>`;
    list.appendChild(d);
  });
  const tp=$('rpart-total');if(tp){tp.textContent=tot+'%';tp.style.color=tot===100?'#2ECBA1':tot>100?'#FF6B8A':'#FFC107';}
}
function updateRepartPct(key,v){S.repartPcts[key]=Math.max(0,parseInt(v)||0);renderRepartition();scheduleSave();}

// ─── CHARGES PIE ─────────────────────────────────────────────────────────────
function renderChargesPie(){
  const cats=[
    {l:'Dîme ('+getDimePct()+'%)',c:'#C084FC',v:getDime()},{l:'Impôts',c:'#FFC107',v:getProv()},
    {l:'Loyer',c:'#4F8EF7',v:getN('inp-loyer')},{l:'Transport',c:'#2ECBA1',v:getN('inp-transport')},
    {l:'Santé',c:'#FF6B9D',v:getN('inp-sante')},
    ...S.abonnements.map(a=>({l:a.label,c:a.color,v:a.amount})),
    {l:'Alimentation',c:'#FF8C42',v:getN('inp-alim')},{l:'Loisirs',c:'#FF6B6B',v:getN('inp-loisirs')},
    {l:'Vêtements',c:'#63D68D',v:getN('inp-shopping')},{l:'Divers',c:'#7B7A8E',v:getN('inp-divers')},
  ].filter(c=>c.v>0);
  const canvas=$('chart-charges');
  if(canvas){
    if(charts['chart-charges'])charts['chart-charges'].destroy();
    charts['chart-charges']=new Chart(canvas,{type:'doughnut',data:{labels:cats.map(c=>c.l),datasets:[{data:cats.map(c=>Math.round(c.v)),backgroundColor:cats.map(c=>c.c),borderWidth:0}]},options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{display:false}},cutout:'58%'}});
    const leg=$('charges-legend');if(leg){leg.innerHTML='';cats.forEach(c=>{const d=document.createElement('div');d.className='legend-item';d.innerHTML=`<span class="legend-dot" style="background:${c.c}"></span><span style="flex:1">${c.l}</span><span style="font-family:var(--font-mono);font-size:11px;color:var(--c-muted)">${fmt(c.v)}</span>`;leg.appendChild(d);});}
  }
}

// ─── ÉPARGNE ─────────────────────────────────────────────────────────────────
function addCustomSave(){
  const lbl=$('csave-label').value.trim(),monthly=parseFloat($('csave-amount').value)||0;
  if(!lbl||monthly<=0){toast('Remplis le libellé et le montant.','error');return;}
  S.customSaves.push({id:Date.now(),label:lbl,monthly,goal:0,current:0,color:PALETTE[S.customSaves.length%PALETTE.length]});
  $('csave-label').value='';$('csave-amount').value='';
  renderCustomSaveList();renderGoals();updateAll();
}
function removeCustomSave(id){S.customSaves=S.customSaves.filter(c=>c.id!==id);renderCustomSaveList();renderGoals();updateAll();}
function renderCustomSaveList(){
  const list=$('custom-save-list');if(!list)return;list.innerHTML='';
  S.customSaves.forEach(c=>{
    const d=document.createElement('div');d.className='field-row';
    d.innerHTML=`<label><span class="dot-col" style="background:${c.color}"></span>${c.label}</label>
      <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px">
        <input class="inp inp-r" style="width:90px" type="number" value="${c.monthly}" min="0" step="1" oninput="updateCSave(${c.id},'monthly',this.value)" aria-label="Mensuel">
        <button class="btn-del" onclick="removeCustomSave(${c.id})" aria-label="Supprimer">×</button>
      </div>`;
    list.appendChild(d);
  });
}
function updateCSave(id,f,v){
  const c=S.customSaves.find(c=>c.id===id);if(!c)return;
  c[f]=Math.max(0,parseFloat(v)||0);
  if(f==='monthly') updateAll(); else renderGoals();
  scheduleSave();
}
function renderGoals(){
  const ge=$('goals-empty'),gl=$('goals-list');if(!ge||!gl)return;
  ge.style.display=S.customSaves.length?'none':'';gl.innerHTML='';
  S.customSaves.forEach(c=>{
    const restant=Math.max(0,(c.goal||0)-(c.current||0));
    const months=c.monthly>0&&c.goal>0?Math.ceil(restant/c.monthly):0;
    const pct=c.goal>0?Math.min(Math.round((c.current||0)/c.goal*100),100):0;
    const dateStr=months>0?(()=>{const dt=new Date();dt.setMonth(dt.getMonth()+months);return dt.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});})():'—';
    const d=document.createElement('div');d.className='goal-card';
    d.innerHTML=`<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <span style="width:10px;height:10px;border-radius:50%;background:${c.color};flex-shrink:0;display:inline-block"></span>
        <span style="font-size:14px;font-weight:600;flex:1">${c.label}</span>
        <button class="btn-del" onclick="removeCustomSave(${c.id})" aria-label="Supprimer">×</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:10px">
        <div><div style="font-size:10px;color:var(--c-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">Objectif</div>
          <input class="inp inp-r" style="font-size:13px" type="number" placeholder="0" value="${c.goal||''}" min="0" oninput="updateCSave(${c.id},'goal',this.value)"></div>
        <div><div style="font-size:10px;color:var(--c-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">/ mois</div>
          <input class="inp inp-r" style="font-size:13px" type="number" value="${c.monthly}" min="0" oninput="updateCSave(${c.id},'monthly',this.value)"></div>
        <div><div style="font-size:10px;color:var(--c-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">Déjà épargné</div>
          <input class="inp inp-r" style="font-size:13px" type="number" placeholder="0" value="${c.current||''}" min="0" oninput="updateCSave(${c.id},'current',this.value)"></div>
        <div><div style="font-size:10px;color:var(--c-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">Atteint en</div>
          <div style="font-size:13px;font-weight:700;color:#2ECBA1;padding:9px 0 0">${months>0?months+' mois':c.goal>0&&(c.current||0)>=c.goal?'✓ Atteint':'—'}</div></div>
      </div>
      ${c.goal>0?`<div class="prog-bar"><div class="prog-fill" style="width:${pct}%;background:${c.color}"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--c-muted)">
          <span>${fmt(c.current||0)} sur ${fmt(c.goal)} · ${pct}%</span>
          <span style="color:${c.color}">${dateStr}</span>
        </div>`:''}`;
    gl.appendChild(d);
  });
}

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
const getMonthTx=()=>S.transactions.filter(t=>{const d=new Date(t.date);return d.getMonth()===curMonth&&d.getFullYear()===curYear;});

function addTransaction(){
  const lbl=$('tx-label-inp').value.trim(),amt=parseFloat($('tx-amount-inp').value)||0;
  if(!lbl||amt<=0){
    if(!lbl){$('tx-label-inp').style.borderColor='#FF416C';setTimeout(()=>$('tx-label-inp').style.borderColor='',2000);}
    if(amt<=0){$('tx-amount-inp').style.borderColor='#FF416C';setTimeout(()=>$('tx-amount-inp').style.borderColor='',2000);}
    toast('Remplis le libellé et le montant.','error');return;
  }
  const type=$('tx-type-inp').value,cat=$('tx-cat-inp').value;
  const date=$('tx-date-inp').value||new Date().toISOString().split('T')[0];
  S.transactions.push({id:Date.now(),label:lbl,amount:amt,type,cat,date});
  $('tx-label-inp').value='';$('tx-amount-inp').value='';
  renderTransactions();renderDashboard();scheduleSave();
}
function removeTransaction(id){S.transactions=S.transactions.filter(t=>t.id!==id);renderTransactions();renderDashboard();scheduleSave();}

function renderTransactions(){
  set('tx-month-label',MONTHS[curMonth]+' '+curYear);
  const ft=$('filter-type')?.value||'all',fc=$('filter-cat')?.value||'all';
  const monthTx=getMonthTx();
  const filtered=monthTx.filter(t=>(ft==='all'||t.type===ft)&&(fc==='all'||t.cat===fc));
  const entrees=monthTx.filter(t=>t.type==='entree').reduce((s,t)=>s+t.amount,0);
  const sorties=monthTx.filter(t=>t.type==='sortie').reduce((s,t)=>s+t.amount,0);
  const solde=entrees-sorties;
  set('tx-entrees',fmt(entrees)); set('tx-sorties',fmt(sorties));
  const ts=$('tx-solde');
  if(ts){ts.textContent=(solde<0?'- ':'+')+fmt(solde);ts.style.color=solde>=0?'#2ECBA1':'#FF6B8A';}
  set('tx-count',monthTx.length);

  // Distrib bars
  const catTotals={};
  monthTx.filter(t=>t.type==='sortie').forEach(t=>{catTotals[t.cat]=(catTotals[t.cat]||0)+t.amount;});
  const db=$('distrib-bars');
  if(db){
    const entries=Object.entries(catTotals).sort((a,b)=>b[1]-a[1]);
    if(!entries.length){db.innerHTML='<div class="empty">Aucune sortie ce mois</div>';}
    else{
      db.innerHTML='';const maxV=Math.max(...entries.map(e=>e[1]));
      entries.forEach(([cat,val])=>{
        const p=Math.round(val/sorties*100);
        const d=document.createElement('div');d.className='dbar';
        d.innerHTML=`<span style="width:8px;height:8px;border-radius:50%;background:${CAT_COLORS[cat]||'#7B7A8E'};flex-shrink:0"></span>
          <span class="dbar-label">${cat}</span>
          <div class="dbar-bg"><div class="dbar-fill" style="width:${Math.round(val/maxV*100)}%;background:${CAT_COLORS[cat]||'#7B7A8E'}"></div></div>
          <span class="dbar-pct">${p}%</span><span class="dbar-amt">${fmt(val)}</span>`;
        db.appendChild(d);
      });
    }
  }

  // Pie
  const txPie=$('chart-tx-pie');
  if(txPie){
    const entries2=Object.entries(catTotals).sort((a,b)=>b[1]-a[1]);
    if(charts['chart-tx-pie'])charts['chart-tx-pie'].destroy();
    if(entries2.length){charts['chart-tx-pie']=new Chart(txPie,{type:'doughnut',data:{labels:entries2.map(e=>e[0]),datasets:[{data:entries2.map(e=>Math.round(e[1])),backgroundColor:entries2.map(e=>CAT_COLORS[e[0]]||'#7B7A8E'),borderWidth:0}]},options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{display:false}},cutout:'58%'}});}
    const leg=$('tx-pie-legend');if(leg){leg.innerHTML='';entries2.slice(0,5).forEach(([cat,val])=>{const p=sorties>0?Math.round(val/sorties*100):0;const d=document.createElement('div');d.className='legend-item';d.innerHTML=`<span class="legend-dot" style="background:${CAT_COLORS[cat]||'#7B7A8E'}"></span><span style="flex:1">${cat}</span><span style="font-family:var(--font-mono);font-size:11px;color:var(--c-muted)">${p}%</span>`;leg.appendChild(d);});}
  }

  // Category filter
  const fcEl=$('filter-cat');
  if(fcEl){
    const cats=[...new Set(S.transactions.map(t=>t.cat))],cur=fcEl.value;
    fcEl.innerHTML='<option value="all">Toutes catégories</option>';
    cats.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;fcEl.appendChild(o);});
    fcEl.value=cats.includes(cur)?cur:'all';
  }

  // List
  const list=$('tx-list');
  if(list){
    if(!filtered.length){list.innerHTML='<div class="empty">Aucune transaction — commence à saisir !</div>';return;}
    list.innerHTML='';
    [...filtered].sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(t=>{
      const sign=t.type==='entree'?'+':'-',col=t.type==='entree'?'#2ECBA1':'#FF6B8A';
      const ds=new Date(t.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'});
      const d=document.createElement('div');d.className='tx-row';
      d.innerHTML=`<span style="width:8px;height:8px;border-radius:50%;background:${CAT_COLORS[t.cat]||'#7B7A8E'};display:inline-block"></span>
        <span style="font-size:13px">${t.label}</span>
        <span style="font-size:11px;color:var(--c-muted)">${t.cat}</span>
        <span style="font-size:11px;color:var(--c-muted);text-align:right">${ds}</span>
        <span style="font-size:13px;font-weight:700;color:${col};text-align:right;font-family:var(--font-mono)">${sign}${fmt(t.amount)}</span>
        <button class="btn-del" onclick="removeTransaction(${t.id})" aria-label="Supprimer">×</button>`;
      list.appendChild(d);
    });
  }
}


// ─── MOBILE SIDEBAR ───────────────────────────────────────────────────────────
function toggleSidebar() {
  const s = document.querySelector('.sidebar');
  const o = $('sidebar-overlay');
  const isOpen = s.classList.contains('open');
  if (isOpen) closeSidebar();
  else { s.classList.add('open'); if(o) o.classList.add('show'); document.body.style.overflow='hidden'; }
}
function closeSidebar() {
  const s = document.querySelector('.sidebar');
  const o = $('sidebar-overlay');
  s.classList.remove('open');
  if(o) o.classList.remove('show');
  document.body.style.overflow='';
}
function mnavActive(btn) {
  document.querySelectorAll('.mnav-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',async()=>{
  $('modal-confirm-btn').onclick=()=>{if(_modalCb)_modalCb();};
  const {data:{session}}=await sb.auth.getSession();
  if(session?.user) await showApp(session.user);
  sb.auth.onAuthStateChange(async(event,session)=>{
    if(event==='SIGNED_IN'&&session?.user&&!currentUser) await showApp(session.user);
    else if(event==='SIGNED_OUT'){currentUser=null;S=DEFAULT_STATE();$('auth-screen').style.display='';$('app').style.display='none';}
  });
});
