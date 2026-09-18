import {createRequire} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {io} from 'socket.io-client';
import {activities} from '../src/contents/financial-course.js';
const root=new URL('../',import.meta.url).pathname;
const require=createRequire(new URL('../server/package.json',import.meta.url));
const jwt=require('jsonwebtoken');
const teacherToken=jwt.sign({uid:'test-teacher',role:'admin'},'teacher-socket-test');
const event=(socket,name)=>Promise.race([once(socket,name).then(args=>args[0]),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Timeout '+name)),8000);timer.unref();})]);
test('four lesson rooms use financial topics and isolate one-point classification from passing labels', {timeout:25000},async()=>{
 const archive=await mkdtemp(path.join(tmpdir(),'financial-chat-test-'));
 const requests=[];
 const ai=createServer(async(req,res)=>{
  let text='';for await(const chunk of req)text+=chunk;
  const body=JSON.parse(text||'{}');requests.push({url:req.url,body});
  res.setHeader('content-type','application/json');
  if(req.url==='/classify-gpt')res.end(JSON.stringify({cj_values:{금융이해:1,위험인식:60,계획성:0,실천의지:0},primary_trait:'위험인식',summary:'테스트 응답',evaluation_status:'assessed'}));
  else if(req.url==='/discussion-overall')res.end(JSON.stringify({discussion_summary:'계약 테스트 총평'}));
  else if(req.url==='/user-summary')res.end(JSON.stringify({user_id:body.user_id,topics:[],generated_at:new Date().toISOString()}));
  else res.end(JSON.stringify({question:'결과없음',message:'',discussion_summary:''}));
 });
 ai.listen(0,'127.0.0.1');await once(ai,'listening');
 const allocator=createServer();allocator.listen(0,'127.0.0.1');await once(allocator,'listening');const port=allocator.address().port;await new Promise(r=>allocator.close(r));
 const child=spawn(process.execPath,['index.js'],{cwd:path.join(root,'server'),env:{...process.env,JWT_SECRET:'teacher-socket-test',PORT:String(port),AI_SERVER_BASE:`http://127.0.0.1:${ai.address().port}`,CHAT_ARCHIVE_DIR:archive,DISCUSSION_QUESTIONS_DIR:path.join(root,'server/data/discussion_questions'),DB_HOST:'127.0.0.1',DB_NAME:'financial_contract_test',ROOM_MAX_AGE_MS:'600000',AI_MIN_SCORE:'0.6'},stdio:['ignore','pipe','pipe']});
 const sockets=[];let output='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);
 try {
  for(let i=0;i<60;i++) {try {if((await fetch(`http://127.0.0.1:${port}/health`)).ok)break;}catch{}await new Promise(r=>setTimeout(r,80));}
  for(const round of [1,2,3,4]) {
   let socket=io(`http://127.0.0.1:${port}/chat`,{transports:['websocket'],forceNew:true,auth:{token:teacherToken}});sockets.push(socket);await event(socket,'connect');
   const recent=event(socket,'room:recent');socket.emit('room:join',{roomId:'financial-contract',round,videoId:round-1,isAdmin:true});await recent;
   await new Promise(resolve=>setTimeout(resolve,100));
   if(round===2){
    const classified=event(socket,'message:ai');
    const posted=event(socket,'message:new');
    socket.emit('message:send',{roomId:'financial-contract',round,text:'매달 10만원을 모으겠습니다',nickname:'contract-student',avatar:'1'});
    const result=await classified;
    const message=await posted;
    const reaction=event(socket,'reaction:update');
    socket.emit('reaction:toggle',{messageId:message.id,nickname:'contract-student'});
    assert.equal((await reaction).reactionsCount,1);
    assert.deepEqual(result.aiLabels,['위험인식']);assert.equal(result.aiScores['위험인식'],0.6);
    const intruder=io(`http://127.0.0.1:${port}/chat`,{transports:['websocket'],forceNew:true});sockets.push(intruder);
    await event(intruder,'connect');
    let ended=false;socket.once('room:closing',()=>{ended=true;});
    intruder.emit('room:end',{roomId:'financial-contract__r2',isAdmin:true});
    await new Promise(resolve=>setTimeout(resolve,80));
    assert.equal(ended,false,'unauthenticated client must not end class');
    intruder.disconnect();
    // A lone participant leaving/reloading must not erase submitted discussion.
    socket.disconnect();
    await new Promise(resolve=>setTimeout(resolve,80));
    socket=io(`http://127.0.0.1:${port}/chat`,{transports:['websocket'],forceNew:true,auth:{token:teacherToken}});sockets.push(socket);
    await event(socket,'connect');
    const restored=event(socket,'room:recent');
    socket.emit('room:join',{roomId:'financial-contract',round,videoId:round-1,isAdmin:true});
    const history=await restored;
    assert.equal(history.messages.length,1,'last participant disconnect must preserve discussion');
    assert.equal(history.messages[0].text,'매달 10만원을 모으겠습니다');

   }
   if(round===4) {
    for(let index=0;index<101;index++) {
     const classified=event(socket,'message:ai');
     socket.emit('message:send',{roomId:'financial-contract',round,text:`저축 계획 ${index}`,nickname:index===0?'early-student':'later-student',avatar:'1'});
     await classified;
    }
   }
   const expired=event(socket,'room:expired');socket.emit('room:end',{});await expired;socket.disconnect();
  }
  const combined=await fetch(`http://127.0.0.1:${port}/api/chat/lesson-result/financial-contract__r4/3`).then(r=>r.json());
  assert.equal(combined.perUser['contract-student'].totalMessages,1);
  assert.equal(combined.perUser['early-student'].totalMessages,1);
  assert.equal(combined.perUser['later-student'].totalMessages,100);
  assert.equal(combined.ranking.length,3);
  const files=await readdir(archive);const archives=[];
  for(const file of files.filter(f=>f.endsWith('.json'))) archives.push(JSON.parse(await readFile(path.join(archive,file),'utf8')));
  assert.equal(new Set(archives.map(a=>a.round_number)).size,3);
  const firstTopics=activities.map(activity=>activity.topics[0]);
  for(const item of archives) assert.equal(item.topic,firstTopics[item.video_id_index]);
  const fourth=archives.find(a=>a.video_id_index===3);
  assert.equal(fourth.messages.length,101);
  assert.equal(fourth.perUser['early-student'].totalMessages,1);
  assert.equal(fourth.perUser['early-student'].labels['위험인식'],1);
  assert.ok(fourth.ranking.some(row=>row.nickname==='early-student'));
  const classify=requests.find(r=>r.url==='/classify-gpt');assert.equal(classify.body.user_id,'contract-student');assert.equal(classify.body.context.lesson_id,3);
  assert.deepEqual([...new Set(archives.map(a=>a.video_id_key))].sort(),['financial_1','financial_2','financial_3','financial_4']);
 } catch(error){error.message+='\n'+output.slice(-3000);throw error;}
 finally {for(const socket of sockets)socket.disconnect();child.kill('SIGTERM');await once(child,'exit');await new Promise(r=>ai.close(r));await rm(archive,{recursive:true,force:true});}
});
