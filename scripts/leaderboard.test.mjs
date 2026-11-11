import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankedForecasts,stockSummaries,factorChecks} from '../web/leaderboard.js';
import {companies,events} from '../web/catalog.js';
import {parameters,simulate,crps} from '../web/model.js';

test('leaderboard ranks evaluated forecasts by improvement over their own baselines',()=>{
  const f=(symbol,score,baselineScore,created)=>({symbol,created,result:{score,baselineScore}});
  const runs=[f('AAPL',3,4,'2026-01-02'),f('MSFT',4,10,'2026-01-03'),f('AAPL',2,3,'2026-01-04'),{symbol:'NVDA',created:'2026-01-05'},f('IBM',1,0,'2026-01-06')];
  assert.deepEqual(rankedForecasts(runs).map(x=>x.forecast.symbol),['MSFT','AAPL','AAPL']);
  assert.deepEqual(rankedForecasts(runs,'AAPL').map(x=>x.forecast.created),['2026-01-04','2026-01-02']);
  const summary=stockSummaries(runs);assert.equal(summary[0].symbol,'MSFT');assert.equal(summary[1].runs,2);assert.ok(summary[0].meanSkill>summary[1].meanSkill);
});

test('factor check holds the outcome fixed and measures one-slider score sensitivity',()=>{
  const company=companies.find(c=>c.symbol==='AAPL'),baseline={mu:.07,sigma:.25},weights=Object.fromEntries(events.map(e=>[e.id,50]));
  assert.deepEqual(factorChecks({symbol:'AAPL',weights,baseline,days:21,terminal:[100]},105),[]);
  weights.rates=100;const p=parameters(company,weights,baseline),terminal=simulate({mu:p.mu,sigma:p.sigma,days:21}).terminal;
  const checks=factorChecks({symbol:'AAPL',weights,baseline,days:21,terminal,seed:731},105);
  assert.equal(checks.length,1);assert.equal(checks[0].id,'rates');
  const neutral=simulate({mu:baseline.mu,sigma:baseline.sigma,days:21}).terminal;
  assert.ok(Math.abs(checks[0].scoreChange-(crps(neutral,105)-crps(terminal,105)))<1e-9);
});
