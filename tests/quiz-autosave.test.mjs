import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnswerSaver} from '../src/lib/quiz-autosave.js';
import {quizResultsFromAnswers} from '../src/contents/financial-course.js';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('rapid edits serialize writes and flush persists the latest answer',async()=>{
 const gate=deferred(),writes=[];
 const saver=createAnswerSaver({save:async answers=>{writes.push(answers);if(writes.length===1)await gate.promise;}});
 saver.set({q:0});await Promise.resolve();
 saver.set({q:1});saver.set({q:2});
 assert.deepEqual(writes,[{q:0}]);
 const flushed=saver.flush();gate.resolve();await flushed;
 assert.deepEqual(writes,[{q:0},{q:2}]);assert.equal(saver.status,'saved');
});
test('navigation flushes a debounced written answer and failed saves remain retryable',async()=>{
 let fail=true;const writes=[];
 const saver=createAnswerSaver({save:async answers=>{if(fail)throw Error('offline');writes.push(answers);}});
 saver.set({text:'의견'},60000);
 await assert.rejects(saver.flush(),/offline/);assert.equal(saver.status,'error');
 saver.set({text:'수정한 의견'},60000);fail=false;await saver.flush();
 assert.deepEqual(writes,[{text:'수정한 의견'}]);assert.equal(saver.status,'saved');
});
test('dashboard grades current saved answers even before submit, excludes written and distinguishes unanswered',()=>{
 const answers={1:{'p9-q1':2,'p9-q2':0,'p26-q2':'내 의견'},2:{'p37-q1':0,'p37-q2':0}};
 const rows=quizResultsFromAnswers(answers);
 assert.equal(rows[0].totalQuestions,5);assert.equal(rows[0].correctCount,1);assert.equal(rows[0].unansweredCount,3);
 assert.equal(rows[0].status,'partial');
 assert.equal(rows[1].totalQuestions,2);
 assert.equal(rows[2].status,'not_applicable');assert.equal(rows[3].status,'not_applicable');
 const empty=quizResultsFromAnswers({});assert.equal(empty[0].correctCount,null);
 const wrong=quizResultsFromAnswers({1:{'p9-q1':0}});assert.equal(wrong[0].correctCount,0);
});
