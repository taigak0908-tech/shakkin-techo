const KEY="shakkin:entries", PKEY="shakkin:plan";
const yen=n=>Math.round(n).toLocaleString("ja-JP");
const store={
  async get(k){
    try{ if(window.storage){const r=await window.storage.get(k,false);return r?JSON.parse(r.value):null;} }catch(e){}
    try{ const v=localStorage.getItem(k);return v?JSON.parse(v):null; }catch(e){}
    return null;
  },
  async set(k,data){
    const s=JSON.stringify(data);
    try{ if(window.storage){await window.storage.set(k,s,false);return;} }catch(e){}
    try{ localStorage.setItem(k,s); }catch(e){}
  }
};
/* seed は空にしてある。実データは端末の localStorage と
   バックアップ(.json) で持つ。このリポジトリは公開されており、
   ここに書いた内容は誰でも読めるため（2026-08-13）。 */
const seed=[];

let entries=[], filter="all", editId=null, formType="貸付";
let plan={rate:0, mode:"pay", pay:"", term:""};

function cleanPlan(sp){
  const num=v=>{const n=parseFloat(v);return isFinite(n)&&n>=0?n:0;};
  return {rate:num(sp.rate), mode:sp.mode==="term"?"term":"pay",
          pay:sp.pay===""||sp.pay==null?"":num(sp.pay), term:sp.term===""||sp.term==null?"":Math.round(num(sp.term))};
}
async function boot(){
  const saved=await store.get(KEY);
  entries=(saved&&saved.length!==undefined)?saved:seed.slice();
  if(!saved) await store.set(KEY,entries);
  const sp=await store.get(PKEY); if(sp&&typeof sp==="object") plan=cleanPlan(sp);
  // 以前の自動バックアップ機能の設定（送り先URLと合言葉）が端末に残っていたら消す（機能は 2026-09 に廃止）
  try{ localStorage.removeItem("shakkin:autobk"); }catch(e){}
  document.getElementById("asof").textContent=new Date().toLocaleDateString("ja-JP",{month:"long",day:"numeric"})+" 現在";
  // restore plan UI
  document.getElementById("rate").value=plan.rate;
  document.getElementById("in-pay").value=plan.pay?yen(plan.pay):"";
  document.getElementById("in-term").value=plan.term||"";
  setMode(plan.mode,true);
  render(); renderPlan();
}

function currentBalance(){ let b=0; entries.forEach(e=>b+= e.type==="返済"?-e.amount:e.amount); return b; }

function render(){
  let sumK=0,sumH=0;
  entries.forEach(e=>{ if(e.type==="返済")sumH+=e.amount; else sumK+=e.amount; });
  const bal=sumK-sumH;
  document.getElementById("balance").textContent=yen(bal);
  document.getElementById("sumK").textContent=yen(sumK)+" 円";
  document.getElementById("sumH").textContent=yen(sumH)+" 円";
  let run=0; const bals={},series=[0];
  entries.forEach(e=>{ run+= e.type==="返済"?-e.amount:e.amount; bals[e.id]=run; series.push(run); });
  document.getElementById("histChart").innerHTML=areaChart(series,"#38566B","rgba(56,86,107,.14)");

  const view=entries.filter(e=>filter==="all"||e.type===filter).slice().reverse();
  document.getElementById("count").textContent=view.length+" 件";
  const list=document.getElementById("list");
  if(!view.length){ list.innerHTML='<div class="empty">まだ記録がありません。<br>下の＋ボタンから追加できます。</div>'; return; }
  list.innerHTML=view.map(e=>{
    const k=e.type==="貸付", memo=e.memo?esc(e.memo):'<span class="none">（内容なし）</span>', dt=esc(e.date?fmtDate(e.date):"日付なし");
    return `<div class="row" data-id="${esc(e.id)}"><div class="badge ${k?'k':'h'}">${esc(e.type)}</div>
      <div class="mid"><div class="memo">${memo}</div><div class="date">${dt}</div></div>
      <div class="right"><div class="amt ${k?'k':'h'}">${k?'+':'−'}${yen(e.amount)}</div>
      <div class="bal">残高 ${yen(bals[e.id])}</div></div></div>`;
  }).join("");
  list.querySelectorAll(".row").forEach(r=>r.onclick=()=>openEdit(r.dataset.id));
}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);}
function fmtDate(iso){const d=new Date(iso+"T00:00:00");return isNaN(d)?iso:(d.getMonth()+1)+"月"+d.getDate()+"日";}

