import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {once} from 'node:events';
import quizRoutes from '../server/routes/quiz.routes.js';
import {errorHandler} from '../server/middlewares/error.js';
import {pool} from '../server/db.js';
const require=createRequire(new URL('../server/package.json',import.meta.url));
const express=require('express'),jwt=require('jsonwebtoken');
process.env.JWT_SECRET='quiz-test-only';
test('quiz API restores student drafts, isolates users, lets teachers read, and recomputes scores',async()=>{
 const records=new Map();const originalQuery=pool.query,originalConnection=pool.getConnection;let grade;
 pool.query=async(sql,params)=>{
  if(sql.includes('JOIN users'))return [[...records.values()].filter(row=>row.round===params[0]).map(row=>({...row,nickname:row.user_id}))];
  return [[records.get(`${params[0]}:${params[1]}`)].filter(Boolean)];
 };
 pool.getConnection=async()=>({beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{},query:async(sql,params)=>{
  if(sql.includes('user_quiz_responses'))records.set(`${params[0]}:${params[1]}`,{user_id:params[0],round:params[1],answers:params[2],submitted_at:sql.includes('?, ?, ?, CURRENT_TIMESTAMP')?'2026-09-19T00:00:00Z':null});
  else grade=params;
  return [{affectedRows:1}];
 }});
 const app=express();app.use(express.json());app.use('/api/quiz',quizRoutes);app.use(errorHandler);
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}/api/quiz/responses`;
 const token=(uid,role)=>jwt.sign({uid,nn:uid,...(role?{role}:{})},process.env.JWT_SECRET);
 const a=token('student-a'),b=token('student-b'),teacher=token('teacher','admin');
 const request=(path,token,method='GET',body)=>fetch(base+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`} : {}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 try {
  assert.equal((await request('/1',null)).status,401);
  assert.equal((await request('/1/class',a)).status,403);
  assert.equal((await request('/1',teacher,'PUT',{answers:{}})).status,403);
  const draft={'p26-q2':'초기 답변'};
  assert.equal((await request('/1',a,'PUT',{answers:draft,user_id:'student-b'})).status,200);
  assert.deepEqual((await (await request('/1',a)).json()).answers,draft);
  assert.deepEqual((await (await request('/1?user_id=student-a',b)).json()).answers,{});
  let rows=(await (await request('/1/class',teacher)).json()).responses;
  assert.equal(rows[0].nickname,'student-a');assert.equal(rows[0].submittedAt,null);
  const complete={'p9-q1':2,'p9-q2':1,'p12-q1':1,'p12-q2':1,'p26-q1':1,'p26-q2':'수정한 의견'};
  const saved=await request('/1/submit',a,'POST',{answers:complete,correct:0,total:100});
  assert.equal(saved.status,200);assert.equal((await saved.json()).score,1);assert.deepEqual(grade,['student-a',1]);
  rows=(await (await request('/1/class',teacher)).json()).responses;
  assert.equal(rows[0].answers['p26-q2'],'수정한 의견');assert.ok(rows[0].submittedAt);
  assert.equal((await request('/1/submit',a,'POST',{answers:{...complete,'p26-q2':''}})).status,400);
  assert.equal((await request('/3',a,'PUT',{answers:{}})).status,400);
 } finally {
  pool.query=originalQuery;pool.getConnection=originalConnection;
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await pool.end();
 }
});
