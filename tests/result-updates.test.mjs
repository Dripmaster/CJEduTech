import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile,readdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {io} from 'socket.io-client';
const root=new URL('../',import.meta.url).pathname;
const require=createRequire(new URL('../server/package.json',import.meta.url));
const jwt=require('jsonwebtoken');
const event=(socket,name)=>Promise.race([once(socket,name).then(args=>args[0]),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Timeout '+name)),5000);timer.unref();})]);
async function until(check) { for(let i=0;i<100;i++){if(await check())return;await new Promise(r=>setTimeout(r,20));}throw new Error('Condition did not complete'); }

for (const archiveFailure of [false,true]) test(archiveFailure ? 'archive failure preserves live results without blocking classroom navigation' : 'class results publish partial summaries, retain late classifications and preload final feedback', {timeout:20000}, async () => {
 const archive=await mkdtemp(path.join(tmpdir(),'result-updates-'));
 const archiveTarget=archiveFailure ? path.join(archive,'not-a-directory') : archive;
 if(archiveFailure) await writeFile(archiveTarget,'fixture');
 const held=[];let evaluations=0;let classificationResponse;
 const ai=createServer(async(req,res)=>{
  let text='';for await(const chunk of req)text+=chunk;
  const body=JSON.parse(text||'{}');res.setHeader('content-type','application/json');
  const classified=()=>res.end(JSON.stringify({cj_values:{계획성:90},primary_trait:'계획성',evaluation_status:'assessed'}));
  if(req.url==='/classify-gpt') {if(body.nickname==='late')classificationResponse=classified;else classified();}
  else if(req.url==='/user-summary') held.push({body,finish:()=>res.end(JSON.stringify({topics:[{topic:'기초적 노후 생활',relevance_score:0.9,summary:`${body.user_id}의 계획`}]}))});
  else if(req.url==='/discussion-overall')res.end(JSON.stringify({discussion_summary:'토론 총평'}));
  else if(req.url==='/evaluate'){evaluations++;res.end(JSON.stringify({personalized_feedback:'개인 피드백'}));}
  else res.end(JSON.stringify({message:'',question:'결과없음'}));
 });
 ai.listen(0,'127.0.0.1');await once(ai,'listening');
 const allocator=createServer();allocator.listen(0,'127.0.0.1');await once(allocator,'listening');const port=allocator.address().port;await new Promise(r=>allocator.close(r));
 const child=spawn(process.execPath,['index.js'],{cwd:path.join(root,'server'),env:{...process.env,JWT_SECRET:'result-test',PORT:String(port),AI_SERVER_BASE:`http://127.0.0.1:${ai.address().port}`,CHAT_ARCHIVE_DIR:archiveTarget,DISCUSSION_QUESTIONS_DIR:path.join(root,'server/data/discussion_questions'),DB_HOST:'127.0.0.1',DB_NAME:'result_updates_test',AI_SUMMARY_CONCURRENCY:'3'},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);
 let socket;
 try {
  await until(async()=>{try{return (await fetch(`http://127.0.0.1:${port}/health`)).ok;}catch{return false;}});
  socket=io(`http://127.0.0.1:${port}/chat`,{transports:['websocket'],forceNew:true,auth:{token:jwt.sign({uid:'teacher',role:'admin'},'result-test')}});
  await event(socket,'connect');const recent=event(socket,'room:recent');socket.emit('room:join',{roomId:'updates',round:4,videoId:3,isAdmin:true});await recent;
  for(const nickname of ['first','second','late']) {
   const posted=event(socket,'message:new');socket.emit('message:send',{roomId:'updates',round:4,text:`${nickname} 저축 계획`,nickname});await posted;
  }
  await until(()=>classificationResponse);
  const ready=event(socket,'results:ready');socket.emit('room:end',{});await ready;
  const read=()=>fetch(`http://127.0.0.1:${port}/api/chat/result/updates__r4`).then(r=>r.json());
  const basic=await read();
  assert.equal(basic.perUser.late.totalMessages,1);
  assert.equal(basic.classification.status,'pending');
  await until(()=>held.length>=2); // Sequential processing cannot satisfy this.
  await until(async()=> (await read()).overallSummaryStatus==='ready');
  held[0].finish();
  await until(async()=> (await read()).topicSummaries?.completed >= 1);
  const partial=await read();
  assert.equal(partial.topicSummaries.status,'pending');
  assert.equal(partial.topicSummaries.topics[0].summaries.length,1);
  classificationResponse();
  await until(async()=> (await read()).classification.status==='ready');
  assert.equal((await read()).perUser.late.labels.계획성,1);
  const expired=event(socket,'room:expired');
  // Finish all remaining topic requests, including any queued after the first.
  await until(()=>held.length===3);held.slice(1).forEach(h=>h.finish());
  await expired;
  if (archiveFailure) {
   assert.equal((await read()).persistenceStatus,'error');
   assert.equal((await read()).perUser.late.labels.계획성,1);
   return;
  }
  await until(()=>evaluations===3);
  const files=await readdir(archive);
  for(const file of files.filter(f=>f.endsWith('.json'))) {
   const saved=JSON.parse(await readFile(path.join(archive,file),'utf8'));
   assert.equal(saved.perUser.late.labels.계획성,1);
   assert.equal(saved.topicSummaries.status,'ready');
   assert.equal(saved.overallSummary,'토론 총평');
  }
  const firstCompletion=(await read()).createdAt;
  const rejoined=event(socket,'room:recent');
  socket.emit('room:join',{roomId:'updates',round:4,videoId:3,isAdmin:true});await rejoined;
  const endedAgain=event(socket,'room:expired');socket.emit('room:end',{});await endedAgain;
  assert.ok((await read()).createdAt > firstCompletion,'a new completion must have a new archive identity');
  const repeatedFiles=await readdir(archive);
  assert.equal(repeatedFiles.filter(f=>f.endsWith('.json') && !f.endsWith('-latest.json')).length,2);
 } catch(error){error.message+='\n'+output.slice(-2000);throw error;}
 finally {socket?.disconnect();if(child.exitCode===null && child.signalCode===null){child.kill('SIGTERM');await once(child,'exit');}ai.closeAllConnections();await new Promise(r=>ai.close(r));await rm(archive,{recursive:true,force:true});}
});
