import {useEffect,useState} from 'react';
import {quizApi} from '../../api/quiz';
export default function TeacherQuizResponses({round,questionId}) {
 const [responses,setResponses]=useState([]);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
  let active=true,timer;
  const load=async()=>{
   try {const result=await quizApi.getClassResponses(round);if(active){setResponses(result.responses);setError('');}}
   catch {if(active)setError('학생 답안을 불러오지 못했습니다. 연결 상태를 확인해 주세요.');}
   finally {if(active){setLoading(false);timer=setTimeout(load,5000);}}
  };
  load();return()=>{active=false;clearTimeout(timer);};
 },[round]);
 const written=responses.filter(row=>typeof row.answers?.[questionId]==='string' && row.answers[questionId].trim());
 return <section className="finance-written-responses" aria-label="학생 서답형 답안">
  <h3>학생 답안 <small>저장된 답안이 자동으로 갱신됩니다.</small></h3>
  {error && <p role="alert">{error}</p>}
  {loading ? <p role="status">답안을 불러오는 중입니다.</p> : !written.length && <p>아직 저장된 답안이 없습니다.</p>}
  {written.map(row=><article key={row.nickname}><strong>{row.nickname}</strong><span>{row.submittedAt?'제출 완료':'임시 저장'}</span><p>{row.answers[questionId]}</p></article>)}
 </section>;
}
