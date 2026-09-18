import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useRoundStep } from '../../contexts/RoundStepContext';
import { useUser } from '../../contexts/UserContext';
import { getLesson, scoreQuiz } from '../../contents/financial-course.js';
import { quizApi } from '../../api/quiz';
import CourseShell from '../../components/financial/CourseShell';

export default function QuizPage() {
  const { round, step, setStep } = useRoundStep();
  const { isAdmin } = useUser();
  const navigate = useNavigate();
  const lesson = getLesson(round);
  const [pageIndex, setPageIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [revealed, setRevealed] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const page = lesson.quizPages[pageIndex];
  const result = scoreQuiz(round, answers);
  const next = () => {setStep(3);navigate(`/${isAdmin?'admin':'user'}/video`);};
  useEffect(() => {
    if (!lesson.quizEnabled && step !== 3) setStep(3);
  }, [lesson.quizEnabled, step, setStep]);
  const finish = async () => {
    if (isAdmin) { next(); return; }
    if (!result.complete || saving) return;
    setSaving(true); setError('');
    try { await quizApi.submitRoundScore({round,correct:result.correct,total:result.total}); next(); }
    catch { setError('점수를 저장하지 못했습니다. 연결 상태를 확인하고 다시 저장해 주세요.'); }
    finally { setSaving(false); }
  };
  if (!lesson.quizEnabled) return <Navigate to={`/${isAdmin?'admin':'user'}/video`} replace />;
  return <CourseShell stage={2}>
    {!page ? <section className="finance-empty"><h1>{round}차시 퀴즈 자료 준비 중</h1><p>퀴즈 자료가 아직 전달되지 않았습니다.</p><p>이 차시의 퀴즈 점수는 기록하지 않습니다.</p><button onClick={next}>자료 없이 다음 단계 확인</button></section> : <>
      <div className="finance-page-title"><h1>{page.title.replace(/\s+[12]-[124]\s+(확인 문제|상황 판단)$/,'')}</h1><span>{round}차시 · 확인 문제 · 원본 {page.page}쪽</span></div>
      <div className="finance-questions">{page.questions.map(question => {
        const selected = answers[question.id];
        const showAnswer = revealed[question.id];
        return <section className="finance-question" key={question.id}>
          <div className="finance-question-heading"><span className="finance-q">Q</span><h2>{question.q}</h2></div>
          {question.kind === 'choice' && <div className="finance-options" role="group" aria-label={question.q}>{question.options.map((option,index) => <button key={option} aria-pressed={selected===index} disabled={saving} className={selected===index ? 'selected' : ''} onClick={() => setAnswers(prev => ({...prev,[question.id]:index}))}>{option}</button>)}</div>}
          {showAnswer ? <p className="finance-explanation"><strong>A.</strong> {question.explanation}</p> : <button className="finance-reveal" disabled={question.kind==='choice' && selected===undefined && !isAdmin} onClick={() => setRevealed(prev => ({...prev,[question.id]:true}))}>정답·해설 보기</button>}
          {showAnswer && selected!==undefined && <span className="finance-feedback" role="status">{selected===question.answer ? '정답입니다.' : '해설을 확인해 주세요.'}</span>}
        </section>;
      })}</div>
      {error && <p className="finance-error" role="alert">{error}</p>}
      <footer className="finance-controls"><button disabled={pageIndex===0 || saving} onClick={() => setPageIndex(pageIndex-1)}>이전 페이지</button><span>{pageIndex+1} / {lesson.quizPages.length}</span>{pageIndex < lesson.quizPages.length-1 ? <button onClick={() => setPageIndex(pageIndex+1)}>다음 페이지</button> : <button className="primary" disabled={saving || (!isAdmin && !result.complete)} onClick={finish}>{saving ? '저장 중…' : isAdmin ? '영상으로 이동' : '점수 저장 후 영상으로 이동'}</button>}</footer>
      {!isAdmin && !result.complete && <p className="finance-note">선택형 문항에 모두 답하면 점수를 저장할 수 있습니다. 설명형 문항은 점수에 포함하지 않습니다.</p>}
    </>}
  </CourseShell>;
}
