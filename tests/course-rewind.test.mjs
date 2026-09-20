import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {once} from 'node:events';
import {io as connect} from 'socket.io-client';
import {syncTarget} from '../src/contents/financial-course.js';
import {initCourseControl} from '../server/services/course-control.service.js';

const require=createRequire(new URL('../server/package.json',import.meta.url));
const {Server}=require('socket.io');
const jwt=require('jsonwebtoken');
const ack=(socket,event,payload={})=>new Promise((resolve,reject)=>{
  socket.timeout(1500).emit(event,payload,(error,result)=>error?reject(error):resolve(result));
});

test('live and reconnect commands from an earlier lesson cannot rewind a student',()=>{
  for(const live of [true,false]) {
    for(const state of [
      {commandId:'old-slide',round:1,step:1,page:1},
      {commandId:'old-quiz',round:1,step:2},
    ]) {
      assert.equal(syncTarget(state,{round:3,step:4},live),null);
    }
  }
});

test('a repeated live quiz/video command cannot reset a later stage of the same lesson',()=>{
  for(const [round,step] of [[2,2],[3,3]]) {
    const state={commandId:'retry',round,step};
    assert.equal(syncTarget(state,{round,step:4},true),null);
    assert.equal(syncTarget(state,{round,step},true),null);
  }
  assert.equal(syncTarget({commandId:'next',round:3,step:3},{round:3,step:1},true).path,'video');
  assert.equal(syncTarget({commandId:'next-page',round:3,step:1,page:43},{round:3,step:1},true).path,'slide');
});

test('a stale teacher cannot replace the active lesson for connected or newly joined students', {timeout:10000}, async()=>{
  process.env.JWT_SECRET='course-rewind-local-test';
  const http=createServer();
  const server=new Server(http);
  initCourseControl(server);
  http.listen(0,'127.0.0.1');
  await once(http,'listening');
  const sockets=[];
  const token=jwt.sign({uid:'teacher',role:'admin'},process.env.JWT_SECRET);
  const join=async teacher=>{
    const socket=connect(`http://127.0.0.1:${http.address().port}/chat`,{
      transports:['websocket'],forceNew:true,auth:teacher?{token}:{},
    });
    sockets.push(socket);
    await once(socket,'connect');
    await ack(socket,'course:join');
    return socket;
  };
  try {
    const teacher=await join(true);
    const staleTeacher=await join(true);
    const student=await join(false);
    const observed=[];
    student.on('course:slide',state=>observed.push(state));
    student.on('course:quiz',state=>observed.push(state));
    const active=await ack(teacher,'course:slide',{round:3,page:49});
    assert.equal(active.ok,true);
    for(const [event,payload] of [
      ['course:slide',{round:1,page:1}],
      ['course:start-quiz',{round:1}],
    ]) {
      const rejected=await ack(staleTeacher,event,payload);
      assert.equal(rejected.ok,false,event+' must reject older lessons');
      assert.deepEqual((await ack(student,'course:join')).state,active.state);
      assert.deepEqual(observed,[active.state],'rejected commands must not be broadcast');
    }
    const lateStudent=await join(false);
    assert.deepEqual((await ack(lateStudent,'course:join')).state,active.state);
    const backwardsPage=await ack(teacher,'course:slide',{round:3,page:48});
    assert.equal(backwardsPage.ok,true,'teacher may review previous pages within the active lesson');
    const next=await ack(teacher,'course:start-quiz',{round:3});
    assert.equal(next.ok,true);
    assert.equal((await ack(teacher,'course:slide',{round:4,page:52})).ok,true);
  } finally {
    for(const socket of sockets) socket.disconnect();
    await new Promise(resolve=>server.close(resolve));
  }
});
