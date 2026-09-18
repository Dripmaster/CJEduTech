import test from 'node:test';
import assert from 'node:assert/strict';
const tick=()=>new Promise(r=>setTimeout(r,10));
const {observeResult}=await import('../src/lib/result-observer.js').catch(()=>({}));

test('result polling publishes partial results, avoids overlap, and stops after completion',async()=>{
 assert.equal(typeof observeResult,'function','result observer is available');
 let active=0,maxActive=0,calls=0;const received=[];
 const observer=observeResult({interval:1,load:async()=>{
  calls++;active++;maxActive=Math.max(maxActive,active);await tick();active--;
  return {status:calls<2?'pending':'ready',count:1};
 },onData:result=>received.push(result),onError:assert.fail,isPending:result=>result.status==='pending'});
 observer.refresh();observer.refresh();
 await new Promise(r=>setTimeout(r,60));observer.stop();
 assert.deepEqual(received.map(r=>r.status),['pending','ready']);
 assert.equal(maxActive,1);
 assert.equal(calls,2);
});
test('leaving the dashboard prevents stale requests from updating another learner',async()=>{
 assert.equal(typeof observeResult,'function');
 let release;const values=[];
 const observer=observeResult({load:()=>new Promise(r=>release=r),onData:r=>values.push(r),onError:assert.fail,isPending:()=>false});
 await tick();observer.stop();release({nickname:'old'});await tick();
 assert.deepEqual(values,[]);
});
test('network failures retry without an endless loading loop',async()=>{
 assert.equal(typeof observeResult,'function');
 const errors=[];let calls=0;
 const observer=observeResult({interval:1,load:async()=>{calls++;throw new Error('offline');},onData:assert.fail,onError:(_error,retrying)=>errors.push(retrying),isPending:()=>true});
 await new Promise(r=>setTimeout(r,30));observer.stop();
 assert.equal(calls,3);assert.deepEqual(errors,[true,true,false]);
});
