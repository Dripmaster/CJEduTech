import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoundStep } from '../../contexts/RoundStepContext';
import { useUser } from '../../contexts/UserContext';
import { getLesson, afterTheory, theoryPages } from '../../contents/financial-course.js';
import CourseShell from './CourseShell';
import { useQuizSync } from './QuizSync';
export default function SlideViewer() {
  const { round, setStep } = useRoundStep();
  const { isAdmin } = useUser();
  const navigate = useNavigate();
  const { connected, startNext, publishSlide, state } = useQuizSync();
  const lesson = getLesson(round);
  const target = afterTheory(round);
  const pages = theoryPages(round);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [moving, setMoving] = useState(false);
  const initialized = useRef(null);
  const busy = useRef(false);
  const move = useCallback(async next => {
    if(!isAdmin || !connected || busy.current) return;
    const available=theoryPages(round);
    if(next<0 || next>=available.length) return;
    busy.current=true;setMoving(true);setStartError('');
    try {await publishSlide(round,available[next]);setIndex(next);setFailed(false);}
    catch(error){setStartError(error.message);}
    finally {busy.current=false;setMoving(false);}
  },[isAdmin,connected,round,publishSlide]);
  useEffect(()=>{
    if(!connected) {initialized.current=null;return;}
    if(!isAdmin || initialized.current===round) return;
    initialized.current=round;
    // A refreshed/reconnected teacher adopts the server page, never resets it.
    if(state?.round===round && state.step===1) setIndex(theoryPages(round).indexOf(state.page));
    else move(0);
  },[connected,isAdmin,round,state,move]);
  useEffect(()=>{
    if(state?.round===round && state.step===1) {
      const next=theoryPages(round).indexOf(state.page);
      if(next>=0) {setIndex(next);setFailed(false);}
    }
  },[state,round]);
  const beginNext = async () => {
    if (starting || moving) return;
    setStarting(true);setStartError('');
    try {await startNext(round);setStep(target.step);navigate(`/admin/${target.path}`);}
    catch (error) {setStartError(error.message);}
    finally {setStarting(false);}
  };
  useEffect(() => {
    const onKey = event => {
      if (!isAdmin || event.target.closest('button, input, textarea')) return;
      if (event.key === 'ArrowRight') move(index+1);
      if (event.key === 'ArrowLeft') move(index-1);
    };
    window.addEventListener('keydown',onKey);
    return () => window.removeEventListener('keydown',onKey);
  }, [isAdmin,index,move]);
  const activeIndex=Math.max(0,Math.min(index,pages.length-1));
  return <CourseShell stage={1}>
    {!connected && <p role="status">수업 서버에 연결 중입니다. 연결되면 강사의 현재 슬라이드를 표시합니다.</p>}
    <div className="finance-slide" key={pages[activeIndex]}>
      <img src={`/financial-education/slides/page-${String(pages[activeIndex]).padStart(2,'0')}.jpg`} alt={`${lesson.title}, 교육 자료 ${pages[activeIndex]}쪽`} onLoad={() => setFailed(false)} onError={() => setFailed(true)} />
      {failed && <p role="alert">슬라이드를 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.</p>}
    </div>
    <footer className="finance-controls">
      {isAdmin ? <button disabled={activeIndex===0 || !connected || moving} onClick={() => move(activeIndex-1)}>이전 슬라이드</button> : <span>강사의 슬라이드를 함께 보고 있습니다.</span>}
      <span>{activeIndex+1} / {pages.length} · 원본 {pages[activeIndex]}쪽</span>
      {isAdmin && (activeIndex < pages.length-1 ? <button disabled={!connected || moving} onClick={() => move(activeIndex+1)}>다음 슬라이드</button> : <button className="primary" disabled={!connected || starting || moving} onClick={beginNext}>{starting ? `${target.label} 시작 중…` : target.path === 'quiz' ? '퀴즈로 이동' : '영상으로 이동'}</button>)}
      {!isAdmin && activeIndex===pages.length-1 && <span>강사가 {target.label} 단계를 시작할 때까지 기다려 주세요.</span>}
    </footer>
    {startError && <p className="finance-error" role="alert">{startError} <button disabled={!connected || moving} onClick={()=>move(activeIndex)}>현재 슬라이드 다시 보내기</button></p>}
  </CourseShell>;
}
