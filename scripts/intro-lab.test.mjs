import test from 'node:test';
import assert from 'node:assert/strict';
import {introScenario} from '../web/intro-lab.js';

test('tutorial uses the game parameter and simulation model',()=>{
  const neutral=introScenario('earnings',50);
  const stronger=introScenario('earnings',90);
  assert.equal(neutral.current.mu,neutral.baseline.mu);
  assert.equal(neutral.current.sigma,neutral.baseline.sigma);
  assert.equal(neutral.changed.median,neutral.base.median);
  assert.ok(stronger.current.mu>neutral.current.mu);
  assert.ok(stronger.current.sigma>neutral.current.sigma);
  assert.ok(stronger.changed.median>neutral.changed.median);
  assert.equal(stronger.base.median,neutral.base.median);
});
