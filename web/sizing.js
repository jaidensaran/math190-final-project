import {quantile} from './model.js';

const COST = 0.001; // Illustrative round-trip cost on invested capital.
const RISK = {cautious:4,balanced:2,growth:1};

function utility(wealth,gamma){
  if(wealth<=0)return -Infinity;
  return gamma===1?Math.log(wealth):(wealth**(1-gamma)-1)/(1-gamma);
}

function optimum(returns,maxWeight,gamma){
  let bestWeight=0,best=-Infinity;
  for(let i=0;i<=100;i++){
    const weight=maxWeight*i/100;
    const value=returns.reduce((sum,r)=>sum+utility(1+weight*(r-COST),gamma),0)/returns.length;
    if(value>best+1e-12){best=value;bestWeight=weight;}
  }
  return bestWeight;
}

export function sizePosition({terminal,startPrice=100,budget,allocation,maxLossPct,riskProfile='balanced',mu=0,days=21,price=null}){
  if(!Array.isArray(terminal)||terminal.length<2||terminal.some(x=>!Number.isFinite(x)||x<=0)||!Number.isFinite(startPrice)||startPrice<=0||!Number.isFinite(budget)||budget<=0||!Number.isFinite(allocation)||allocation<0||allocation>100||!Number.isFinite(maxLossPct)||maxLossPct<0||maxLossPct>100||!RISK[riskProfile])throw new Error('Invalid position-sizing inputs');
  const returns=terminal.map(x=>x/startPrice-1),p05=quantile(terminal,.05)/startPrice-1;
  const tailLossPerDollar=Math.max(0,-p05+COST);
  const maxWeight=tailLossPerDollar>0?Math.min(1,maxLossPct/100/tailLossPerDollar):1;
  const gamma=RISK[riskProfile],modeled=optimum(returns,maxWeight,gamma);
  // Shift only drift, preserving the dispersion of the original paths.
  const driftHaircut=Math.max(.05,Math.abs(mu)*.5)*days/252;
  const stressed=returns.map(r=>(1+r)*Math.exp(-driftHaircut)-1);
  const stress=optimum(stressed,maxWeight,gamma);
  const weight=allocation/100,invested=budget*weight,expected=weight===0?0:budget*weight*(returns.reduce((a,b)=>a+b,0)/returns.length-COST);
  const fifth=weight===0?0:budget*weight*(p05-COST),lossProbability=returns.filter(r=>weight*(r-COST)<0).length/returns.length;
  const pnlAt=p=>weight===0?0:budget*weight*(quantile(terminal,p)/startPrice-1-COST);
  const sharePrice=Number.isFinite(price)&&price>0?price:null;
  const shares=sharePrice?Math.floor((invested+1e-8)/sharePrice):null;
  return{budget,weight,invested,unallocated:budget-invested,expected,fifth,median:pnlAt(.5),p10:pnlAt(.1),p90:pnlAt(.9),lossProbability,modeled,stress,range:[Math.min(modeled,stress),Math.max(modeled,stress)],maxWeight,tailLossPerDollar,shares,sharePrice,shareCost:shares===null?null:shares*sharePrice,shareRemainder:shares===null?null:invested-shares*sharePrice};
}

export const sizingProfiles=RISK;

// An analytic GBM extrapolation for the separate, unscored holding-period card.
// It deliberately holds mu and sigma constant across all selected years.
export function longTermProjection({amount,years,mu,sigma}){
  if(![amount,years,mu,sigma].every(Number.isFinite)||amount<0||years<1||years>30||!Number.isInteger(years)||sigma<=0)throw new Error('Invalid holding-period inputs');
  const center=(mu-.5*sigma*sigma)*years,spread=sigma*Math.sqrt(years);
  const value=z=>amount*Math.exp(center+z*spread);
  return{median:value(0),low:value(-1.2815515655),high:value(1.2815515655),mean:amount*Math.exp(mu*years)};
}
