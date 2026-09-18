import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

const directory = await mkdtemp(path.join(tmpdir(), 'progressive-results-'));
process.env.CHAT_ARCHIVE_DIR = directory;
const review = await import('../server/services/review.service.js');
const gate = () => { let release; const promise = new Promise(r => { release = r; }); return {promise, release}; };
async function archive(room, createdAt = 1000, count = 1) {
  await writeFile(path.join(directory, `${room}-r1-${createdAt}.json`), JSON.stringify({
    roomId: `${room}__r1`, createdAt, video_id_index: 0, round_number: 1,
    messages: Array.from({length: count}, (_, i) => ({id: String(i), nickname:'student', text:`저축 계획 ${i}`, ai:{state:'DONE'}})),
    perUser: {student:{totalMessages:count,totalReactions:0,labels:{계획성:count}}},
  }));
}
test.after(() => rm(directory, {recursive:true,force:true}));

test('basic final results return while AI is blocked; concurrent viewers share one evaluation', async t => {
  await archive('deferred');
  const blocked = gate(); let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; await blocked.promise; return Response.json({personalized_feedback:'저축 계획을 세웠습니다.'}); });
  try {
    const results = await Promise.race([
      Promise.all(Array.from({length:8}, () => review.generateMultiVideoFinalResult('deferred__r1','student',[0],{deferAI:true}))),
      new Promise(resolve => setTimeout(() => resolve(null), 250)),
    ]);
    assert.ok(results, 'basic dashboard must not wait for the AI response');
    assert.equal(results[0].sections.overall.totalMessages,1);
    assert.equal(results[0].sections.aiSummaryStatus,'pending');
    assert.equal(calls,1, 'same input must only start one AI request');
    blocked.release();
    const ready = await review.generateMultiVideoFinalResult('deferred__r1','student',[0]);
    assert.equal(ready.sections.aiSummaryStatus,'ready');
    assert.equal(ready.sections.aiSummary,'저축 계획을 세웠습니다.');
    assert.equal(calls,1);
  } finally { blocked.release(); }
});

test('new numeric archive timestamps invalidate final statistics and personal feedback', async t => {
  t.mock.method(globalThis,'fetch', async (_url, init) => Response.json({personalized_feedback:`발언 ${JSON.parse(init.body).user_messages.length}개`}));
  await archive('fresh',1000,1);
  const first = await review.generateMultiVideoFinalResult('fresh','student',[0]);
  assert.equal(first.sections.overall.totalMessages,1);
  await archive('fresh',2000,2);
  const second = await review.generateMultiVideoFinalResult('fresh','student',[0]);
  assert.equal(second.sections.overall.totalMessages,2);
  assert.equal(second.sections.aiSummary,'발언 2개');
});

test('failed AI is distinguished from no participation and does not erase statistics', async t => {
  t.mock.method(globalThis,'fetch',async () => new Response('unavailable',{status:503}));
  await archive('failure');
  const result = await review.generateMultiVideoFinalResult('failure','student',[0]);
  assert.equal(result.sections.overall.totalMessages,1);
  assert.equal(result.sections.aiSummaryStatus,'error');
  const empty = await review.generateMultiVideoFinalResult('failure','absent',[0]);
  assert.equal(empty.sections.aiSummaryStatus,'empty');
});

test('room summary requests share an in-flight operation including background force requests', async t => {
  await archive('overall');
  const blocked = gate(); let calls = 0;
  t.mock.method(globalThis,'fetch',async () => {calls++; await blocked.promise; return Response.json({discussion_summary:'함께 계획했습니다.'});});
  try {
    const requests = Array.from({length:5}, (_, i) => review.generateOverallSummary('overall__r1',{force:i===4}));
    await new Promise(resolve=>setTimeout(resolve,50));
    assert.equal(calls,1);
    blocked.release();
    const results = await Promise.all(requests);
    assert.equal(results[0].summaryText,'함께 계획했습니다.');
  } finally {blocked.release();}
});

test('aggregate still marked pending cannot be advertised as final from DONE message flags', async t => {
  t.mock.method(globalThis,'fetch',async()=>Response.json({personalized_feedback:'피드백'}));
  await writeFile(path.join(directory,'aggregate-pending-r1-1000.json'),JSON.stringify({
    roomId:'aggregate-pending__r1',createdAt:1000,video_id_index:0,round_number:1,
    classification:{status:'pending',pending:1,failed:0},
    messages:[{nickname:'student',text:'계획',ai:{state:'DONE'}}],
    perUser:{student:{totalMessages:1,totalReactions:0,labels:{}}},
  }));
  const result=await review.generateMultiVideoFinalResult('aggregate-pending','student',[0]);
  assert.equal(result.sections.classification.status,'pending');
  assert.equal(result.sections.classification.pending,1);
});

test('explicit retry replaces a failed personal summary and shares the retry with other viewers',async t=>{
  await archive('retry');
  let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;return calls===1 ? new Response('failure',{status:503}) : Response.json({personalized_feedback:'다시 생성한 피드백'});});
  assert.equal((await review.generateMultiVideoFinalResult('retry','student',[0])).sections.aiSummaryStatus,'error');
  const results=await Promise.all(Array.from({length:5},()=>review.generateMultiVideoFinalResult('retry','student',[0],{retryAI:true})));
  assert.equal(calls,2);
  assert.equal(results[0].sections.aiSummary,'다시 생성한 피드백');
});

test('deferred room summary GET reflects completion without another generation request',async t=>{
  await archive('overall-deferred');const blocked=gate();
  t.mock.method(globalThis,'fetch',async()=>{await blocked.promise;return Response.json({discussion_summary:'완료된 총평'});});
  try {
    const pending=await review.generateOverallSummary('overall-deferred__r1',{deferAI:true});
    assert.equal(pending.status,'pending');blocked.release();
    await new Promise(r=>setTimeout(r,10));
    assert.equal(review.getOverallSummary('overall-deferred__r1').status,'ready');
  } finally {blocked.release();}
});

test('requesting an earlier lesson after cleanup never summarizes a later lesson',async t=>{
  await archive('round-scoped',1000);
  await writeFile(path.join(directory,'round-scoped-r2-2000.json'),JSON.stringify({roomId:'round-scoped__r2',createdAt:2000,video_id_index:1,round_number:2,messages:[{nickname:'student',text:'다른 차시 내용'}]}));
  t.mock.method(globalThis,'fetch',async (_url,init)=>Response.json({discussion_summary:JSON.parse(init.body).all_user_messages[0].text}));
  const summary=await review.generateOverallSummary('round-scoped__r1');
  assert.equal(summary.summaryText,'저축 계획 0');
});