/* ---------- SVG charts ---------- */
function areaChart(vals,stroke,fill){
  const W=460,H=140,pad=6;
  if(vals.length<2) return '<div style="color:var(--ink-soft);font-size:13px;padding:30px 0;text-align:center">データが増えるとグラフが表示されます</div>';
  const max=Math.max(...vals,1),min=Math.min(...vals,0),span=(max-min)||1;
  const x=i=>pad+i*(W-2*pad)/(vals.length-1);
  const y=v=>pad+(H-2*pad)*(1-(v-min)/span);
  let d="M"+x(0)+" "+y(vals[0]);
  for(let i=1;i<vals.length;i++) d+=" L"+x(i)+" "+y(vals[i]);
  const area=d+" L"+x(vals.length-1)+" "+(H-pad)+" L"+x(0)+" "+(H-pad)+" Z";
  return `<svg class="chart" viewBox="0 0 ${W} ${H+22}">
    <path d="${area}" fill="${fill}"/><path d="${d}" fill="none" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round"/>
    <circle cx="${x(vals.length-1)}" cy="${y(vals[vals.length-1])}" r="4" fill="${stroke}"/>
    <text x="${x(0)}" y="${H+16}" font-size="11" fill="#5C6B78">${yen(vals[0])}</text>
    <text x="${x(vals.length-1)}" y="${H+16}" font-size="11" fill="#5C6B78" text-anchor="end">${yen(vals[vals.length-1])}</text>
  </svg>`;
}

/* ---------- plan ---------- */
function setMode(m,silent){
  plan.mode=m;
  document.querySelectorAll("#mode button").forEach(b=>b.classList.toggle("on",b.dataset.m===m));
  document.getElementById("in-pay-wrap").style.display=m==="pay"?"flex":"none";
  document.getElementById("in-term-wrap").style.display=m==="term"?"flex":"none";
  if(!silent) savePlan();
}
document.querySelectorAll("#mode button").forEach(b=>b.onclick=()=>{setMode(b.dataset.m);renderPlan();});
const rate=document.getElementById("rate");
rate.oninput=()=>{plan.rate=parseFloat(rate.value);savePlan();renderPlan();};
const inPay=document.getElementById("in-pay");
inPay.addEventListener("input",()=>{const r=inPay.value.replace(/[^\d]/g,"");inPay.value=r?Number(r).toLocaleString("ja-JP"):"";plan.pay=r?+r:"";savePlan();renderPlan();});
const inTerm=document.getElementById("in-term");
inTerm.addEventListener("input",()=>{const r=inTerm.value.replace(/[^\d]/g,"");inTerm.value=r;plan.term=r?+r:"";savePlan();renderPlan();});
let saveT; function savePlan(){clearTimeout(saveT);saveT=setTimeout(()=>store.set(PKEY,plan),300);}

function simulate(P,annualPct,monthly){
  const i=annualPct/100/12; let bal=P,rows=[],totalInt=0,m=0;
  while(bal>0.5 && m<1200){
    m++; const interest=bal*i; let principal=monthly-interest;
    if(principal<=0) return {impossible:true};
    let pay=monthly;
    if(principal>bal){ principal=bal; pay=bal+interest; }
    bal-=principal; totalInt+=interest;
    rows.push({m,pay,interest,bal:Math.max(0,bal)});
  }
  if(bal>0.5) return {impossible:true};
  return {months:m,totalInt,totalPaid:rows.reduce((s,r)=>s+r.pay,0),rows};
}
function paymentForTerm(P,annualPct,N){
  const i=annualPct/100/12;
  if(i===0) return P/N;
  return P*i/(1-Math.pow(1+i,-N));
}
function addMonths(n){const d=new Date();d.setMonth(d.getMonth()+n);return d.getFullYear()+"年"+(d.getMonth()+1)+"月";}

