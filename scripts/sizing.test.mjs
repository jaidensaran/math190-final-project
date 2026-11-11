import test from 'node:test';
import assert from 'node:assert/strict';
import {sizePosition} from '../web/sizing.js';

test('position sizing respects downside budget and converts allocation to whole shares',()=>{
  const terminal=Array.from({length:101},(_,i)=>80+i*.4);
  const a=sizePosition({terminal,budget:1000,allocation:50,maxLossPct:5,price:125,mu:.08,days:21});
  assert.ok(a.maxWeight<.28&&a.maxWeight>.27);
  assert.ok(a.modeled<=a.maxWeight&&a.stress<=a.maxWeight);
  assert.equal(a.invested,500);assert.equal(a.shares,4);assert.equal(a.shareRemainder,0);
  assert.ok(a.fifth<0);
});

test('zero weight has zero exposure and negative edge can favor cash',()=>{
  const terminal=Array.from({length:101},(_,i)=>75+i*.2);
  const a=sizePosition({terminal,budget:2000,allocation:0,maxLossPct:10,riskProfile:'growth',mu:-.1,days:21});
  assert.equal(a.expected,0);assert.equal(a.fifth,0);assert.equal(a.shares,null);assert.equal(a.modeled,0);
});

test('invalid sizing inputs are rejected',()=>{
  assert.throws(()=>sizePosition({terminal:[90,100],budget:-1,allocation:50,maxLossPct:10}));
});

test('a million-dollar, one-year scenario returns dollar outcomes',()=>{
  const terminal=Array.from({length:101},(_,i)=>70+i*.7);
  const result=sizePosition({terminal,budget:1_000_000,allocation:100,maxLossPct:20,riskProfile:'balanced',mu:.12,days:252,price:250});
  assert.equal(result.invested,1_000_000);
  assert.equal(result.shares,4000);
  assert.ok(result.p10<result.median&&result.median<result.p90);
  assert.ok(result.fifth<result.p10);
});
