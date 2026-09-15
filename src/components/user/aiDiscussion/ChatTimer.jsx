import { useEffect, useState } from 'react';
import { socket } from '@/api/chat';
export default function ChatTimer(){
 const [time,setTime]=useState({remaining:null,total:null});
 useEffect(()=>{
  const sync=({remainingMs,durationMs})=>setTime(prev=>({remaining:Math.max(0,Math.floor(remainingMs/1000)),total:durationMs ? Math.floor(durationMs/1000) : prev.total}));
  socket.on('room:time',sync);socket.emit('room:time:request',{});
  const tick=setInterval(()=>setTime(prev=>prev.remaining==null?prev:{...prev,remaining:Math.max(0,prev.remaining-1)}),1000);
  const poll=setInterval(()=>socket.emit('room:time:request',{}),5000);
  return ()=>{socket.off('room:time',sync);clearInterval(tick);clearInterval(poll);};
 },[]);
 const format=n=>n==null?'--:--':`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
 const progress=time.total ? Math.max(0,Math.min(1,1-time.remaining/time.total)) : 0;
 return <div className="overview-top"><div className="timer-wrap"><div className="timer-face" style={{'--p':String(progress)}}><div className="timer-total-inside">{format(time.total)}</div><div className="timer-remaining">{format(time.remaining)}</div></div></div></div>;
}
