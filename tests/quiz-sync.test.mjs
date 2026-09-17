import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {io} from 'socket.io-client';

const root=new URL('../',import.meta.url).pathname;
const ack=(socket,event,payload)=>new Promise((resolve,reject)=>socket.timeout(1500).emit(event,payload,(err,result)=>err?reject(err):resolve(result)));

test('teacher starts the quiz or video stage for 20 students, including reconnects, without starting discussion', {timeout:15000}, async()=>{
 const allocator=createServer();allocator.listen(0,'127.0.0.1');await once(allocator,'listening');
 const port=allocator.address().port;await new Promise(resolve=>allocator.close(resolve));
 const child=spawn(process.execPath,['index.js'],{cwd:root+'server',env:{...process.env,PORT:String(port),DB_HOST:'127.0.0.1',AI_SERVER_BASE:'http://127.0.0.1:1'},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);
 const sockets=[];
 async function connect(isAdmin=false){
  const socket=io(`http://127.0.0.1:${port}/chat`,{transports:['websocket'],forceNew:true});sockets.push(socket);
  await once(socket,'connect');
  const joined=await ack(socket,'course:join',{isAdmin});
  assert.equal(joined.ok,true);
  return {socket,state:joined.state};
 }
 try {
  for(let n=0;n<60;n++){
   try{if((await fetch(`http://127.0.0.1:${port}/health`)).ok)break;}catch{}
   await new Promise(resolve=>setTimeout(resolve,40));
  }
  const teacher=await connect(true);
  const students=await Promise.all(Array.from({length:20},()=>connect()));
  assert.equal(students[0].state,null);
  const received=students.map(({socket})=>{const list=[];socket.on('course:quiz',state=>list.push(state));return list;});
  let discussionEvents=0;
  students[0].socket.on('room:time',()=>discussionEvents++);
  students[0].socket.on('room:recent',()=>discussionEvents++);
  assert.equal((await ack(students[0].socket,'course:start-quiz',{round:1})).ok,false);
  assert.equal((await ack(teacher.socket,'course:start-quiz',{round:5})).ok,false);
  for(const round of [1,2,3,4]){
   const deliveries=students.map(({socket})=>once(socket,'course:quiz'));
   const response=await ack(teacher.socket,'course:start-quiz',{round});
   assert.equal(response.ok,true);
   assert.equal(response.state.round,round);
   assert.equal(response.state.step,round <= 2 ? 2 : 3);
   assert.ok(response.state.commandId);
   for(const [state] of await Promise.all(deliveries))assert.deepEqual(state,response.state);
   // Retrying a command keeps its identity so clients do not lose in-progress answers.
   const retried=await ack(teacher.socket,'course:start-quiz',{round});
   assert.equal(retried.state.commandId,response.state.commandId);
  }
  const rejoined=students[0].socket;rejoined.disconnect();rejoined.connect();await once(rejoined,'connect');
  const snapshot=await ack(rejoined,'course:join',{isAdmin:false});
  assert.equal(snapshot.state.round,4);
  assert.equal(snapshot.state.step,3);
  assert.equal(snapshot.state.commandId,received[0].at(-1).commandId);
  assert.equal(discussionEvents,0);
  assert.equal((await connect()).state.round,4);
 }catch(error){error.message+='\n'+output.slice(-1200);throw error;}
 finally {for(const socket of sockets)socket.disconnect();child.kill();await once(child,'exit');}
});
