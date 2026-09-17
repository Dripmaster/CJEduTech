import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoundStep } from '../../contexts/RoundStepContext';
import { useUser } from '../../contexts/UserContext';
import { getLesson, afterTheory } from '../../contents/financial-course.js';
import CourseShell from './CourseShell';
import { useQuizSync } from './QuizSync';
export default function SlideViewer() {
  const { round, setStep } = useRoundStep();
  const { isAdmin } = useUser();
  const navigate = useNavigate();
  const { connected, startNext } = useQuizSync();
  const lesson = getLesson(round);
  const target = afterTheory(round);
  const pages = round === 1 ? [1,2,3,4,...lesson.theoryPages] : lesson.theoryPages;
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const beginNext = async () => {
    if (starting) return;
    setStarting(true);
    setStartError('');
    try {
      await startNext(round);
      setStep(target.step);
      navigate(`/admin/${target.path}`);
    } catch (error) {
      setStartError(error.message);
    } finally {
      setStarting(false);
    }
  };
  useEffect(() => {
    const onKey = event => {
      if (event.target.closest('button, input, textarea')) return;
      if (event.key === 'ArrowRight') setIndex(i => Math.min(pages.length-1,i+1));
      if (event.key === 'ArrowLeft') setIndex(i => Math.max(0,i-1));
    };
    window.addEventListener('keydown',onKey);
    return () => window.removeEventListener('keydown',onKey);
  }, [pages.length]);
  const move = next => { setFailed(false); setIndex(next); };
  return <CourseShell stage={1}>
    {!connected && <p role="status">수업 서버에 연결 중입니다. 연결되면 강사의 진행에 맞춰 이동합니다.</p>}
    <div className="finance-slide" key={pages[index]}>
      <img src={`/financial-education/slides/page-${String(pages[index]).padStart(2,'0')}.jpg`} alt={`${lesson.title}, 교육 자료 ${pages[index]}쪽`} onLoad={() => setFailed(false)} onError={() => setFailed(true)} />
      {failed && <p role="alert">슬라이드를 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.</p>}
    </div>
    <footer className="finance-controls">
      <button disabled={index===0} onClick={() => move(index-1)}>이전 슬라이드</button>
      <span>{index+1} / {pages.length} · 원본 {pages[index]}쪽</span>
      {index < pages.length-1 ? <button onClick={() => move(index+1)}>다음 슬라이드</button> : isAdmin ? <button className="primary" disabled={!connected || starting} onClick={beginNext}>{starting ? `${target.label} 시작 중…` : target.path === 'quiz' ? '퀴즈로 이동' : '영상으로 이동'}</button> : <span>강사가 {target.label} 단계를 시작할 때까지 기다려 주세요.</span>}
    </footer>
    {startError && <p className="finance-error" role="alert">{startError}</p>}
  </CourseShell>;
}
