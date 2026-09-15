import test from 'node:test';
import assert from 'node:assert/strict';
import {pool} from '../server/db.js';
import {saveRoundScore} from '../server/services/quiz.service.js';
import {getScoresByUserId,upsertRoundScore} from '../server/repositories/quiz.repo.js';

test('lesson four writes only its own score column and is returned by retrieval', async () => {
 const original=pool.query;
 const saved={user_id:'student',round1_score:0.8,round2_score:null,round3_score:null,round4_score:null};
 pool.query=async (sql,params) => {
  if(sql.includes('INSERT')) {
   assert.match(sql,/user_id, round4_score/);
   assert.deepEqual(params,['student',0.5]);
   saved.round4_score=params[1];return [{affectedRows:1}];
  }
  assert.match(sql,/round4_score/);return [[saved]];
 };
 try {
  assert.deepEqual(await saveRoundScore({user_id:'student',round:4,correct:1,total:2}),{ok:true,round:4,score:0.5});
  const result=await getScoresByUserId('student');
  assert.equal(result.round1_score,0.8);assert.equal(result.round4_score,0.5);
  await assert.rejects(() => upsertRoundScore({user_id:'student',round:5,score:0.5}));
 } finally {pool.query=original;await pool.end();}
});
