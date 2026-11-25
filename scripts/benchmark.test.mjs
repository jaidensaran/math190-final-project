import test from 'node:test';
import assert from 'node:assert/strict';
import {replayBenchmark,portfolioBenchmark} from '../web/benchmark.js';
import {judgeReplay} from '../web/game-score.js';

test('replay benchmark uses only prices available on each stock date',()=>{
 const rows=[{date:'2025-01-02',close:100},{date:'2025-01-03',close:110},{date:'2025-01-06',close:90},{date:'2025-01-07',close:120}];
 const result=replayBenchmark(rows,['2025-01-02','2025-01-03','2025-01-06'],50);
 assert.deepEqual(result.values,[50,55,45]);
 assert.ok(Math.abs(result.return+.1)<1e-12);
 assert.equal(result.to,'2025-01-06');
 assert.equal(replayBenchmark(rows.slice(0,2),['2025-01-02','2025-01-06'],50),null);
});

test('portfolio comparison draws a dated GBM median from index history',()=>{
 const rows=Array.from({length:90},(_,i)=>({date:new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10),close:100+i*.2}));
 const result=portfolioBenchmark(rows,10000,63);
 assert.equal(result.values.length,64);
 assert.equal(result.values[0],10000);
 assert.equal(result.median,result.values.at(-1));
 assert.equal(result.asOf,rows.at(-1).date);
});

test('replay win requires a closer median and interval coverage',()=>{
 const forecast={baselineTerminal:[80,100,120]};
 assert.equal(judgeReplay(forecast,{actualIndex:110,medianError:5,covered:true}).won,true);
 assert.equal(judgeReplay(forecast,{actualIndex:110,medianError:5,covered:false}).won,false);
 assert.equal(judgeReplay(forecast,{actualIndex:110,medianError:10,covered:true}).won,false);
});
