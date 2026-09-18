import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {once} from 'node:events';
import reviewRoutes from '../server/routes/review.routes.js';
import {isTeacherSocket} from '../server/middlewares/teacher.js';
import authRoutes from '../server/routes/auth.routes.js';
const require=createRequire(new URL('../server/package.json',import.meta.url));
const express=require('express'),bcrypt=require('bcrypt'),jwt=require('jsonwebtoken');
process.env.JWT_SECRET='local-teacher-auth-test';
process.env.FINANCIAL_TEACHER_PASSWORD_HASH=await bcrypt.hash('test-teacher-password',4);
test('only configured teacher password grants teacher role; no shared cookie issued',async()=>{
 const app=express();app.use(express.json());app.use('/api/auth',authRoutes);app.use('/api/review',reviewRoutes);
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}`;
 try {
  const attempt=password=>fetch(base+'/api/auth/teacher/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password})});
  assert.equal((await attempt('wrong-password')).status,401);
  const response=await attempt('test-teacher-password');assert.equal(response.status,200);assert.equal(response.headers.get('set-cookie'),null);
  const {token,user}=await response.json();assert.equal(user.role,'admin');assert.ok(token);
  const me=await fetch(base+'/api/auth/me',{headers:{Authorization:`Bearer ${token}`}});
  assert.equal((await me.json()).user.role,'admin');
  const student=jwt.sign({uid:'student',nn:'student',role:'user'},process.env.JWT_SECRET);
  for (const path of ['/api/review/general/final-result?nickname=other','/api/review/general/overall-summary?force=true']) {
    assert.equal((await fetch(base+path,{headers:{Authorization:`Bearer ${student}`}})).status,403);
  }
  const unauthorized=await fetch(base+'/api/review/general/multi-final-result',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${student}`},body:JSON.stringify({nickname:'other',videoIds:[0]})});
  assert.equal(unauthorized.status,403);
  assert.equal((await fetch(base+'/api/review/general/final-result')).status,401);

 } finally {server.closeAllConnections();await new Promise(r=>server.close(r));}
});

test('socket permissions reject student, forged and expired teacher tokens',()=>{
 const check=token=>isTeacherSocket({handshake:{auth:{token}}});
 assert.equal(check(jwt.sign({role:'admin'},process.env.JWT_SECRET)),true);
 assert.equal(check(jwt.sign({role:'user'},process.env.JWT_SECRET)),false);
 assert.equal(check(jwt.sign({role:'admin'},'forged-secret')),false);
 assert.equal(check(jwt.sign({role:'admin'},process.env.JWT_SECRET,{expiresIn:-1})),false);
 assert.equal(check(undefined),false);
});
