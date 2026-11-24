import {companies} from './catalog.js';
import {portfolioInputs,simulatePortfolio} from './portfolio-model.js';

const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>(value<0?'−$':'$')+Math.abs(value).toLocaleString('en-US',{maximumFractionDigits:2,minimumFractionDigits:2});
const pct=value=>(value*100).toFixed(1)+'%';
const cached=new Map();
const initial={positions:[{symbol:'AAPL',weight:35},{symbol:'MSFT',weight:35},{symbol:'IBM',weight:20}],days:252,budget:10000,useGameAssumptions:true,shock:{probability:0,move:0}};
let state;
try{state=JSON.parse(localStorage.getItem('quantlab-portfolio'))||structuredClone(initial)}catch{state=structuredClone(initial)}
if(!Array.isArray(state.positions)||state.positions.length<2||state.positions.length>5)state=structuredClone(initial);
if(!state.shock||!Number.isFinite(state.shock.probability)||!Number.isFinite(state.shock.move))state.shock={probability:0,move:0};
const save=()=>{try{localStorage.setItem('quantlab-portfolio',JSON.stringify(state))}catch{}};
const optionList=selected=>companies.map(c=>`<option value="${c.symbol}" ${selected===c.symbol?'selected':''}>${c.symbol} · ${esc(c.name)}</option>`).join('');
const path=(values,x,y)=>values.map((v,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

function chart(result){
  const W=720,H=275,p={l:58,r:18,t:15,b:30};
  const min=Math.min(...result.bands.map(b=>b.lo))*.97,max=Math.max(...result.bands.map(b=>b.hi))*1.03;
  const x=i=>p.l+i/result.days*(W-p.l-p.r),y=v=>p.t+(max-v)/(max-min)*(H-p.t-p.b);
  const high=result.bands.map(b=>b.hi),low=result.bands.map(b=>b.lo);
  const band=path(high,x,y)+' '+low.map((_,i)=>`L${x(result.days-i).toFixed(1)},${y(low[result.days-i]).toFixed(1)}`).join(' ')+'Z';
  const ticks=Array.from({length:4},(_,i)=>{const value=min+(max-min)*i/3;return `<line x1="${p.l}" y1="${y(value)}" x2="${W-p.r}" y2="${y(value)}" stroke="#dce5d2" stroke-dasharray="3 5"/><text x="${p.l-7}" y="${y(value)+3}" text-anchor="end" fill="#71806e" font-size="11">$${Math.round(value).toLocaleString()}</text>`}).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Portfolio wealth paths, median and pointwise middle 80 percent band">${ticks}<path d="${band}" fill="#d9eab5" opacity=".75"/>${result.paths.map(values=>`<path d="${path(values,x,y)}" fill="none" stroke="#a4b691" opacity=".2" stroke-width=".8"/>`).join('')}<line x1="${p.l}" y1="${y(result.budget)}" x2="${W-p.r}" y2="${y(result.budget)}" stroke="#839388" stroke-dasharray="4 5"/><path d="${path(result.bands.map(b=>b.mid),x,y)}" fill="none" stroke="#426938" stroke-width="2.5"/><text x="${p.l}" y="${H-5}" fill="#71806e" font-size="10">START</text><text x="${W-p.r}" y="${H-5}" text-anchor="end" fill="#71806e" font-size="10">SESSION ${result.days}</text></svg>`;
}

async function loadSymbol(symbol,force=false){
  const hit=cached.get(symbol);if(!force&&hit&&hit.expires>Date.now())return hit.data;
  const response=await fetch('/api/prices?'+new URLSearchParams({symbol,provider:'yahoo'}));
  const data=await response.json();if(!response.ok)throw new Error(data.error||`Could not load ${symbol}.`);
  cached.set(symbol,{data:{...data,label:`Yahoo Finance · ${data.asOf}`,kind:'provider'},expires:Date.now()+15*60*1000});
  return cached.get(symbol).data;
}

export function portfolioPage(view,{sourceFor,archiveFor,scenarioWeights,providerAvailable}){
  let busy=false,error='',loadRevision=0;
  const sources=new Map();
  const liveFor=symbol=>sources.get(symbol)||cached.get(symbol)?.data||(sourceFor(symbol)?.kind==='provider'?sourceFor(symbol):null);
  const source=symbol=>{
    const completeLive=state.positions.every(position=>liveFor(position.symbol));
    const completeArchive=state.positions.every(position=>archiveFor(position.symbol));
    const imported=state.positions.some(position=>sourceFor(position.symbol)?.kind==='import');
    if(busy&&!completeLive&&!imported)return null;
    if(!completeLive&&completeArchive&&!imported)return archiveFor(symbol);
    return liveFor(symbol)||sourceFor(symbol);
  };
  function paint(){
    const total=state.positions.reduce((sum,p)=>sum+Number(p.weight||0),0),cash=100-total;
    view.innerHTML=`<div id="portfolio-root" class="portfolio-page"><div class="page-heading"><div><div class="eyebrow">ADVANCED SIMULATION</div><h1>Build a <em>portfolio.</em></h1><p>Choose two to five stocks. See how their shared movements change the range of outcomes.</p></div></div>
      <section class="panel portfolio-builder"><div class="panel-body"><div class="panel-head"><h3>Holdings</h3><button class="secondary" id="portfolioRefresh" ${busy?'disabled':''}>${busy?'Loading prices…':'Refresh prices'}</button></div><div class="portfolio-rows">${state.positions.map((position,i)=>`<div class="portfolio-row"><label class="field">STOCK<select data-portfolio-symbol="${i}">${optionList(position.symbol)}</select></label><label class="field">WEIGHT / %<input data-portfolio-weight="${i}" type="number" min="0" max="100" step="1" value="${position.weight}"></label><span class="portfolio-source">${esc(source(position.symbol)?.label||'Waiting for prices')}</span><button class="quiet" data-portfolio-remove="${i}" ${state.positions.length<=2?'disabled':''} aria-label="Remove ${position.symbol}">Remove</button></div>`).join('')}</div><div class="portfolio-actions"><button class="secondary" id="portfolioAdd" ${state.positions.length>=5?'disabled':''}>Add stock</button><strong id="portfolioCash" class="${cash<0?'negative':''}">Cash ${cash.toFixed(0)}%</strong></div><div class="portfolio-fields"><label class="field">PRACTICE BUDGET / $<input id="portfolioBudget" type="number" min="1" max="100000000" step="any" value="${state.budget}"></label><label class="field">HORIZON<select id="portfolioHorizon">${[[21,'1 month'],[63,'3 months'],[126,'6 months'],[252,'1 year'],[504,'2 years'],[1260,'5 years']].map(([days,label])=>`<option value="${days}" ${days===state.days?'selected':''}>${label}</option>`).join('')}</select></label><label class="portfolio-check"><input id="portfolioAssumptions" type="checkbox" ${state.useGameAssumptions?'checked':''}> Use current game sliders for each company’s exposure</label></div><div class="shock-fields"><label class="field">SHARED EVENT CHANCE / %<input id="portfolioShockProbability" type="number" min="0" max="100" step="1" value="${state.shock.probability*100}"></label><label class="field">SHARED EVENT MOVE / %<input id="portfolioShockMove" type="number" min="-80" max="100" step="1" value="${state.shock.move*100}"></label></div><p class="small-text">A shared event shock, when enabled, applies the same one-time percentage move to every stock. Cash is unaffected.</p><p class="small-text">Weights are buy-and-hold shares of the starting budget. Unallocated money stays in cash at 0% interest. No rebalancing, dividends, taxes, or transaction costs are modeled.</p></div></section>
      <div id="portfolioResult" aria-live="polite"></div></div>`;
    const update=()=>{save();paint()};
    view.querySelectorAll('[data-portfolio-symbol]').forEach(el=>el.onchange=()=>{const index=Number(el.dataset.portfolioSymbol),symbol=el.value;if(state.positions.some((p,i)=>i!==index&&p.symbol===symbol)){error='Each holding needs a different stock.';paint();return}state.positions[index].symbol=symbol;error='';update();loadSelected()});
    view.querySelectorAll('[data-portfolio-weight]').forEach(el=>el.oninput=()=>{if(el.value===''||!el.checkValidity()){view.querySelector('#portfolioResult').innerHTML='<div class="callout amber">Enter a stock weight from 0% to 100%.</div>';return}state.positions[Number(el.dataset.portfolioWeight)].weight=Number(el.value);const cash=100-state.positions.reduce((sum,p)=>sum+Number(p.weight||0),0),label=view.querySelector('#portfolioCash');label.textContent=`Cash ${cash.toFixed(0)}%`;label.classList.toggle('negative',cash<0);save();renderResult()});
    view.querySelectorAll('[data-portfolio-remove]').forEach(el=>el.onclick=()=>{state.positions.splice(Number(el.dataset.portfolioRemove),1);update()});
    view.querySelector('#portfolioAdd').onclick=()=>{const next=companies.find(c=>!state.positions.some(p=>p.symbol===c.symbol));if(next){state.positions.push({symbol:next.symbol,weight:0});update();loadSelected()}};
    view.querySelector('#portfolioBudget').oninput=el=>{if(el.target.value===''||!el.target.checkValidity()){view.querySelector('#portfolioResult').innerHTML='<div class="callout amber">Enter a positive practice budget up to $100 million.</div>';return}state.budget=Number(el.target.value);save();renderResult()};
    view.querySelector('#portfolioHorizon').onchange=el=>{state.days=Number(el.target.value);update()};
    view.querySelector('#portfolioAssumptions').onchange=el=>{state.useGameAssumptions=el.target.checked;update()};
    view.querySelector('#portfolioRefresh').onclick=()=>loadSelected(true);
    for(const [id,key] of [['portfolioShockProbability','probability'],['portfolioShockMove','move']])view.querySelector('#'+id).oninput=e=>{if(!e.target.checkValidity()||e.target.value==='')return;state.shock[key]=Number(e.target.value)/100;save();renderResult()};
    renderResult();
  }
  function renderResult(){
    const node=view.querySelector('#portfolioResult');if(!node)return;
    const warning=error?`<div class="callout amber">${esc(error)}</div>`:'';
    if(busy&&state.positions.some(p=>!source(p.symbol))){node.innerHTML=warning+'<div class="callout portfolio-loading" role="status">Loading current Yahoo histories for all selected stocks…</div>';return}
    const weights=state.positions.map(p=>Number(p.weight)/100);
    if(weights.some(w=>!Number.isFinite(w)||w<0||w>1)||weights.reduce((a,b)=>a+b,0)>1+1e-9){node.innerHTML=warning+'<div class="callout amber">Stock weights must total 100% or less.</div>';return}
    if(!Number.isFinite(state.budget)||state.budget<=0||state.budget>1e8){node.innerHTML=warning+'<div class="callout amber">Enter a positive practice budget up to $100 million.</div>';return}
    const holdings=state.positions.map(p=>({symbol:p.symbol,company:companies.find(c=>c.symbol===p.symbol),rows:source(p.symbol)?.rows||[],eventWeights:state.useGameAssumptions?scenarioWeights():{}}));
    if(holdings.some(h=>h.rows.length<41)){node.innerHTML=warning+'<div class="callout amber">Waiting for matching daily histories. If Yahoo is unavailable, choose stocks with matching imported or archived data.</div>';return}
    try{
      const inputs=portfolioInputs(holdings,weights),result=simulatePortfolio({...inputs,days:state.days,budget:state.budget,shock:state.shock});
      const independent=simulatePortfolio({...inputs,correlation:inputs.correlation.map((row,i)=>row.map((_,j)=>i===j?1:0)),days:state.days,budget:state.budget,shock:state.shock});
      const noEvent=simulatePortfolio({...inputs,days:state.days,budget:state.budget});
      const baselineInputs=state.useGameAssumptions?portfolioInputs(holdings.map(h=>({...h,eventWeights:{}})),weights):inputs;
      const baselineScenario=simulatePortfolio({...baselineInputs,days:state.days,budget:state.budget});
      const scenarioRows=[['Baseline · no event',baselineScenario],['Your sliders · no event',noEvent],['Your sliders · shared event',result],['Independent returns · shared event',independent]];
      const scenarioTable=`<section class="panel portfolio-scenario-panel"><div class="panel-body"><div class="panel-head"><h3>What changes the outcome?</h3></div><div class="scenario-cards">${scenarioRows.map(([name,run],index)=>`<article class="scenario-card ${index===2?'selected':''}"><small>${name}</small><strong>${money(run.median)}</strong><span>Median ending value</span><div><b>${pct(run.loss)}</b> loss paths</div><div>${money(run.lo)}–${money(run.hi)} middle 80%</div></article>`).join('')}</div><p class="scenario-impact">Your shared event moves the modeled median by <b>${money(result.median-noEvent.median)}</b> and loss frequency by <b>${((result.loss-noEvent.loss)*100).toFixed(1)} percentage points</b> versus the same sliders without an event.</p><details class="model-details"><summary>Why compare these four cases?</summary><p>All cases use the same stocks, weights, horizon, and random seed. The last case removes estimated daily-return correlation but keeps the same shared event; that event can still make outcomes move together. These are model sensitivities, not measured event probabilities.</p></details></div></section>`;
      const asOf=holdings.map(h=>source(h.symbol)?.asOf||h.rows.at(-1).date);
      const holdingCards=`<section class="panel"><div class="panel-body"><h3>Each stock in this model</h3><div class="holding-summary">${inputs.model.map((item,index)=>`<div><strong>${item.symbol} <span>${pct(weights[index])} of budget</span></strong><small>Annual μ ${pct(item.mu)} · σ ${pct(item.sigma)}</small><small>Daily history through ${esc(asOf[index])}</small></div>`).join('')}</div><p class="small-text">The game slider positions ${state.useGameAssumptions?'are applied separately to each company’s exposure.':'are turned off here.'} Each stock keeps its own calibrated drift and volatility.</p></div></section>`;
      const old=asOf.some(date=>(Date.now()-Date.parse(date+'T00:00:00Z'))/86400000>7);
      node.innerHTML=`${warning}${old?'<div class="callout amber">At least one price series is archived or stale. Treat this as a historical illustration, not a current forecast.</div>':''}${state.days>=504?'<div class="callout amber">Long-horizon results hold today’s estimated drift, volatility, and correlations fixed for years; model uncertainty is especially high.</div>':''}<section class="panel portfolio-chart"><div class="panel-body"><div class="panel-head"><h3>Possible portfolio values</h3><span class="pill">CORRELATED GBM · 600 PATHS · THROUGH ${inputs.dates.at(-1)}</span></div><div class="chart-wrap">${chart(result)}</div><div class="portfolio-metrics"><div><small>MEDIAN ENDING VALUE</small><b>${money(result.median)}</b></div><div><small>MIDDLE 80%</small><b>${money(result.lo)}–${money(result.hi)}</b></div><div><small>MODELED LOSS CHANCE</small><b>${pct(result.loss)}</b></div><div><small>ANNUALIZED PORTFOLIO VOLATILITY</small><b>${pct(result.annualVol)}</b></div></div><p class="small-text">About 10% of simulated ending values fall on each side of the middle 80%. These are conditional model outcomes, not market probabilities.</p></div></section>${scenarioTable}${holdingCards}<section class="panel"><div class="panel-body"><h3>How the stocks move together</h3><div class="table-wrap"><table class="watchlist"><thead><tr><th></th>${inputs.model.map(m=>`<th>${m.symbol}</th>`).join('')}</tr></thead><tbody>${inputs.model.map((m,i)=>`<tr><th>${m.symbol}</th>${inputs.correlation[i].map(value=>`<td>${value.toFixed(2)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="small-text">Correlations use ${inputs.dates.length} shared daily returns ending ${inputs.dates.at(-1)} and are shrunk 20% toward zero for stability. Individual annualized volatilities and drifts are calibrated separately; ${state.useGameAssumptions?'the game slider settings then adjust them by company exposure.':'slider adjustments are off.'} Future correlations and parameters may differ.</p></div></section>`;
    }catch(e){node.innerHTML=`${warning}<div class="callout amber">${esc(e.message)}</div>`}
  }
  async function loadSelected(force=false){
    if(!providerAvailable())return;
    const revision=++loadRevision,symbols=state.positions.map(p=>p.symbol);busy=true;paint();
    const results=await Promise.allSettled(symbols.map(symbol=>loadSymbol(symbol,force)));
    if(revision!==loadRevision||!view.querySelector('#portfolio-root'))return;
    results.forEach((r,i)=>{if(r.status==='fulfilled')sources.set(symbols[i],r.value)});
    const failed=results.filter(r=>r.status==='rejected');error=failed.length?`${failed.length} live price request${failed.length===1?'':'s'} failed. Available archived or imported histories remain labeled.`:'';
    busy=false;paint();
  }
  paint();loadSelected();
}
