import test from 'node:test';
import assert from 'node:assert/strict';
import {alignedReturns,correlationMatrix,simulatePortfolio} from '../web/portfolio-model.js';

test('portfolio alignment uses only common dated returns',()=>{
  const rows=(offset)=>Array.from({length:62},(_,i)=>({date:new Date(Date.UTC(2025,0,1+i+offset)).toISOString().slice(0,10),close:100+i}));
  const aligned=alignedReturns([{rows:rows(0)},{rows:rows(2)}]);
  assert.equal(aligned.dates[0],'2025-01-04');
  assert.equal(aligned.returns[0].length,2);
  assert.ok(aligned.dates.length>=40);
});

test('common shocks make a concentrated portfolio riskier than a diversified one',()=>{
  const model=[{mu:.08,sigma:.3},{mu:.08,sigma:.3}],correlation=[[1,.2],[.2,1]],days=252,budget=10000,n=600;
  const concentrated=simulatePortfolio({model,correlation,weights:[1,0],cashWeight:0,days,budget,n});
  const diversified=simulatePortfolio({model,correlation,weights:[.5,.5],cashWeight:0,days,budget,n});
  assert.ok(diversified.annualVol<concentrated.annualVol);
  assert.ok(diversified.hi-diversified.lo<concentrated.hi-concentrated.lo);
  assert.equal(simulatePortfolio({model,correlation,weights:[0,0],cashWeight:1,days,budget,n}).median,budget);
});

test('correlation estimate is symmetric with unit diagonal',()=>{
  const rows=Array.from({length:80},(_,i)=>[Math.sin(i/5)+i/20,Math.cos(i/7)+i/30]);
  const c=correlationMatrix(rows);
  assert.equal(c[0][0],1);assert.equal(c[1][1],1);assert.equal(c[0][1],c[1][0]);
  assert.ok(Math.abs(c[0][1])<1);
});
