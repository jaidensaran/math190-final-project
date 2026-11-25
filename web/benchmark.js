import {calibrate} from './model.js';

const cache=new Map();
export async function fetchBenchmark(days,origin=null,force=false){
 const key=`${days}:${origin||'recent'}`,hit=cache.get(key);
 if(!force&&hit&&hit.expires>Date.now())return hit.data;
 const query=new URLSearchParams({days:String(days)});if(origin)query.set('origin',origin);
 const response=await fetch('/api/benchmark?'+query);
 const data=await response.json();
 if(!response.ok)throw new Error(data.error||'S&P 500 history is unavailable.');
 cache.set(key,{data,expires:Date.now()+15*60*1000});return data;
}

export function replayBenchmark(rows,dates,startPrice){
 if(!Array.isArray(rows)||!Array.isArray(dates)||dates.length<2||!Number.isFinite(startPrice)||startPrice<=0)return null;
 let index=rows.findLastIndex(row=>row.date<=dates[0]);if(index<0)return null;
 const first=rows[index].close;if(!Number.isFinite(first)||first<=0)return null;
 const values=[];
 for(const date of dates){while(index+1<rows.length&&rows[index+1].date<=date)index++;values.push(startPrice*rows[index].close/first)}
 if(rows[index].date<dates.at(-1))return null;
 return{values,return:values.at(-1)/startPrice-1,from:rows.findLast(row=>row.date<=dates[0]).date,to:rows[index].date};
}

export function portfolioBenchmark(rows,budget,days){
 if(!Array.isArray(rows)||rows.length<41||!Number.isFinite(budget)||budget<=0||!Number.isInteger(days)||days<1)return null;
 const fit=calibrate(rows.slice(-253));
 const values=Array.from({length:days+1},(_,day)=>budget*Math.exp((fit.mu-.5*fit.sigma**2)*day/252));
 return{values,median:values.at(-1),mu:fit.mu,sigma:fit.sigma,asOf:rows.at(-1).date};
}
