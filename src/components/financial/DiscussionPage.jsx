import {Navigate} from 'react-router-dom';
import LeaveButton from '../common/LeaveButton';
import { useState, useEffect } from 'react';
import { socket } from '../../api/chat';
import { useUser } from '../../contexts/UserContext';
import { useRoundStep } from '../../contexts/RoundStepContext';
import { getActivity } from '../../contents/financial-course.js';
import AiDiscussionMain from '../user/aiDiscussion/AiDiscussionMain';
import '../user/aiDiscussion/aiDiscussion.css';
import './course.css';
export default function DiscussionPage() {
  const { round, videoId }=useRoundStep();
  const { isAdmin }=useUser();
  const lesson=videoId === null ? null : getActivity(videoId);
  const [showGuide,setShowGuide]=useState(true);
  const [showHelp,setShowHelp]=useState(false);
  const [started,setStarted]=useState(false);
  const [connected,setConnected]=useState(socket.connected);
  useEffect(() => {
    const online=()=>setConnected(true),offline=()=>setConnected(false);
    socket.on('connect',online);socket.on('disconnect',offline);
    return ()=>{socket.off('connect',online);socket.off('disconnect',offline);};
  },[]);
  if(!lesson) return <Navigate to={`/${isAdmin?'admin':'user'}/slide`} replace/>;
  return <div className="ai-discussion-page">
    {started && <AiDiscussionMain/>}
    {!connected && <div role="status" className="finance-connection">토론 서버에 연결 중입니다.</div>}
    <div className="finance-discussion-controls">
      <LeaveButton />
      <button onClick={()=>setShowGuide(true)}>토론 주제 보기</button>
      <button onClick={()=>setShowHelp(true)}>토론 방법 보기</button>
      {isAdmin && <><button disabled={!connected} onClick={()=>socket.emit('room:next',{dir:-1})}>이전 주제</button><button disabled={!connected} onClick={()=>socket.emit('room:next',{})}>다음 주제</button><button disabled={!connected} onClick={()=>socket.emit('ai:ment:request',{})}>AI 참여 안내</button><button disabled={!connected} onClick={()=>socket.emit('room:end',{})}>토론 종료</button></>}
    </div>
    {showGuide && <div className="finance-guide" role="dialog" aria-modal="true" aria-label={`${round}차시 토론 주제`}><div className="finance-course"><h1>{round}차시 · {lesson.videoTitle}</h1><ol>{lesson.topics.map((topic,index)=><li key={topic}><strong>{topic}</strong><p className="finance-topic-detail">{lesson.topicDetails[index]}</p></li>)}</ol><p>각 주제에 대해 자신의 생각과 이유를 이야기해 주세요. 강사의 안내에 따라 순서대로 진행합니다.</p><button autoFocus className="primary" onClick={()=>{setStarted(true);setShowGuide(false);}}>토론 화면으로</button></div></div>}
    {showHelp && <div className="finance-guide" role="dialog" aria-modal="true" aria-label="토론 방법"><div className="finance-course">
      <h1>아이고라와 함께 토론하기</h1>
      <ol>
        <li><strong>생각과 이유를 나눠주세요.</strong><p>화면 위의 질문을 읽고 아래 입력창에 의견을 적어 Enter로 보내세요. Shift+Enter로 줄을 바꿀 수 있어요.</p></li>
        <li><strong>공감하는 의견을 눌러주세요.</strong><p>다른 학생의 말풍선을 누르면 공감을 보낼 수 있어요. 나의 기여와 케이크에서 발언·공감·금융 4축 배지를 확인해 보세요.</p></li>
        <li><strong>궁금할 땐 @아이고라로 질문하세요.</strong><p>질문 앞에 @아이고라를 붙이면 AI 답변을 나에게만 보여줘요. 주황색 안내는 토론을 돕는 질문이나 참여 독려예요.</p></li>
      </ol>
      <button autoFocus className="primary" onClick={()=>setShowHelp(false)}>돌아가기</button>
    </div></div>}
  </div>;
}
