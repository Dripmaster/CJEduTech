import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
process.env.AI_SUMMARY_CONCURRENCY='2';
process.env.AI_SUMMARY_TIMEOUT_MS='100';
const {startSummary,fetchAIJson}=await import('../server/services/summary-jobs.js');

test('summary queue bounds concurrency across independent rooms and continues after failure',async()=>{
 let active=0,maximum=0;
 const jobs=Array.from({length:7},(_,i)=>startSummary(`queue-${i}`,async()=>{
  active++;maximum=Math.max(maximum,active);
  await new Promise(r=>setTimeout(r,10));active--;
  if(i===0)throw new Error('expected isolated failure');
  return `room-${i}`;
 }));
 await Promise.all(jobs.map(j=>j.promise));
 assert.equal(maximum,2);
 assert.equal(jobs[0].status,'error');
 assert.equal(jobs[6].value,'room-6');
});

test('an unresponsive AI request times out and releases the queue',async()=>{
 const server=createServer(()=>{});server.listen(0,'127.0.0.1');await once(server,'listening');
 try {
  const blocked=startSummary('timeout',()=>fetchAIJson(`http://127.0.0.1:${server.address().port}`,{}));
  await blocked.promise;
  assert.equal(blocked.status,'error');
  const healthy=startSummary('after-timeout',async()=>'complete');await healthy.promise;
  assert.equal(healthy.value,'complete');
 } finally {server.closeAllConnections();await new Promise(r=>server.close(r));}
});
