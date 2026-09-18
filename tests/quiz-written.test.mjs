import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAnswers, gradeAnswers} from '../server/data/quiz-rules.js';
import {saveQuizResponse} from '../server/repositories/quiz-responses.repo.js';
import {pool} from '../server/db.js';
const answers={'p9-q1':2,'p9-q2':1,'p12-q1':1,'p12-q2':1,'p26-q1':1,'p26-q2':'현금서비스는 대출이므로 신중하게 사용해야 합니다.'};
test('written answer is required for submission but never adds to the choice score',()=>{
 assert.deepEqual(gradeAnswers(1,answers),{correct:5,total:5,score:1});
 assert.throws(()=>validateAnswers(1,{...answers,'p26-q2':'   '},true),/서답형/);
 assert.throws(()=>validateAnswers(1,{...answers,'p26-q2':'가'.repeat(2001)},true),/2000/);
 assert.throws(()=>validateAnswers(1,{...answers,'p26-q2':123},true),/문자/);
 assert.throws(()=>validateAnswers(1,{...answers,unknown:'x'}),/문항/);
 assert.throws(()=>validateAnswers(3,{}),/퀴즈/);
 assert.deepEqual(validateAnswers(1,{'p26-q2':' 수정한 의견 '}),{'p26-q2':'수정한 의견'});
});
test('submission writes answers and grade atomically and rolls back if grade saving fails',async()=>{
 const original=pool.getConnection;let events=[];let fail=false;
 pool.getConnection=async()=>({beginTransaction:async()=>events.push('begin'),commit:async()=>events.push('commit'),rollback:async()=>events.push('rollback'),release:()=>events.push('release'),query:async(sql,params)=>{events.push({sql,params});if(fail && sql.includes('user_round_scores'))throw Error('storage down');return [{affectedRows:1}];}});
 try {
  await saveQuizResponse('student-a',1,answers,{correct:5,total:5,score:1});
  assert.equal(events[0],'begin');assert.deepEqual(events.slice(-2),['commit','release']);
  assert.equal(events[1].params[0],'student-a');assert.deepEqual(JSON.parse(events[1].params[2]),answers);
  events=[];fail=true;
  await assert.rejects(()=>saveQuizResponse('student-a',1,answers,{score:1}),/storage down/);
  assert.deepEqual(events.slice(-2),['rollback','release']);assert.equal(events.includes('commit'),false);
 } finally {pool.getConnection=original;await pool.end();}
});