function renderPlan(){
  const P=currentBalance();
  document.getElementById("plan-bal").textContent="残高 "+yen(P)+" 円";
  const rr=plan.rate;
  document.getElementById("rate-num").textContent=rr;
  document.getElementById("int-month").textContent=yen(P*rr/100/12)+" 円";
  document.getElementById("int-year").textContent=yen(P*rr/100)+" 円";

  const resEl=document.getElementById("plan-result");
  const chartCard=document.getElementById("plan-chart-card");
  const schedCard=document.getElementById("plan-sched-card");

  let monthly;
  if(plan.mode==="pay"){ monthly=+plan.pay||0; if(!monthly){ resEl.innerHTML=""; chartCard.style.display=schedCard.style.display="none"; return; } }
  else { const N=+plan.term||0; if(!N){ resEl.innerHTML=""; chartCard.style.display=schedCard.style.display="none"; return; } monthly=paymentForTerm(P,rr,N); }

  if(P<=0){ resEl.innerHTML='<div class="warn">現在の残高が0円です。返済計画は残高があるときに使えます。</div>'; chartCard.style.display=schedCard.style.display="none"; return; }

  const sim=simulate(P,rr,monthly);
  if(sim.impossible){
    resEl.innerHTML='<div class="warn">この毎月の金額では利息に追いつかず、いつまでも完済できません。金額を増やすか、金利を下げてください。</div>';
    chartCard.style.display=schedCard.style.display="none"; return;
  }
  const payLabel=plan.mode==="term"?`毎月 <b>${yen(monthly)}</b> 円`:`<b>${sim.months}</b> ヶ月で完済`;
  const other=plan.mode==="term"?`${sim.months} ヶ月で完済`:`毎月 ${yen(monthly)} 円`;
  resEl.innerHTML=`<div class="result">
    <div class="big">${payLabel}</div>
    <div class="g">
      <div><div class="k">完済予定</div><div class="v">${addMonths(sim.months)}</div></div>
      <div><div class="k">総返済額</div><div class="v">${yen(sim.totalPaid)} 円</div></div>
      <div><div class="k">うち利息</div><div class="v">${yen(sim.totalInt)} 円</div></div>
    </div></div>`;

  // chart
  const series=[P,...sim.rows.map(r=>r.bal)];
  chartCard.style.display="block";
  document.getElementById("planChart").innerHTML=areaChart(series,"#2E8577","rgba(46,133,119,.14)");

  // schedule (show every row, but cap huge lists by monthly grouping if >120)
  schedCard.style.display="block";
  const rows=sim.rows;
  let body='<tr><th>回</th><th>返済</th><th>内 利息</th><th>残高</th></tr>';
  rows.forEach(r=>{ body+=`<tr><td>${r.m}</td><td>${yen(r.pay)}</td><td>${yen(r.interest)}</td><td>${yen(r.bal)}</td></tr>`; });
  document.getElementById("sched").innerHTML=body;
}

/* ---------- tabs ---------- */
document.querySelectorAll(".tab[data-p]").forEach(t=>t.onclick=()=>{
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("on"));
  document.getElementById(t.dataset.p).classList.add("on");
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("on"));
  t.classList.add("on"); window.scrollTo({top:0});
});

/* ---------- filters ---------- */
document.querySelectorAll(".chip").forEach(c=>c.onclick=()=>{
  document.querySelectorAll(".chip").forEach(x=>x.classList.remove("on"));
  c.classList.add("on"); filter=c.dataset.f; render();
});

/* ---------- input sheet ---------- */
const bg=document.getElementById("bg"),sheet=document.getElementById("sheet");
function openSheet(){bg.classList.add("show");sheet.classList.add("show");}
function closeSheet(){bg.classList.remove("show");sheet.classList.remove("show");}
bg.onclick=closeSheet;
function setType(t){formType=t;document.querySelectorAll("#seg button").forEach(b=>{b.classList.remove("on-k","on-h");if(b.dataset.t===t)b.classList.add(t==="貸付"?"on-k":"on-h");});}
document.querySelectorAll("#seg button").forEach(b=>b.onclick=()=>setType(b.dataset.t));
function openAdd(){
  editId=null;document.getElementById("sheet-title").textContent="記録する";document.getElementById("del").style.display="none";
  document.getElementById("in-amt").value="";document.getElementById("in-memo").value="";
  document.getElementById("in-date").value=new Date().toISOString().slice(0,10);
  setType("貸付");document.getElementById("save").disabled=true;openSheet();
  setTimeout(()=>document.getElementById("in-amt").focus(),300);
}
function openEdit(id){
  const e=entries.find(x=>x.id===id);if(!e)return;editId=id;
  document.getElementById("sheet-title").textContent="記録を編集";document.getElementById("del").style.display="block";
  document.getElementById("in-amt").value=e.amount?yen(e.amount):"";document.getElementById("in-memo").value=e.memo||"";
  document.getElementById("in-date").value=e.date||"";setType(e.type);document.getElementById("save").disabled=!e.amount;openSheet();
}
const amtEl=document.getElementById("in-amt");
amtEl.addEventListener("input",()=>{const raw=amtEl.value.replace(/[^\d]/g,"");amtEl.value=raw?Number(raw).toLocaleString("ja-JP"):"";document.getElementById("save").disabled=!raw;});
document.getElementById("tab-add").onclick=openAdd;
document.getElementById("save").onclick=async()=>{
  const amt=parseInt(document.getElementById("in-amt").value.replace(/[^\d]/g,""),10);if(!amt)return;
  const memo=document.getElementById("in-memo").value.trim(),date=document.getElementById("in-date").value;
  if(editId){const e=entries.find(x=>x.id===editId);e.type=formType;e.amount=amt;e.memo=memo;e.date=date;toast("更新しました");}
  else{entries.push({id:"e"+Date.now(),type:formType,amount:amt,memo,date});toast(formType==="貸付"?"貸付を記録しました":"返済を記録しました");}
  await store.set(KEY,entries);closeSheet();render();renderPlan();
};
document.getElementById("del").onclick=async()=>{
  if(!editId)return;entries=entries.filter(x=>x.id!==editId);await store.set(KEY,entries);toast("削除しました");closeSheet();render();renderPlan();
};

