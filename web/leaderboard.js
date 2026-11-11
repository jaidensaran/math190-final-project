import {companies} from './catalog.js';
import {parameters,simulate,crps} from './model.js';

// CRPS is measured on the same rebased-100 price index for every round. Skill
// compares each forecast with its own unchanged, same-origin baseline.
export function rankedForecasts(journal,symbol='all'){
  return journal.filter(f=>(symbol==='all'||f.symbol===symbol)&&f.result&&Number.isFinite(f.result.score)&&Number.isFinite(f.result.baselineScore)&&f.result.baselineScore>1e-9)
    .map(f=>({forecast:f,skill:1-f.result.score/f.result.baselineScore}))
    .sort((a,b)=>b.skill-a.skill||a.forecast.result.score-b.forecast.result.score||a.forecast.created.localeCompare(b.forecast.created));
}

export function stockSummaries(journal){
  const grouped=new Map();
  for(const row of rankedForecasts(journal)){
    const symbol=row.forecast.symbol,existing=grouped.get(symbol)||{symbol,runs:0,totalSkill:0,bestSkill:-Infinity};
    existing.runs++;existing.totalSkill+=row.skill;existing.bestSkill=Math.max(existing.bestSkill,row.skill);grouped.set(symbol,existing);
  }
  return [...grouped.values()].map(s=>({...s,meanSkill:s.totalSkill/s.runs})).sort((a,b)=>b.meanSkill-a.meanSkill||b.runs-a.runs||a.symbol.localeCompare(b.symbol));
}

// Leave one modeled slider at 50% while keeping the locked baseline, seed,
// horizon, and realized close fixed. This is score sensitivity, not evidence
// that a news event caused the price move.
export function factorChecks(f,actualIndex,limit=3){
  if(!Number.isFinite(actualIndex)||!f.baseline||!f.weights||!Array.isArray(f.terminal))return [];
  const company=companies.find(c=>c.symbol===f.symbol);if(!company)return [];
  const effects=parameters(company,f.weights,f.baseline).effects.filter(e=>e.x!==0)
    .sort((a,b)=>(Math.abs(b.drift)+Math.abs(b.vol))-(Math.abs(a.drift)+Math.abs(a.vol))).slice(0,limit);
  const score=crps(f.terminal,actualIndex);
  return effects.map(e=>{
    const weights={...f.weights,[e.id]:50},p=parameters(company,weights,f.baseline);
    const counterfactual=simulate({s0:100,mu:p.mu,sigma:p.sigma,days:f.days,seed:f.seed??731});
    return{id:e.id,name:e.name,weight:f.weights[e.id],scoreChange:crps(counterfactual.terminal,actualIndex)-score};
  });
}
