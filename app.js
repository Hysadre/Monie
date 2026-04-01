// ═══ SUPABASE ═══════════════════════════════════════════════════════════════
const SURL='https://stkktwlxzgmxxxnmipfg.supabase.co';
const SKEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0a2t0d2x4emdteHh4bm1pcGZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjk0MzcsImV4cCI6MjA5MDY0NTQzN30.HBSfJA-Yw7gteumgLkJEvs4KDwSTJQp49rNyKtrqZJY';
const sb=supabase.createClient(SURL,SKEY);
// ═══ STATE ═══════════════════════════════════════════════════════════════════
let user=null,saveTimer=null,charts={};
let curM=new Date().getMonth(),curY=new Date().getFullYear();
let S={salaire:2295.77,tr:216.14,loyer:590,transport:90,alim:200,loisirs:80,shopping:40,divers:30,matelas:150,invest:50,frere:100,voyage:60,cushionGoal:3000,cushionCurrent:0,repartPcts:{charges:50,variable:30,epargne:20},revenuItems:[],transactions:[],customSaves:[],abonnements:[],comptes:[]};
const MO=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const COL={'Alimentation':'#F59E0B','Loyer & charges':'#6366F1','Transport':'#22D3EE','Santé':'#EC4899','Loisirs':'#F97316','Vêtements':'#10B981','Épargne':'#34D399','Salaire':'#34D399','Dîme':'#C44FD6','Tickets restaurant':'#A78BFA','Autre':'#94A3B8'};
const ACOL=['#6366F1','#22D3EE','#F97316','#EC4899','#10B981','#F59E0B','#C44FD6','#94A3B8'];
const SCOL=['#10B981','#6366F1','#F43F5E','#EC4899','#F59E0B','#22D3EE','#C44FD6','#94A3B8'];
// ═══ UTILS ═══════════════════════════════════════════════════════════════════
const $=id=>document.getElementById(id);
const fmt=n=>Math.round(Math.abs(n)).toLocaleString('fr-FR')+' €';
const fmtD=n=>parseFloat(Math.abs(n).toFixed(2)).toLocaleString('fr-FR',{minimumFractionDigits:2})+' €';
const set=(id,v)=>{const e=$(id);if(e)e.textContent=v;};
const getInp=id=>parseFloat($(id)?.value)||0;
function toast(msg){const t=$('toast');if(!t)return;t.textContent=msg;t.className='toast show';setTimeout(()=>t.classList.remove('show'),2800);}
function setSave(s){const d=$('save-dot');if(d)d.className='save-dot'+(s?' saving':'');}
// ═══ AUTH ════════════════════════════════════════════════════════════════════
function switchAuthTab(tab){
  $('aform-login').style.display=tab==='login'?'':'none';
  $('aform-signup').style.display=tab==='signup'?'':'none';
  $('atab-login').classList.toggle('active',tab==='login');
  $('atab-signup').classList.toggle('active',tab==='signup');
}
async function login(){
  const email=$('login-email')?.value.trim(),pw=$('login-password')?.value;
  const err=$('login-error');if(err)err.className='form-err';
  if(!email||!pw){if(err){err.textContent='Remplis tous les champs.';err.classList.add('show');}return;}
  const btn=$('login-btn');if(btn)btn.textContent='Connexion…';
  const{error}=await sb.auth.signInWithPassword({email,password:pw});
  if(btn)btn.textContent='Se connecter →';
  if(error&&err){err.textContent=error.message==='Invalid login credentials'?'Email ou mot de passe incorrect.':error.message;err.classList.add('show');}
}
async function signup(){
  const email=$('signup-email')?.value.trim(),pw=$('signup-password')?.value,co=$('signup-confirm')?.value;
  const err=$('signup-error');if(err)err.className='form-err';
  if(!email||!pw){if(err){err.textContent='Remplis tous les champs.';err.classList.add('show');}return;}
  if(pw.length<6){if(err){err.textContent='Mot de passe trop court (min. 6 chars).';err.classList.add('show');}return;}
  if(pw!==co){if(err){err.textContent='Les mots de passe ne correspondent pas.';err.classList.add('show');}return;}
  const{error}=await sb.auth.signUp({email,password:pw});
  if(error&&err){err.textContent=error.message;err.classList.add('show');}
  else if(err){err.style.color='#34D399';err.textContent='Compte créé ! Tu peux te connecter.';err.classList.add('show');}
}
async function logout(){
  await sb.auth.signOut();user=null;
  resetS();
  const a=$('app'),au=$('auth-screen');
  if(a)a.style.display='none';if(au)au.style.display='';
  toast('Déconnecté');
}
// ═══ BOOT ════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded',async()=>{
  const{data:{session}}=await sb.auth.getSession();
  if(session?.user)await onLogin(session.user);
  sb.auth.onAuthStateChange(async(ev,session)=>{
    if(ev==='SIGNED_IN'&&session?.user&&!user)await onLogin(session.user);
    else if(ev==='SIGNED_OUT'){user=null;}
  });
});
async function onLogin(u){
  user=u;
  const au=$('auth-screen'),ap=$('app');
  if(au)au.style.display='none';
  if(ap)ap.style.display='flex';
  const av=$('u-avatar');if(av)av.textContent=u.email[0].toUpperCase();
  set('u-email',u.email);
  await loadFromSupabase();
  initUI();
}
function initUI(){
  const di=$('tx-date');if(di)di.value=new Date().toISOString().split('T')[0];
  updateML();applyInputs();
  renderAboList();renderRevList();renderCustomSaveList();renderGoals();
  renderPatrimoine();updateAll();renderDashboard();
}
function updateML(){const ml=MO[curM]+' '+curY;set('mnav-label',ml);set('dash-badge',ml);}
// ═══ SUPABASE DATA ════════════════════════════════════════════════════════════
async function loadFromSupabase(){
  if(!user)return;
  const{data,error}=await sb.from('budgets').select('data').eq('user_id',user.id).single();
  if(error||!data){initDefaultC();return;}
  applyState(data.data);
}
function scheduleSave(){
  setSave(true);clearTimeout(saveTimer);
  saveTimer=setTimeout(async()=>{
    if(!user)return;
    await sb.from('budgets').upsert({user_id:user.id,data:buildPayload()},{onConflict:'user_id'});
    setSave(false);
  },1500);
}
function buildPayload(){
  return{
    salaire:getInp('inp-salaire')||S.salaire,tr:getInp('inp-tr')||S.tr,
    inputs:['loyer','transport','alim','loisirs','shopping','divers','matelas','invest','frere','voyage'].reduce((o,id)=>{o[id]=getInp('inp-'+id);return o;},{}),
    cushionGoal:parseFloat($('cushion-goal')?.value)||S.cushionGoal,
    cushionCurrent:parseFloat($('cushion-current')?.value)||S.cushionCurrent,
    repartPcts:S.repartPcts,revenuItems:S.revenuItems,transactions:S.transactions,
    customSaves:S.customSaves,abonnements:S.abonnements,comptes:S.comptes,
    _v:'monie-1',_at:new Date().toISOString()
  };
}
function applyState(d){
  if(!d){initDefaultC();return;}
  S.revenuItems=d.revenuItems||[];S.transactions=d.transactions||[];
  S.customSaves=d.customSaves||[];S.abonnements=d.abonnements||[];
  S.comptes=d.comptes?.length>0?d.comptes:null;
  S.repartPcts=d.repartPcts||{charges:50,variable:30,epargne:20};
  if(!S.comptes)initDefaultC();
  if(d.salaire)S.salaire=d.salaire;if(d.tr)S.tr=d.tr;
  if(d.cushionGoal)S.cushionGoal=d.cushionGoal;
  if(d.cushionCurrent!==undefined)S.cushionCurrent=d.cushionCurrent;
  if(d.inputs){['loyer','transport','alim','loisirs','shopping','divers','matelas','invest','frere','voyage'].forEach(id=>{if(d.inputs[id]!==undefined)S['_'+id]=d.inputs[id];});}
}
function applyInputs(){
  const map={salaire:S.salaire,tr:S.tr,'cushion-goal':S.cushionGoal,'cushion-current':S.cushionCurrent};
  Object.entries(map).forEach(([k,v])=>{
    const id=k==='salaire'?'inp-salaire':k==='tr'?'inp-tr':k;
    const el=$(id);if(el&&v)el.value=v;
  });
  ['loyer','transport','alim','loisirs','shopping','divers','matelas','invest','frere','voyage'].forEach(id=>{
    const el=$('inp-'+id);if(el&&S['_'+id]!==undefined)el.value=S['_'+id];
  });
}
function resetS(){S={salaire:2295.77,tr:216.14,loyer:590,transport:90,alim:200,loisirs:80,shopping:40,divers:30,matelas:150,invest:50,frere:100,voyage:60,cushionGoal:3000,cushionCurrent:0,repartPcts:{charges:50,variable:30,epargne:20},revenuItems:[],transactions:[],customSaves:[],abonnements:[],comptes:[]};}
function initDefaultC(){S.comptes=[{id:1,label:'LCL',amount:215.91,type:'free'},{id:2,label:'Espèces',amount:3290,type:'free'},{id:3,label:'Boursobank (URSSAF/impôts)',amount:1992.34,type:'res'},{id:4,label:'Esalia (SG)',amount:613.75,type:'lock'},{id:5,label:'Banque Postale (assurance vie)',amount:2483.88,type:'lock'}];}
// ═══ EXPORT / IMPORT ══════════════════════════════════════════════════════════
function exportData(){
  const blob=new Blob([JSON.stringify(buildPayload(),null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download='monie_data.json';document.body.appendChild(a);a.click();
  document.body.removeChild(a);URL.revokeObjectURL(url);toast('Données exportées !');
}
function importData(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=async e=>{
    try{
      const raw=JSON.parse(e.target.result);
      if(raw.transactions)raw.transactions=raw.transactions.map(t=>({...t,source:t.source||'import',id:t.id||Date.now()+Math.random()}));
      applyState(raw);applyInputs();
      renderAboList();renderRevList();renderCustomSaveList();renderGoals();
      renderPatrimoine();updateAll();renderDashboard();
      scheduleSave();
      toast('Import réussi — '+(raw.transactions?.length||0)+' transactions');
    }catch{toast('Erreur import');}
  };
  reader.readAsText(file);input.value='';
}
// ═══ NAV ═════════════════════════════════════════════════════════════════════
function showTab(name){
  document.querySelectorAll('.tp').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.nb').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
  const tp=$('tab-'+name);if(tp)tp.classList.add('active');
  const T={dashboard:'Dashboard',transactions:'Transactions',patrimoine:'Patrimoine',budget:'Budget',revenus:'Revenus',epargne:'Épargne'};
  set('topbar-title',T[name]||name);
  if(name==='dashboard')renderDashboard();
  if(name==='transactions')renderTransactions();
  if(name==='patrimoine')renderPatrimoine();
  if(name==='budget'){renderBudgetBars();renderRepartition();}
}
function changeMonth(dir){
  curM+=dir;if(curM>11){curM=0;curY++;}if(curM<0){curM=11;curY--;}
  updateML();renderDashboard();renderTransactions();
}
function toggleSidebar(){$('sidebar')?.classList.toggle('open');}
// ═══ DERIVED ═════════════════════════════════════════════════════════════════
const getSal=()=>getInp('inp-salaire')||S.salaire;
const getTR=()=>getInp('inp-tr')||0;
const getDime=()=>Math.round(getSal()*0.10*100)/100;
const getProv=()=>120;
const getRevC=()=>S.revenuItems.reduce((s,e)=>s+e.amount,0);
const getRev=()=>getSal()+getTR()+getRevC();
const getAbo=()=>S.abonnements.reduce((s,a)=>s+a.amount,0);
const getFixed=()=>getInp('inp-loyer')+getInp('inp-transport')+getAbo();
const getVar=()=>getInp('inp-alim')+getInp('inp-loisirs')+getInp('inp-shopping')+getInp('inp-divers');
const getSave=()=>getInp('inp-matelas')+getInp('inp-invest')+getInp('inp-frere')+getInp('inp-voyage')+S.customSaves.reduce((s,c)=>s+c.monthly,0);
// ═══ UPDATE ALL ═══════════════════════════════════════════════════════════════
function updateAll(){
  const rev=getRev(),dime=getDime(),prov=getProv(),fixed=getFixed(),varr=getVar(),save=getSave();
  const totalDep=dime+prov+fixed+varr+save,solde=rev-totalDep;
  set('dime-display',fmtD(dime));set('rev-dispo',fmt(rev-dime-prov));
  set('fixed-total',fmt(fixed));set('var-total',fmt(varr));set('save-total',fmt(save));set('budget-total',fmt(dime+prov+fixed+varr));
  setBanner('budget-banner','bb-title','bb-sub','bb-val',rev-(dime+prov+fixed),rev,'avant épargne');
  setBanner('save-banner','sb-title','sb-sub','sb-val',rev-(dime+prov+fixed+varr+save),rev,'après toutes les épargnes');
  updateCushion();renderRepartition();renderBudgetBars();renderDashboard();scheduleSave();
}
function setBanner(bid,tid,sid,vid,solde,rev,ctx){
  const b=$(bid),t=$(tid),s=$(sid),v=$(vid);if(!b||!v)return;
  const col=solde>200?'#34D399':solde>=0?'#FCD34D':'#FB7185';
  b.className='banner '+(solde>200?'banner-green':solde>=0?'banner-amber':'banner-red');
  v.textContent=(solde<0?'- ':'')+fmt(solde);v.style.color=col;
  if(t){t.style.color=col;}
  if(s){s.textContent=(solde>=0?Math.round(Math.abs(solde)/rev*100)+'% restant · ':'')+ctx;s.style.color=col;}
}
// ═══ DASHBOARD ════════════════════════════════════════════════════════════════
function renderDashboard(){
  const rev=getRev(),dime=getDime(),prov=getProv(),fixed=getFixed(),varr=getVar(),save=getSave();
  const totalDep=dime+prov+fixed+varr+save,solde=rev-totalDep;
  set('kpi-rev',fmt(rev));set('kpi-rev-sub',getRevC()>0?'dont '+fmt(getRevC())+' complémentaires':'Salaire CDI');
  set('kpi-dep',fmt(totalDep));set('kpi-dep-sub',Math.round(totalDep/rev*100)+'% du revenu');
  set('kpi-save',fmt(save));set('kpi-save-sub',Math.round(save/rev*100)+'% du revenu');
  set('kpi-solde',(solde<0?'- ':'')+fmt(solde));set('kpi-solde-sub',solde>=0?'Équilibré ✓':'Dépassement');
  const sc=$('kc-solde');if(sc){sc.className='kc'+(solde>=0?' green':' red');sc.style.borderTop='none';}
  // Bar chart
  const bc=$('chart-bars');if(bc){if(charts.bars)charts.bars.destroy();charts.bars=new Chart(bc,{type:'bar',data:{labels:['Revenus','Charges fixes','Vie courante','Épargne','Solde'],datasets:[{data:[Math.round(rev),Math.round(dime+prov+fixed),Math.round(varr),Math.round(save),Math.max(0,Math.round(solde))],backgroundColor:['rgba(52,211,153,.8)','rgba(99,102,241,.8)','rgba(245,158,11,.8)','rgba(196,79,214,.8)',solde>=0?'rgba(52,211,153,.8)':'rgba(251,113,133,.8)'],borderRadius:8,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.raw.toLocaleString('fr-FR')+' €'}}},scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#8888A0',font:{family:'Plus Jakarta Sans',size:12}}},y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#8888A0',font:{size:11},callback:v=>v.toLocaleString('fr-FR')+' €'}}}}});}
  // Donut
  const allM=getMonthTx(),sor=allM.filter(t=>t.type==='sortie');
  const ct={};sor.forEach(t=>{ct[t.cat]=(ct[t.cat]||0)+t.amount;});
  const ent=Object.entries(ct).sort((a,b)=>b[1]-a[1]);
  const dc=$('chart-donut');if(dc){if(charts.donut)charts.donut.destroy();if(ent.length){charts.donut=new Chart(dc,{type:'doughnut',data:{labels:ent.map(e=>e[0]),datasets:[{data:ent.map(e=>Math.round(e[1])),backgroundColor:ent.map(e=>COL[e[0]]||'#94A3B8'),borderWidth:0,hoverOffset:4}]},options:{responsive:false,plugins:{legend:{display:false}},cutout:'60%'}});}}
  const dl=$('donut-legend');if(dl){dl.innerHTML='';const tot=sor.reduce((s,t)=>s+t.amount,0);ent.slice(0,6).forEach(([cat,val])=>{const p=tot>0?Math.round(val/tot*100):0;const d=document.createElement('div');d.className='leg-item';d.innerHTML=`<span class="leg-dot" style="background:${COL[cat]||'#94A3B8'}"></span><span style="flex:1">${cat}</span><span style="font-family:'DM Mono',monospace;font-size:12px">${p}%</span>`;dl.appendChild(d);});}
  // Recent TX
  const dr=$('dash-recent');if(dr){const rec=allM.sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,8);if(!rec.length){dr.innerHTML='<div style="text-align:center;padding:20px;color:var(--mu);font-size:13px">Aucune transaction ce mois</div>';}else{dr.innerHTML='';rec.forEach(t=>{const col=t.type==='entree'?'#34D399':'#FB7185',sign=t.type==='entree'?'+':'-';const ds=new Date(t.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'});const d=document.createElement('div');d.className='rtx';d.innerHTML=`<span class="rtx-dot" style="background:${COL[t.cat]||'#94A3B8'}"></span><span class="rtx-label">${t.label}</span><span class="rtx-cat">${t.cat}</span><span class="rtx-date">${ds}</span><span class="rtx-amt" style="color:${col}">${sign} ${fmt(t.amount)}</span>`;dr.appendChild(d);});}}
  // Health
  const loyerP=Math.round(getInp('inp-loyer')/rev*100),saveP=Math.round(save/rev*100);
  const hl=$('health-list');if(hl){const items=[{l:'Loyer',v:loyerP+'%',s:loyerP<=33?'ok':loyerP<=40?'warn':'bad',h:loyerP<=33?'Optimal':loyerP<=40?'Limite':'Élevé'},{l:'Taux épargne',v:saveP+'%',s:saveP>=15?'ok':saveP>=10?'warn':'bad',h:saveP>=15?'Bien':saveP>=10?'À améliorer':'Insuffisant'},{l:'Solde',v:(solde<0?'-':'+') +fmt(solde),s:solde>=0?'ok':'bad',h:solde>=0?'Équilibré':'Dépassement'},{l:'Dîme',v:fmtD(getDime()),s:'ok',h:'10% automatique'}];const C={ok:{bg:'rgba(16,185,129,.1)',c:'#34D399'},warn:{bg:'rgba(245,158,11,.1)',c:'#FCD34D'},bad:{bg:'rgba(244,63,94,.1)',c:'#FB7185'}};hl.innerHTML=items.map(i=>`<div class="health-item" style="background:${C[i.s].bg}"><div><div class="hi-label" style="color:${C[i.s].c}">${i.l}</div><div class="hi-hint" style="color:${C[i.s].c}">${i.h}</div></div><div class="hi-val" style="color:${C[i.s].c}">${i.v}</div></div>`).join('');}
}
// ═══ TRANSACTIONS ════════════════════════════════════════════════════════════
function getMonthTx(){return S.transactions.filter(t=>{const d=new Date(t.date);return d.getMonth()===curM&&d.getFullYear()===curY;});}
function toggleAddTx(){const p=$('add-tx-panel');if(p)p.style.display=p.style.display==='none'?'':'none';}
function addTransaction(){
  const lbl=$('tx-lbl')?.value.trim(),amt=parseFloat($('tx-amt')?.value)||0;
  if(!lbl||amt<=0){toast('Remplis le libellé et le montant');return;}
  const type=$('tx-type')?.value,cat=$('tx-cat')?.value,date=$('tx-date')?.value||new Date().toISOString().split('T')[0];
  S.transactions.push({id:Date.now(),label:lbl,amount:amt,type,cat,date,source:'manual'});
  if($('tx-lbl'))$('tx-lbl').value='';if($('tx-amt'))$('tx-amt').value='';
  toggleAddTx();renderTransactions();renderDashboard();scheduleSave();toast('Transaction ajoutée');
}
function removeTransaction(id){S.transactions=S.transactions.filter(t=>t.id!==id);renderTransactions();renderDashboard();scheduleSave();}
function renderTransactions(){
  const ft=$('f-type')?.value||'all',fc=$('f-cat')?.value||'all';
  const fs=$('f-source')?.value||'all',fv=$('f-view')?.value||'list';
  const allM=getMonthTx();
  const fil=allM.filter(t=>(ft==='all'||t.type===ft)&&(fc==='all'||t.cat===fc)&&(fs==='all'||(fs==='manual'&&t.source!=='import')||(fs==='import'&&t.source==='import')));
  const ein=allM.filter(t=>t.type==='entree').reduce((s,t)=>s+t.amount,0);
  const eout=allM.filter(t=>t.type==='sortie').reduce((s,t)=>s+t.amount,0);
  const bal=ein-eout;
  set('tx-in',fmt(ein));set('tx-out',fmt(eout));
  const tb=$('tx-bal');if(tb){tb.textContent=(bal<0?'- ':'')+fmt(bal);tb.style.color=bal>=0?'#34D399':'#FB7185';}
  set('tx-nb',allM.length);set('tx-count-lbl',fil.length+' résultat'+(fil.length>1?'s':''));
  const fce=$('f-cat');if(fce){const cats=[...new Set(S.transactions.map(t=>t.cat))],cur=fce.value;fce.innerHTML='<option value="all">Toutes catégories</option>';cats.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;fce.appendChild(o);});fce.value=cur;}
  const cal=$('tx-calendar'),list=$('tx-list');
  if(cal)cal.style.display=fv==='calendar'?'':'none';
  if(list)list.style.display=fv==='list'?'':'none';
  if(fv==='calendar')renderCalendar(fil);else renderList(fil);
}
function renderList(fil){
  const list=$('tx-list');if(!list)return;
  if(!fil.length){list.innerHTML='<div style="text-align:center;padding:24px;color:var(--mu);font-size:13px">Aucune transaction</div>';return;}
  list.innerHTML='';
  [...fil].sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(t=>{
    const col=t.type==='entree'?'#34D399':'#FB7185',sign=t.type==='entree'?'+':'-';
    const ds=new Date(t.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'});
    const imp=t.source==='import'?'<span class="imp-badge">import</span>':'';
    const d=document.createElement('div');d.className='tx-row';
    d.innerHTML=`<span class="dot" style="background:${COL[t.cat]||'#94A3B8'}"></span><span style="font-size:13px;font-weight:500">${t.label} ${imp}</span><span class="tx-cat-badge">${t.cat}</span><span class="tx-date-txt">${ds}</span><span class="tx-amt" style="color:${col}">${sign} ${fmt(t.amount)}</span><span></span><button class="btn-del" onclick="removeTransaction(${t.id})">×</button>`;
    list.appendChild(d);
  });
}
function renderCalendar(fil){
  const cal=$('tx-calendar');if(!cal)return;cal.innerHTML='';
  const byDay={};fil.forEach(t=>{if(!byDay[t.date])byDay[t.date]=[];byDay[t.date].push(t);});
  const days=Object.keys(byDay).sort().reverse();
  if(!days.length){cal.innerHTML='<div style="text-align:center;padding:24px;color:var(--mu);font-size:13px">Aucune transaction</div>';return;}
  let curMth='';
  days.forEach(day=>{
    const d=new Date(day),mKey=MO[d.getMonth()]+' '+d.getFullYear();
    if(mKey!==curMth){curMth=mKey;const mh=document.createElement('div');mh.className='cal-month-hd';mh.textContent=mKey;cal.appendChild(mh);}
    const dayEl=document.createElement('div');
    const lbl=d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
    const sor=byDay[day].filter(t=>t.type==='sortie').reduce((s,t)=>s+t.amount,0);
    const entr=byDay[day].filter(t=>t.type==='entree').reduce((s,t)=>s+t.amount,0);
    let sum='';if(sor>0)sum+=`<span style="color:#FB7185">- ${fmt(sor)}</span>`;if(entr>0)sum+=`<span style="color:#34D399;margin-left:8px">+ ${fmt(entr)}</span>`;
    dayEl.innerHTML=`<div class="cal-day-hd"><span class="cal-day-lbl">${lbl}</span><span class="cal-day-tot">${sum}</span></div>`;
    byDay[day].forEach(t=>{const col=t.type==='entree'?'#34D399':'#FB7185',sign=t.type==='entree'?'+':'-';const imp=t.source==='import'?'<span class="imp-badge">import</span>':'';const row=document.createElement('div');row.className='tx-row';row.innerHTML=`<span class="dot" style="background:${COL[t.cat]||'#94A3B8'}"></span><span style="font-size:13px;font-weight:500">${t.label} ${imp}</span><span class="tx-cat-badge">${t.cat}</span><span></span><span class="tx-amt" style="color:${col}">${sign} ${fmt(t.amount)}</span><span></span><button class="btn-del" onclick="removeTransaction(${t.id})">×</button>`;dayEl.appendChild(row);});
    cal.appendChild(dayEl);
  });
}
// ═══ PATRIMOINE ══════════════════════════════════════════════════════════════
function renderPatrimoine(){
  const tot=S.comptes.reduce((s,c)=>s+c.amount,0),lib=S.comptes.filter(c=>c.type==='free').reduce((s,c)=>s+c.amount,0),lk=S.comptes.filter(c=>c.type!=='free').reduce((s,c)=>s+c.amount,0);
  set('pat-total',fmtD(tot));set('pat-libre',fmtD(lib));set('pat-locked',fmtD(lk));
  const list=$('pat-list');if(!list)return;list.innerHTML='';
  S.comptes.forEach(c=>{const cc={free:'free',res:'res',lock:'lock'}[c.type];const d=document.createElement('div');d.className='pat-row';d.innerHTML=`<input style="background:var(--s);border:1px solid var(--bdr2);border-radius:8px;padding:6px 10px;color:var(--tx);font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;width:100%" type="text" value="${c.label}" onchange="updateC(${c.id},'label',this.value)"><input class="binp" type="number" value="${c.amount}" onchange="updateC(${c.id},'amount',this.value)"><select class="schip ${cc}" onchange="updateC(${c.id},'type',this.value)"><option value="free" ${c.type==='free'?'selected':''}>Libre</option><option value="res" ${c.type==='res'?'selected':''}>Réservé</option><option value="lock" ${c.type==='lock'?'selected':''}>Intouchable</option></select><button class="btn-del" onclick="removeC(${c.id})">×</button>`;list.appendChild(d);});
  const cd=$('chart-pat');if(cd){if(charts.pat)charts.pat.destroy();const cats=[{l:'Libre',v:lib,c:'#10B981'},{l:'Réservé',v:S.comptes.filter(c=>c.type==='res').reduce((s,c)=>s+c.amount,0),c:'#F59E0B'},{l:'Intouchable',v:S.comptes.filter(c=>c.type==='lock').reduce((s,c)=>s+c.amount,0),c:'#6366F1'}].filter(c=>c.v>0);charts.pat=new Chart(cd,{type:'doughnut',data:{labels:cats.map(c=>c.l),datasets:[{data:cats.map(c=>Math.round(c.v)),backgroundColor:cats.map(c=>c.c),borderWidth:0}]},options:{responsive:false,plugins:{legend:{display:false}},cutout:'55%'}});const leg=$('pat-legend');if(leg){leg.innerHTML='';cats.forEach(c=>{const d=document.createElement('div');d.className='leg-item';d.innerHTML=`<span class="leg-dot" style="background:${c.c}"></span><span style="flex:1">${c.l}</span><span style="font-family:'DM Mono',monospace;font-size:12px">${fmtD(c.v)}</span>`;leg.appendChild(d);});}}
}
function openAddCompte(){const p=$('add-compte-panel');if(p)p.style.display=p.style.display==='none'?'':'none';}
function addCompte(){const lbl=$('new-pat-label')?.value.trim(),amt=parseFloat($('new-pat-amt')?.value)||0,type=$('new-pat-type')?.value||'free';if(!lbl)return;S.comptes.push({id:Date.now(),label:lbl,amount:amt,type});if($('new-pat-label'))$('new-pat-label').value='';if($('new-pat-amt'))$('new-pat-amt').value='';const p=$('add-compte-panel');if(p)p.style.display='none';renderPatrimoine();scheduleSave();}
function updateC(id,f,v){const c=S.comptes.find(c=>c.id===id);if(!c)return;c[f]=f==='amount'?parseFloat(v)||0:v;renderPatrimoine();scheduleSave();}
function removeC(id){S.comptes=S.comptes.filter(c=>c.id!==id);renderPatrimoine();scheduleSave();}
// ═══ BUDGET ══════════════════════════════════════════════════════════════════
function renderBudgetBars(){
  const rev=getRev(),dime=getDime(),prov=getProv();
  const all=[{l:'Dîme',c:'#C44FD6',v:dime},{l:'Impôts',c:'#F59E0B',v:prov},{l:'Loyer',c:'#6366F1',v:getInp('inp-loyer')},{l:'Transport',c:'#22D3EE',v:getInp('inp-transport')},...S.abonnements.map(a=>({l:a.label,c:a.color,v:a.amount})),{l:'Alimentation',c:'#F59E0B',v:getInp('inp-alim')},{l:'Loisirs',c:'#F97316',v:getInp('inp-loisirs')},{l:'Vêtements',c:'#10B981',v:getInp('inp-shopping')},{l:'Divers',c:'#94A3B8',v:getInp('inp-divers')},{l:'Matelas',c:'#34D399',v:getInp('inp-matelas')},{l:'Investissement',c:'#818CF8',v:getInp('inp-invest')},{l:'Épargne frère',c:'#FB7185',v:getInp('inp-frere')},{l:'Voyage',c:'#EC4899',v:getInp('inp-voyage')},...S.customSaves.map(c=>({l:c.label,c:c.color,v:c.monthly}))].filter(x=>x.v>0);
  const bars=$('budget-bars');if(!bars)return;bars.innerHTML='';
  all.forEach(x=>{const p=Math.round(x.v/rev*100),w=Math.min(p*2.5,100);const d=document.createElement('div');d.className='bbar-row';d.innerHTML=`<span class="bbar-label">${x.l}</span><div class="bbar-track"><div class="bbar-fill" style="width:${w}%;background:${x.c}"></div></div><span class="bbar-pct">${p}%</span><span class="bbar-amt">${fmt(x.v)}</span>`;bars.appendChild(d);});
}
function renderRepartition(){
  const list=$('rpart-list');if(!list)return;const rev=getRev();let tot=0;list.innerHTML='';
  [{key:'charges',l:'Charges & dîme',c:'#6366F1'},{key:'variable',l:'Vie courante',c:'#F59E0B'},{key:'epargne',l:'Épargne',c:'#10B981'}].forEach(cat=>{
    const pct=S.repartPcts[cat.key]||0;tot+=pct;const eur=Math.round(rev*pct/100);
    const d=document.createElement('div');d.className='rpart-row';
    d.innerHTML=`<div style="display:flex;align-items:center;gap:8px;font-size:13px"><span class="dot" style="background:${cat.c}"></span>${cat.l}</div><input class="binp" style="width:60px" type="number" value="${pct}" min="0" max="100" oninput="S.repartPcts['${cat.key}']=parseInt(this.value)||0;renderRepartition()"><span style="font-size:13px;font-weight:600;font-family:'DM Mono',monospace">${fmt(eur)}</span>`;
    list.appendChild(d);
  });
  const tp=$('rpart-total');if(tp){tp.textContent=tot+'%';tp.style.color=tot===100?'#34D399':tot>100?'#FB7185':'#FCD34D';}
}
// ═══ ABONNEMENTS ════════════════════════════════════════════════════════════
function openAddAbo(){const p=$('add-abo-panel');if(p)p.style.display=p.style.display==='none'?'':'none';}
function addAbonnement(){const lbl=$('new-abo-label')?.value.trim(),amt=parseFloat($('new-abo-amt')?.value)||0;if(!lbl||amt<=0)return;S.abonnements.push({id:Date.now(),label:lbl,amount:amt,color:ACOL[S.abonnements.length%ACOL.length]});if($('new-abo-label'))$('new-abo-label').value='';if($('new-abo-amt'))$('new-abo-amt').value='';const p=$('add-abo-panel');if(p)p.style.display='none';renderAboList();updateAll();scheduleSave();}
function removeAbo(id){S.abonnements=S.abonnements.filter(a=>a.id!==id);renderAboList();updateAll();scheduleSave();}
function updateAbo(id,v){const a=S.abonnements.find(a=>a.id===id);if(a){a.amount=parseFloat(v)||0;updateAll();}}
function renderAboList(){const list=$('abo-list');if(!list)return;list.innerHTML='';S.abonnements.forEach(a=>{const d=document.createElement('div');d.className='brow';d.innerHTML=`<label><span class="dot" style="background:${a.color}"></span>${a.label}</label><div style="display:flex;gap:8px;align-items:center"><input class="binp" type="number" value="${a.amount}" oninput="updateAbo(${a.id},this.value)"><button class="btn-del" onclick="removeAbo(${a.id})">×</button></div>`;list.appendChild(d);});}
// ═══ REVENUS ════════════════════════════════════════════════════════════════
function openAddRev(){const p=$('add-rev-panel');if(p)p.style.display=p.style.display==='none'?'':'none';}
function addRevenu(){const lbl=$('new-rev-label')?.value.trim(),amt=parseFloat($('new-rev-amt')?.value)||0;if(!lbl||amt<=0)return;S.revenuItems.push({id:Date.now(),label:lbl,amount:amt});if($('new-rev-label'))$('new-rev-label').value='';if($('new-rev-amt'))$('new-rev-amt').value='';renderRevList();updateAll();scheduleSave();}
function removeRev(id){S.revenuItems=S.revenuItems.filter(e=>e.id!==id);renderRevList();updateAll();scheduleSave();}
function renderRevList(){const list=$('rev-list');if(!list)return;list.innerHTML='';S.revenuItems.forEach(e=>{const d=document.createElement('div');d.className='brow';d.innerHTML=`<label><span class="dot" style="background:#34D399"></span>${e.label}</label><div style="display:flex;align-items:center;gap:8px"><span style="font-weight:600;font-family:'DM Mono',monospace">${fmt(e.amount)}</span><button class="btn-del" onclick="removeRev(${e.id})">×</button></div>`;list.appendChild(d);});}
// ═══ ÉPARGNE ════════════════════════════════════════════════════════════════
function openAddSave(){const p=$('add-save-panel');if(p)p.style.display=p.style.display==='none'?'':'none';}
function addCustomSave(){const lbl=$('new-save-label')?.value.trim(),mo=parseFloat($('new-save-amt')?.value)||0;if(!lbl||mo<=0)return;S.customSaves.push({id:Date.now(),label:lbl,monthly:mo,goal:0,current:0,color:SCOL[S.customSaves.length%SCOL.length]});if($('new-save-label'))$('new-save-label').value='';if($('new-save-amt'))$('new-save-amt').value='';const p=$('add-save-panel');if(p)p.style.display='none';renderCustomSaveList();renderGoals();updateAll();scheduleSave();}
function removeCS(id){S.customSaves=S.customSaves.filter(c=>c.id!==id);renderCustomSaveList();renderGoals();updateAll();scheduleSave();}
function updateCS(id,f,v){const c=S.customSaves.find(c=>c.id===id);if(!c)return;c[f]=parseFloat(v)||0;renderGoals();if(f==='monthly')updateAll();}
function renderCustomSaveList(){const list=$('custom-save-list');if(!list)return;list.innerHTML='';S.customSaves.forEach(c=>{const d=document.createElement('div');d.className='brow';d.innerHTML=`<label><span class="dot" style="background:${c.color}"></span>${c.label}</label><div style="display:flex;gap:8px;align-items:center"><input class="binp" type="number" value="${c.monthly}" oninput="updateCS(${c.id},'monthly',this.value)"><button class="btn-del" onclick="removeCS(${c.id})">×</button></div>`;list.appendChild(d);});}
function renderGoals(){
  const gc=$('goals-card'),gl=$('goals-list');if(!gc||!gl)return;
  gc.style.display=S.customSaves.length?'':'none';gl.innerHTML='';
  S.customSaves.forEach(c=>{
    const rest=Math.max(0,(c.goal||0)-(c.current||0)),mo=c.monthly>0&&c.goal>0?Math.ceil(rest/c.monthly):0;
    const pct=c.goal>0?Math.min(Math.round((c.current||0)/c.goal*100),100):0;
    const ds=mo>0?(()=>{const dt=new Date();dt.setMonth(dt.getMonth()+mo);return dt.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});})():'—';
    const d=document.createElement('div');d.className='goal-card';
    d.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span class="dot" style="background:${c.color}"></span><span style="font-size:14px;font-weight:600;flex:1">${c.label}</span><button class="btn-del" onclick="removeCS(${c.id})">×</button></div><div class="goal-fields"><div><div class="gf-l">Objectif</div><input class="binp" style="font-size:13px;width:100%" type="number" value="${c.goal||''}" placeholder="0" oninput="updateCS(${c.id},'goal',this.value)"></div><div><div class="gf-l">/ mois</div><input class="binp" style="font-size:13px;width:100%" type="number" value="${c.monthly}" oninput="updateCS(${c.id},'monthly',this.value)"></div><div><div class="gf-l">Déjà épargné</div><input class="binp" style="font-size:13px;width:100%" type="number" value="${c.current||''}" placeholder="0" oninput="updateCS(${c.id},'current',this.value)"></div><div><div class="gf-l">Atteint en</div><div class="gf-v">${c.goal>0&&mo>0?mo+' mois':c.goal>0&&(c.current||0)>=(c.goal||0)?'✓ Atteint':'—'}</div></div></div>${c.goal>0?`<div class="prog-track"><div class="prog-fill" style="width:${pct}%;background:${c.color}"></div></div><div class="prog-lbls"><span>${pct}%</span><span style="color:var(--gr)">${ds}</span></div>`:''}`;
    gl.appendChild(d);
  });
}
function updateCushion(){
  const goal=parseFloat($('cushion-goal')?.value)||0,cur=parseFloat($('cushion-current')?.value)||0,mat=getInp('inp-matelas');
  const rest=Math.max(0,goal-cur),mo=mat>0?Math.ceil(rest/mat):0,pct=goal>0?Math.min(Math.round(cur/goal*100),100):0;
  set('c-target',fmt(goal));set('c-monthly',fmt(mat));
  const cd=$('c-date');if(cd){if(cur>=goal&&goal>0)cd.textContent='✓ Atteint !';else if(mat>0&&goal>0){const dt=new Date();dt.setMonth(dt.getMonth()+mo);cd.textContent=dt.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});}else cd.textContent='—';}
  const pf=$('c-prog');if(pf)pf.style.width=pct+'%';set('c-pct',pct+'%');set('c-lbl',fmt(cur)+' sur '+fmt(goal));
}
