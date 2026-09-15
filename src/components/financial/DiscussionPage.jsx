import { useState, useEffect } from 'react';
import { socket } from '../../api/chat';
import { useUser } from '../../contexts/UserContext';
import { useRoundStep } from '../../contexts/RoundStepContext';
import { getLesson } from '../../contents/financial-course.js';
import AiDiscussionMain from '../user/aiDiscussion/AiDiscussionMain';
import '../user/aiDiscussion/aiDiscussion.css';
import './course.css';
export default function DiscussionPage() {
  const { round }=useRoundStep();
  const { isAdmin }=useUser();
  const lesson=getLesson(round);
  const [showGuide,setShowGuide]=useState(true);
  const [started,setStarted]=useState(false);
  const [connected,setConnected]=useState(socket.connected);
  useEffect(() => {
    const online=()=>setConnected(true),offline=()=>setConnected(false);
    socket.on('connect',online);socket.on('disconnect',offline);
    return ()=>{socket.off('connect',online);socket.off('disconnect',offline);};
  },[]);
  return <div className="ai-discussion-page">
    {started && <AiDiscussionMain/>}
    {!connected && <div role="status" className="finance-connection">토론 서버에 연결 중입니다.</div>}
    <div className="finance-discussion-controls">
      <button onClick={()=>setShowGuide(true)}>토론 주제 보기</button>
      {isAdmin && <><button disabled={!connected} onClick={()=>socket.emit('room:next',{dir:-1})}>이전 주제</button><button disabled={!connected} onClick={()=>socket.emit('room:next',{})}>다음 주제</button><button disabled={!connected} onClick={()=>socket.emit('ai:ment:request',{})}>AI 참여 안내</button><button disabled={!connected} onClick={()=>socket.emit('room:end',{})}>토론 종료</button></>}
    </div>
    {showGuide && <div className="finance-guide" role="dialog" aria-modal="true" aria-label={`${round}차시 토론 주제`}><div className="finance-course"><h1>{round}차시 · {lesson.title}</h1><ol>{lesson.topics.map((topic,index)=><li key={topic}><strong>{topic}</strong><p className="finance-topic-detail">{lesson.topicDetails[index]}</p></li>)}</ol><p>각 주제에 대해 자신의 생각과 이유를 이야기해 주세요. 강사의 안내에 따라 순서대로 진행합니다.</p><button autoFocus className="primary" onClick={()=>{setStarted(true);setShowGuide(false);}}>토론 화면으로</button></div></div>}
  </div>;
}
