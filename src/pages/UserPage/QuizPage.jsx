import { useEffect, useState, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useRoundStep } from '../../contexts/RoundStepContext';
import { useUser } from '../../contexts/UserContext';
import { getLesson, scoreQuiz, afterQuiz } from '../../contents/financial-course.js';
import {QUIZ_TEXT_LIMIT,validateAnswers} from '../../../server/data/quiz-rules.js';
import { quizApi,getAnswerSaver } from '../../api/quiz';
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
  const revealKey=`${key}.revealed`;
  const [revealed, setRevealed] = useState(()=>{
    if(isAdmin)return {};
    try{
      const stored=JSON.parse(sessionStorage.getItem(revealKey))||{};
      return Object.fromEntries(lesson.quizPages.flatMap(p=>p.questions).filter(q=>stored[q.id]===true).map(q=>[q.id,true]));
    }catch{return {};}
  });
  const [finishing,setFinishing]=useState(false);
  const [saveStatus,setSaveStatus]=useState('idle');
  const [saver]=useState(()=>isAdmin?null:getAnswerSaver(round,key));
  const answersRef=useRef(answers);
  const [loaded,setLoaded]=useState(isAdmin);
  const [error, setError] = useState('');
  const [loadError,setLoadError]=useState('');

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
    Promise.resolve(saver?.flush()).catch(()=>{}).then(()=>quizApi.getResponse(round)).then(saved=>{
      if(cancelled)return;
      const local=readDraft(key,round);
      const restored=Object.keys(local).length?local:saved.answers||{};
      answersRef.current=restored;setAnswers(restored);
      if(Object.keys(local).length)saver.set(local);
    }).catch(()=>{if(!cancelled)setLoadError('서버의 이전 답안을 불러오지 못했습니다. 이 탭에 남은 작성 내용은 유지됩니다.');})
      .finally(()=>{if(!cancelled)setLoaded(true);});
    return()=>{cancelled=true;};
  },[isAdmin,lesson.quizEnabled,round,key,loadVersion,saver]);
  useEffect(()=>{
    if(!saver)return;
    const unsubscribe=saver.subscribe(setSaveStatus);
    const flush=()=>{void saver.flush().catch(()=>{});};
    const leave=event=>{if(['saving','error'].includes(saver.status)){flush();event.preventDefault();event.returnValue='';}};
    window.addEventListener('online',flush);
    window.addEventListener('beforeunload',leave);
    return()=>{unsubscribe();window.removeEventListener('online',flush);window.removeEventListener('beforeunload',leave);flush();};
  },[saver]);
  useEffect(() => {
    if (!lesson.quizEnabled && step !== 3) setStep(3);
  }, [lesson.quizEnabled, step, setStep]);
  const reveal=id=>{
    const updated={...revealed,[id]:true};
    setRevealed(updated);
    if(!isAdmin)try{sessionStorage.setItem(revealKey,JSON.stringify(updated));}catch{/* The current view still locks the answer. */}
  };
  const change=(id,value)=>{
    if(revealed[id])return;
    const updated={...answersRef.current,[id]:value};
    answersRef.current=updated;setAnswers(updated);setError('');
    if(isAdmin)return;
    try{sessionStorage.setItem(key,JSON.stringify(updated));}catch{/* Server saving still works. */}
    saver.set(updated,typeof value==='string'?400:0);
  };
  const finish=async()=>{
    if(isAdmin){next();return;}
    if(finishing || !loaded || !complete)return;
    setFinishing(true);setError('');
    try{await saver.flush();if(active.current)next();}
    catch{if(active.current)setError('답안을 저장하지 못해 이동하지 않았습니다. 연결 상태를 확인하고 다시 시도해 주세요.');}
    finally{if(active.current)setFinishing(false);}
  };
  if (!lesson.quizEnabled) return <Navigate to={`/${isAdmin?'admin':'user'}/video`} replace />;
  return <CourseShell stage={2}>
    {!loaded && <p role="status">저장된 답안을 불러오는 중입니다.</p>}
    {loadError && <p role="alert" className="finance-error">{loadError} <button disabled={finishing} onClick={()=>setLoadVersion(v=>v+1)}>다시 불러오기</button></p>}
    {!page ? <section className="finance-empty"><h1>{round}차시 퀴즈 자료 준비 중</h1><p>퀴즈 자료가 아직 전달되지 않았습니다.</p></section> : <>
      <div className="finance-page-title"><h1>{page.title.replace(/\s+[12]-[124]\s+(확인 문제|상황 판단)$/,'')}</h1><span>{round}차시 · 확인 문제 · 원본 {page.page}쪽</span></div>
      <div className="finance-questions">{page.questions.map(question => {
        const selected = answers[question.id];
        const showAnswer = revealed[question.id];
        return <section className="finance-question" key={question.id}>
          <div className="finance-question-heading"><span className="finance-q">Q</span><h2>{question.q}</h2></div>
          {question.kind === 'choice' && <div className="finance-options" role="group" aria-label={question.q}>{question.options.map((option,index) => <button key={option} aria-pressed={selected===index} disabled={showAnswer || finishing || !loaded} className={selected===index ? 'selected' : ''} onClick={() => change(question.id,index)}>{option}</button>)}</div>}
          {question.kind==='written' && (isAdmin ? <TeacherQuizResponses round={round} questionId={question.id}/> : <div className="finance-written">
            <label htmlFor={question.id}>내 답변</label>
            <textarea id={question.id} aria-label={question.q} value={selected||''} disabled={showAnswer || finishing || !loaded} maxLength={QUIZ_TEXT_LIMIT} rows={3} placeholder="자신의 생각을 문장으로 작성해 주세요." onChange={event=>change(question.id,event.target.value)}/>
            <small>{(selected||'').length} / {QUIZ_TEXT_LIMIT}자 · 자동 채점하지 않는 문항입니다.</small>
          </div>)}
          {showAnswer ? <p className="finance-explanation"><strong>A.</strong> {question.explanation}</p> : <button className="finance-reveal" disabled={!isAdmin && (question.kind==='choice'?selected===undefined:!selected?.trim())} onClick={() => reveal(question.id)}>{question.kind==='written'?'예시 답안·해설 보기':'정답·해설 보기'}</button>}
          {question.kind==='choice' && showAnswer && selected!==undefined && <span className="finance-feedback" role="status">{selected===question.answer ? '정답입니다.' : '해설을 확인해 주세요.'}</span>}
        </section>;
      })}</div>
      {error && <p className="finance-error" role="alert">{error}</p>}
      {!isAdmin && saveStatus==='error' && <p className="finance-error" role="alert">자동 저장에 실패했습니다. 작성 내용은 이 탭에 보관되어 있습니다. <button onClick={()=>saver.flush().catch(()=>{})}>다시 시도</button></p>}
      {!isAdmin && <p role="status">{saveStatus==='saving'?'자동 저장 중…':saveStatus==='saved'?'자동 저장됨':''}</p>}
      <footer className="finance-controls"><button disabled={pageIndex===0 || finishing} onClick={() => setPageIndex(pageIndex-1)}>이전 페이지</button><span>{pageIndex+1} / {lesson.quizPages.length}</span>
        {pageIndex < lesson.quizPages.length-1 ? <button disabled={finishing} onClick={() => setPageIndex(pageIndex+1)}>다음 페이지</button> : <button className="primary" disabled={finishing || (!isAdmin && (!complete || !loaded))} onClick={finish}>{finishing ? '저장 중…' : `${target.label}으로 이동`}</button>}
      </footer>
      {!isAdmin && <p className="finance-note">{written.length?'선택형과 서답형에 모두 답하면 다음으로 이동할 수 있습니다. 서답형은 점수에 포함하지 않습니다.':'선택형 문항에 모두 답하면 다음으로 이동할 수 있습니다.'} 보기를 선택하거나 답변을 작성하면 자동 저장됩니다. 정답·해설을 보기 전까지 답을 바꿀 수 있습니다. 해설을 본 문항은 수정할 수 없습니다.</p>}
    </>}
  </CourseShell>;
}
