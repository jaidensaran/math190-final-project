import test from 'node:test';
import assert from 'node:assert/strict';
import {simulate} from '../web/model.js';

test('zero-probability event preserves the GBM forecast',()=>{
  const inputs={s0:100,mu:.08,sigma:.25,days:21};
  assert.deepEqual(simulate({...inputs,shock:{probability:0,move:-.2}}).terminal,simulate(inputs).terminal);
});

test('an event shock affects outcomes without changing the Brownian seed',()=>{
  const inputs={s0:100,mu:.08,sigma:.25,days:21};
  const base=simulate(inputs),shocked=simulate({...inputs,shock:{probability:1,move:-.2}});
  assert.ok(shocked.median<base.median*.81);
  assert.deepEqual(shocked.terminal,simulate({...inputs,shock:{probability:1,move:-.2}}).terminal);
  assert.throws(()=>simulate({...inputs,shock:{probability:.5,move:-1}}),/Invalid event shock/);
});