/* ---------- backup ---------- */
const bg2=document.getElementById("bg2"),sheet2=document.getElementById("sheet2");
function closeBackup(){bg2.classList.remove("show");sheet2.classList.remove("show");}
bg2.onclick=closeBackup;
document.getElementById("tab-backup").onclick=()=>{bg2.classList.add("show");sheet2.classList.add("show");};

/* 書き出し：家計簿アプリと同じ {app,ver,exported,tx:[...]} 形式の .json を保存 */
document.getElementById("expfile").onclick=()=>{
  const today=new Date().toISOString().slice(0,10);
  const data={app:"shakkin",ver:1,exported:today,tx:entries};
  const blob=new Blob([JSON.stringify(data,null,1)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download="shakkin-backup-"+today+".json";
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
  bkMark();
  toast("バックアップを書き出しました");
};

/* 読み込み：.json ファイルを選んで復元 */
const impfile=document.getElementById("impfile");
document.getElementById("pickfile").onclick=()=>impfile.click();
impfile.onchange=()=>{
  const f=impfile.files[0]; if(!f) return;
  if(f.size>5*1024*1024){ toast("ファイルが大きすぎます"); impfile.value=""; return; }
  const rd=new FileReader();
  rd.onload=async()=>{
    let data;
    try{ data=JSON.parse(rd.result); }catch(e){ toast("ファイルを読めませんでした"); return; }
    const tx=Array.isArray(data)?data:(data&&data.tx);
    if(!Array.isArray(tx)||!tx.length){ toast("バックアップの中身が正しくありません"); return; }
    if(!confirm(tx.length+"件の記録で、今の記録（"+entries.length+"件）を置き換えます。よろしいですか？")) return;
    const seen=new Set();
    entries=tx.filter(t=>t&&typeof t==="object").map(t=>{
      let id=typeof t.id==="string"&&/^[\w-]{1,40}$/.test(t.id)?t.id:"";
      if(!id||seen.has(id)) id="e"+Date.now()+Math.random().toString(36).slice(2,8);
      seen.add(id);
      const amt=parseInt(t.amount,10);
      return {id, type:t.type==="返済"?"返済":"貸付",
        amount:isFinite(amt)&&amt>0?Math.min(amt,1e12):0,
        memo:String(t.memo==null?"":t.memo).slice(0,500),
        date:/^\d{4}-\d{2}-\d{2}$/.test(String(t.date||""))?String(t.date):""};
    });
    await store.set(KEY,entries); closeBackup(); render(); renderPlan();
    toast(entries.length+"件を復元しました");
  };
  rd.readAsText(f);
  impfile.value="";
};

/* ---------- toast ---------- */
let tT;function toast(msg){const t=document.getElementById("toast");t.textContent=msg;t.classList.add("show");clearTimeout(tT);tT=setTimeout(()=>t.classList.remove("show"),1800);}


/* ---------- バックアップの催促（2026-09-16 追加） ----------
   書き出した日を端末に覚えておき、7日を超えたら引き継ぎ画面に出すだけ。外へは何も送らない。 */
const BKKEY="shakkin:lastbk", BK_DAYS=7;
function bkMark(){ try{ localStorage.setItem(BKKEY, String(Date.now())); }catch(e){} bkShow(); }
function bkShow(){
  const el=document.getElementById("bkWarn"); if(!el) return;
  let v=0; try{ v=parseInt(localStorage.getItem(BKKEY)||"0",10)||0; }catch(e){}
  if(!v){ bkMark(); return; }
  const d=Math.floor((Date.now()-v)/86400000);
  if(d>=BK_DAYS){ el.style.display=""; el.textContent="前回のバックアップから"+d+"日です。上の「ファイルを書き出す」を押して、ドライブに保存してください。"; }
  else el.style.display="none";
}

boot().then(()=>{ bkShow(); });
