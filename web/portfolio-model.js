import {calibrate,gaussian,quantile,rng} from './model.js';
import {parameters} from './model.js';

// Align returns by session date before estimating cross-stock dependence.
export function alignedReturns(holdings,limit=252){
  if(holdings.length<2||holdings.length>5)throw new Error('Choose two to five stocks.');
  const maps=holdings.map(({rows})=>new Map(rows.slice(1).map((row,i)=>[row.date,Math.log(row.close/rows[i].close)])));
  const dates=[...maps[0].keys()].filter(date=>maps.every(map=>map.has(date))).sort().slice(-limit);
  if(dates.length<40)throw new Error('These stocks need at least 40 shared daily returns. Load matching histories or choose other stocks.');
  return {dates,returns:dates.map(date=>maps.map(map=>map.get(date)))};
}

export function correlationMatrix(returns,shrink=.2){
  const n=returns.length,k=returns[0].length;
  const means=Array.from({length:k},(_,i)=>returns.reduce((sum,row)=>sum+row[i],0)/n);
  const covariance=Array.from({length:k},(_,i)=>Array.from({length:k},(_,j)=>returns.reduce((sum,row)=>sum+(row[i]-means[i])*(row[j]-means[j]),0)/(n-1)));
  if(covariance.some((row,i)=>!Number.isFinite(row[i])||row[i]<=0))throw new Error('A selected price series has no usable return variation.');
  return covariance.map((row,i)=>row.map((value,j)=>i===j?1:(1-shrink)*value/Math.sqrt(covariance[i][i]*covariance[j][j])));
}

function cholesky(matrix){
  const k=matrix.length,L=Array.from({length:k},()=>Array(k).fill(0));
  for(let i=0;i<k;i++)for(let j=0;j<=i;j++){
    let value=matrix[i][j];for(let z=0;z<j;z++)value-=L[i][z]*L[j][z];
    L[i][j]=i===j?Math.sqrt(Math.max(value,1e-12)):value/L[j][j];
  }
  return L;
}

export function portfolioInputs(holdings,weights,days=21){
  if(holdings.length!==weights.length||new Set(holdings.map(h=>h.symbol)).size!==holdings.length)throw new Error('Portfolio stocks must be distinct.');
  if(weights.some(w=>!Number.isFinite(w)||w<0||w>1)||weights.reduce((a,b)=>a+b,0)>1+1e-9)throw new Error('Stock weights must total 100% or less; the rest stays in cash.');
  const {dates,returns}=alignedReturns(holdings),correlation=correlationMatrix(returns);
  const model=holdings.map(({company,rows},i)=>{
    const baseline=calibrate(rows.filter(row=>row.date<=dates.at(-1)).slice(-253));
    const current=parameters(company,holdings[i].eventWeights||{},baseline,days);
    return {symbol:company.symbol,mu:current.mu,sigma:current.sigma,startPrice:rows.at(-1).rawClose??rows.at(-1).close};
  });
  return {model,correlation,dates,weights,cashWeight:Math.max(0,1-weights.reduce((a,b)=>a+b,0))};
}

export function simulatePortfolio({model,correlation,weights,cashWeight,days,budget=10000,n=600,seed=731,shock=null}){
  if(!Number.isInteger(days)||days<1||days>1260||!Number.isFinite(budget)||budget<=0||n<2||!Number.isInteger(n))throw new Error('Invalid portfolio horizon, budget, or path count.');
  if(shock&&(!Number.isFinite(shock.probability)||shock.probability<0||shock.probability>1||!Number.isFinite(shock.move)||shock.move<=-1||shock.move>1))throw new Error('Invalid portfolio event shock.');
  const k=model.length,L=cholesky(correlation),random=rng(seed),eventRandom=rng(seed+1103),columns=Array.from({length:days+1},()=>[]),terminal=[];
  const paths=[];
  for(let path=0;path<n;path++){
    const relative=Array(k).fill(1),wealthPath=[budget],eventDay=shock&&eventRandom()<shock.probability?1+Math.floor(eventRandom()*days):0;columns[0].push(budget);
    for(let day=1;day<=days;day++){
      const z=Array.from({length:k},()=>gaussian(random));
      for(let i=0;i<k;i++){
        let shock=0;for(let j=0;j<=i;j++)shock+=L[i][j]*z[j];
        const {mu,sigma}=model[i];relative[i]*=Math.exp((mu-.5*sigma*sigma)/252+sigma*shock/Math.sqrt(252));
      }
      if(day===eventDay)for(let i=0;i<k;i++)relative[i]*=1+shock.move;
      const wealth=budget*(cashWeight+weights.reduce((sum,w,i)=>sum+w*relative[i],0));
      wealthPath.push(wealth);columns[day].push(wealth);
    }
    terminal.push(wealthPath.at(-1));if(path<24)paths.push(wealthPath);
  }
  const bands=columns.map(values=>{values.sort((a,b)=>a-b);return {lo:quantile(values,.1),mid:quantile(values,.5),hi:quantile(values,.9)}});
  terminal.sort((a,b)=>a-b);
  const annualVariance=weights.reduce((sum,wi,i)=>sum+weights.reduce((part,wj,j)=>part+wi*wj*model[i].sigma*model[j].sigma*correlation[i][j],0),0);
  return {bands,paths,terminal,median:quantile(terminal,.5),mean:terminal.reduce((a,b)=>a+b,0)/n,lo:quantile(terminal,.1),hi:quantile(terminal,.9),p05:quantile(terminal,.05),loss:terminal.filter(x=>x<budget).length/n,annualVol:Math.sqrt(Math.max(0,annualVariance)),budget,days};
}
