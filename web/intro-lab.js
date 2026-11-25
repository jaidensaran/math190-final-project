import {companies,events} from './catalog.js';
import {parameters,simulate} from './model.js';

const factors=['earnings','rates','war','product'];
const company=companies.find(row=>row.symbol==='AAPL');
const baseline={mu:.08,sigma:.25,observations:0};
const money=value=>value.toFixed(1);
const signed=value=>`${value>=0?'+':'−'}${Math.abs(value).toFixed(1)}`;
const pct=value=>`${(value*100).toFixed(1)}%`;
const path=(values,x,y)=>values.map((value,index)=>`${index?'L':'M'}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ');

export function introScenario(factorId='earnings',weight=50){
  const factor=events.find(row=>row.id===factorId);
  if(!factor||!factors.includes(factorId)||!Number.isFinite(weight)||weight<0||weight>100)throw new Error('Invalid tutorial scenario.');
  const weights={[factorId]:weight},current=parameters(company,weights,baseline,252);
  const base=simulate({s0:100,mu:baseline.mu,sigma:baseline.sigma,days:252,n:300});
  const changed=simulate({s0:100,mu:current.mu,sigma:current.sigma,days:252,n:300});
  const effect=current.effects.find(row=>row.id===factorId);
  return{factor,weight,effect,baseline,current,base,changed};
}

function chart(base,changed){
  const width=520,height=205,pad={left:34,right:10,top:12,bottom:25};
  const values=[...base.bands.map(row=>row.lo),...base.bands.map(row=>row.hi),...changed.bands.map(row=>row.lo),...changed.bands.map(row=>row.hi)];
  const low=Math.min(...values)*.96,high=Math.max(...values)*1.04;
  const x=index=>pad.left+index/252*(width-pad.left-pad.right),y=value=>pad.top+(high-value)/(high-low)*(height-pad.top-pad.bottom);
  const hi=changed.bands.map(row=>row.hi),lo=changed.bands.map(row=>row.lo);
  const band=path(hi,x,y)+' '+lo.map((_,index)=>`L${x(252-index).toFixed(1)},${y(lo[252-index]).toFixed(1)}`).join(' ')+'Z';
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="One-year illustration with baseline and changed median price paths"><path d="${band}" fill="#dcebbf" opacity=".65"/><line x1="${pad.left}" y1="${y(100)}" x2="${width-pad.right}" y2="${y(100)}" stroke="#a8b399" stroke-dasharray="4 5"/><path d="${path(base.bands.map(row=>row.mid),x,y)}" fill="none" stroke="#83947d" stroke-width="2" stroke-dasharray="5 4"/><path d="${path(changed.bands.map(row=>row.mid),x,y)}" fill="none" stroke="#375d35" stroke-width="3"/><text x="${pad.left}" y="${height-5}" font-size="10" fill="#708369">START 100</text><text x="${width-pad.right}" y="${height-5}" text-anchor="end" font-size="10" fill="#708369">1 YEAR</text></svg>`;
}

export function renderIntroLab(root){
  let selected='earnings',weight=50;
  root.innerHTML=`<div class="intro-lab"><div class="intro-lab-controls"><div class="eyebrow">TRY ONE ASSUMPTION</div><h3>Move a factor. Watch the model.</h3><p>This is an index starting at 100. The game uses a dated stock close from Yahoo Finance.</p><label class="field">FACTOR<select id="introFactor">${factors.map(id=>{const row=events.find(event=>event.id===id);return `<option value="${id}">${row.name}</option>`}).join('')}</select></label><label class="field">STRENGTH <output id="introWeight">50%</output><input id="introSlider" type="range" min="0" max="100" value="50"></label><p class="intro-lab-hint" id="introFactorHint"></p></div><div class="intro-lab-results"><div class="intro-result-head"><div><span>MODELED ENDING MEDIAN</span><strong id="introMedian">100.0</strong><small id="introDifference">No change from baseline</small></div><div class="intro-legend"><span>━ Your scenario</span><span>┄ Baseline</span><span>▰ Middle 80%</span></div></div><div class="intro-chart" id="introChart"></div><div class="intro-equation">S<sub>next</sub> = S × exp[(<mark id="introMuTerm">μ</mark> − ½<mark id="introSigmaTerm">σ²</mark>)Δt + <mark>σ</mark>√Δt·Z]<small>Z is a new random shock drawn from a standard normal distribution at each step.</small></div><div class="intro-effects" id="introEffects"></div></div></div><p class="intro-caveat">The factor coefficients are teaching assumptions, not measured event probabilities. A one-time event shock is modeled separately in the game.</p>`;
  const update=()=>{
    const result=introScenario(selected,weight),{effect,current,base,changed}=result;
    root.querySelector('#introWeight').value=`${weight}%`;
    root.querySelector('#introMedian').textContent=money(changed.median);
    root.querySelector('#introDifference').textContent=`${signed(changed.median-base.median)} index points versus the unchanged model`;
    root.querySelector('#introFactorHint').textContent=result.factor.description;
    root.querySelector('#introChart').innerHTML=chart(base,changed);
    root.querySelector('#introEffects').innerHTML=`<div><small>ANNUAL DRIFT μ</small><b>${pct(baseline.mu)} → ${pct(current.mu)}</b><span>After the factor-group average, this assumption changes annual μ by ${(100*(current.mu-baseline.mu)).toFixed(2)} percentage points.</span></div><div><small>ANNUAL VOLATILITY σ</small><b>${pct(baseline.sigma)} → ${pct(current.sigma)}</b><span>This widens or narrows Brownian price paths. A wider range can lower the median even when μ rises.</span></div>`;
    root.querySelector('#introMuTerm').classList.toggle('changed',Math.abs(effect.drift)>1e-10);
    root.querySelector('#introSigmaTerm').classList.toggle('changed',Math.abs(effect.vol)>1e-10);
  };
  root.querySelector('#introFactor').onchange=event=>{selected=event.target.value;update()};
  root.querySelector('#introSlider').oninput=event=>{weight=Number(event.target.value);update()};
  update();
}
