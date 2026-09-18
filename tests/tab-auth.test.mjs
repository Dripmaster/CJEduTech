import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {authRequired} from '../server/middlewares/auth.js';
const require=createRequire(new URL('../server/package.json',import.meta.url));
const jwt=require('jsonwebtoken');
process.env.JWT_SECRET='local-test-only-secret';
const token=uid=>jwt.sign({uid},process.env.JWT_SECRET);
function authenticate(authorization,cookie){
 const req={cookies:{token:cookie},get:()=>authorization};
 let status=200,passed=false;
 const res={status(n){status=n;return this;},json(){return this;}};
 authRequired(req,res,()=>{passed=true;});
 return {uid:req.user?.uid,status,passed};
}
test('tab identity wins over another student shared cookie',()=>{
 assert.deepEqual(authenticate(`Bearer ${token('student-A')}`,token('student-B')),{uid:'student-A',status:200,passed:true});
});
test('expired or invalid tab authentication never falls back to another user cookie',()=>{
 assert.equal(authenticate('Bearer invalid',token('student-B')).status,401);
});
test('legacy cookie clients remain supported',()=>{
 assert.equal(authenticate(undefined,token('legacy')).uid,'legacy');
});
