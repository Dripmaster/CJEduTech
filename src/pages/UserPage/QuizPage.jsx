import { useEffect, useState, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useRoundStep } from '../../contexts/RoundStepContext';
import { useUser } from '../../contexts/UserContext';
import { getLesson, scoreQuiz, afterQuiz } from '../../contents/financial-course.js';
import {QUIZ_TEXT_LIMIT,validateAnswers} from '../../../server/data/quiz-rules.js';
import { quizApi } from '../../api/quiz';
import CourseShell from '../../components/financial/CourseShell';
import TeacherQuizResponses from '../../components/financial/TeacherQuizResponses';
const draftKey=(nickname,round)=>`financial-education.quiz-draft.${encodeURIComponent(nickname)}.${round}`;
function readDraft(key,round) {
 try {return validateAnswers(round,JSON.parse(sessionStorage.getItem(key))||{});}catch{return {};}
}
export default function QuizPage() {
 const {round}=useRoundStep();const {nickname,isAdmin}=useUser();
 return <QuizContent key={`${round}:${nickname}:${isAdmin}`}/>;
}
function QuizContent() {
  const { round, step, setStep, applyProgress } = useRoundStep();
  const { isAdmin,nickname } = useUser();
  const navigate = useNavigate();
  const lesson = getLesson(round);
  const key=draftKey(nickname,round);
  const [pageIndex, setPageIndex] = useState(0);
  const [answers, setAnswers] = useState(()=>readDraft(key,round));
  const [revealed, setRevealed] = useState({});
  const [saving, setSaving] = useState(false);
  const [loaded,setLoaded]=useState(isAdmin);
  const [error, setError] = useState('');
  const [loadError,setLoadError]=useState('');
  const [notice,setNotice]=useState('');
  const [loadVersion,setLoadVersion]=useState(0);
  const active=useRef(true);
  const page = lesson.quizPages[pageIndex];
  const result = scoreQuiz(round, answers);
  const target = afterQuiz(round);
  const written=lesson.quizPages.flatMap(p=>p.questions).filter(q=>q.kind==='written');
  const complete=result.complete && written.every(q=>typeof answers[q.id]==='string' && answers[q.id].trim() && answers[q.id].length<=QUIZ_TEXT_LIMIT);
  const next = () => {applyProgress(target);navigate(`/${isAdmin?'admin':'user'}/${target.path}`);};
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  useEffect(()=>{
    if(isAdmin || !lesson.quizEnabled) return;
    let cancelled=false;
    setLoaded(false);setLoadError('');
    quizApi.getResponse(round).then(saved=>{
      if(cancelled)return;
      const local=readDraft(key,round);
      setAnswers(Object.keys(local).length?local:saved.answers||{});
      if(saved.submittedAt)setNotice('제출한 답안을 다시 확인하거나 수정할 수 있습니다.');
    }).catch(()=>{if(!cancelled)setLoadError('서버의 이전 답안을 불러오지 못했습니다. 이 탭에 남은 작성 내용은 유지됩니다.');})
      .finally(()=>{if(!cancelled)setLoaded(true);});
    return()=>{cancelled=true;};
  },[isAdmin,lesson.quizEnabled,round,key,loadVersion]);
  useEffect(()=>{if(loaded && !isAdmin)try{sessionStorage.setItem(key,JSON.stringify(answers));}catch{/* Server save remains available when browser storage is full. */}},[loaded,isAdmin,key,answers]);
  useEffect(() => {
    if (!lesson.quizEnabled && step !== 3) setStep(3);
  }, [lesson.quizEnabled, step, setStep]);
  const change=(id,value)=>{setAnswers(prev=>({...prev,[id]:value}));setNotice('');};
  const save=async submit=>{
    if(saving || !loaded || (submit && !complete))return;
    setSaving(true);setError('');setNotice('');
    try {
      if(submit) await quizApi.submitAnswers(round,answers);
      else await quizApi.saveDraft(round,answers);
      if(!active.current)return;
      if(submit){sessionStorage.removeItem(key);next();}
      else setNotice('답안을 임시 저장했습니다.');
    } catch {if(active.current)setError('답안을 저장하지 못했습니다. 작성 내용은 유지됩니다. 연결 상태를 확인하고 다시 저장해 주세요.');}
    finally {if(active.current)setSaving(false);}
  };
  const finish=()=>isAdmin?next():save(true);
  if (!lesson.quizEnabled) return <Navigate to={`/${isAdmin?'admin':'user'}/video`} replace />;
  return <CourseShell stage={2}>
    {!loaded && <p role="status">저장된 답안을 불러오는 중입니다.</p>}
    {loadError && <p role="alert" className="finance-error">{loadError} <button disabled={saving} onClick={()=>setLoadVersion(v=>v+1)}>다시 불러오기</button></p>}
    {!page ? <section className="finance-empty"><h1>{round}차시 퀴즈 자료 준비 중</h1><p>퀴즈 자료가 아직 전달되지 않았습니다.</p></section> : <>
      <div className="finance-page-title"><h1>{page.title.replace(/\s+[12]-[124]\s+(확인 문제|상황 판단)$/,'')}</h1><span>{round}차시 · 확인 문제 · 원본 {page.page}쪽</span></div>
      <div className="finance-questions">{page.questions.map(question => {
        const selected = answers[question.id];
        const showAnswer = revealed[question.id];
        return <section className="finance-question" key={question.id}>
          <div className="finance-question-heading"><span className="finance-q">Q</span><h2>{question.q}</h2></div>
          {question.kind === 'choice' && <div className="finance-options" role="group" aria-label={question.q}>{question.options.map((option,index) => <button key={option} aria-pressed={selected===index} disabled={saving || !loaded} className={selected===index ? 'selected' : ''} onClick={() => change(question.id,index)}>{option}</button>)}</div>}
          {question.kind==='written' && (isAdmin ? <TeacherQuizResponses round={round} questionId={question.id}/> : <div className="finance-written">
            <label htmlFor={question.id}>내 답변</label>
            <textarea id={question.id} aria-label={question.q} value={selected||''} disabled={saving || !loaded} maxLength={QUIZ_TEXT_LIMIT} rows={3} placeholder="자신의 생각을 문장으로 작성해 주세요." onChange={event=>change(question.id,event.target.value)}/>
            <small>{(selected||'').length} / {QUIZ_TEXT_LIMIT}자 · 자동 채점하지 않는 문항입니다.</small>
          </div>)}
          {showAnswer ? <p className="finance-explanation"><strong>A.</strong> {question.explanation}</p> : <button className="finance-reveal" disabled={!isAdmin && (question.kind==='choice'?selected===undefined:!selected?.trim())} onClick={() => setRevealed(prev => ({...prev,[question.id]:true}))}>{question.kind==='written'?'예시 답안·해설 보기':'정답·해설 보기'}</button>}
          {question.kind==='choice' && showAnswer && selected!==undefined && <span className="finance-feedback" role="status">{selected===question.answer ? '정답입니다.' : '해설을 확인해 주세요.'}</span>}
        </section>;
      })}</div>
      {error && <p className="finance-error" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <footer className="finance-controls"><button disabled={pageIndex===0 || saving} onClick={() => setPageIndex(pageIndex-1)}>이전 페이지</button><span>{pageIndex+1} / {lesson.quizPages.length}</span>
        {!isAdmin && <button disabled={saving || !loaded} onClick={()=>save(false)}>{saving?'저장 중…':'답안 임시 저장'}</button>}
        {pageIndex < lesson.quizPages.length-1 ? <button disabled={saving} onClick={() => setPageIndex(pageIndex+1)}>다음 페이지</button> : <button className="primary" disabled={saving || (!isAdmin && (!complete || !loaded))} onClick={finish}>{saving ? '저장 중…' : isAdmin ? `${target.label}으로 이동` : `답안 제출 후 ${target.label}으로 이동`}</button>}
      </footer>
      {!isAdmin && <p className="finance-note">{written.length?'선택형과 서답형에 모두 답하면 제출할 수 있습니다. 서답형은 점수에 포함하지 않습니다.':'선택형 문항에 모두 답하면 제출할 수 있습니다.'} 작성 중인 내용은 이 탭에 보관됩니다. 다른 기기에서도 확인하려면 임시 저장해 주세요.</p>}
    </>}
  </CourseShell>;
}
