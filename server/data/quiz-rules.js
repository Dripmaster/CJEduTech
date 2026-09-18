import {lessons} from './course-content.js';
export const QUIZ_TEXT_LIMIT=2000;
const invalid=message=>{throw Object.assign(new Error(message),{status:400});};
export function quizQuestions(round) {
 const lesson=lessons.find(l=>l.id===Number(round));
 if(!lesson?.quizEnabled) return invalid('이 차시에는 퀴즈가 없습니다.');
 return lesson.quizPages.flatMap(p=>p.questions);
}
export function validateAnswers(round, answers, complete=false) {
 const questions=quizQuestions(round);
 if(!answers || typeof answers!=='object' || Array.isArray(answers)) return invalid('답안 형식이 올바르지 않습니다.');
 if(Object.keys(answers).some(id=>!questions.some(q=>q.id===id))) return invalid('알 수 없는 문항입니다.');
 const clean={};
 for(const question of questions) {
  const value=answers[question.id];
  if(question.kind==='choice') {
   if(value===undefined && !complete) continue;
   if(!Number.isInteger(value) || value<0 || value>=question.options.length) return invalid('선택형 문항에 모두 답해 주세요.');
   clean[question.id]=value;
  } else if(question.kind==='written') {
   if(value===undefined && !complete) continue;
   if(typeof value!=='string') return invalid('서답형 답변은 문자로 작성해 주세요.');
   if(value.length>QUIZ_TEXT_LIMIT) return invalid(`서답형 답변은 ${QUIZ_TEXT_LIMIT}자 이내로 작성해 주세요.`);
   if(complete && !value.trim()) return invalid('서답형 문항에 답변을 작성해 주세요.');
   clean[question.id]=value.trim();
  }
 }
 return clean;
}
export function gradeAnswers(round, answers) {
 const clean=validateAnswers(round,answers,true);
 const questions=quizQuestions(round).filter(q=>q.kind==='choice');
 const correct=questions.filter(q=>clean[q.id]===q.answer).length;
 return {correct,total:questions.length,score:Number((correct/questions.length).toFixed(3))};
}
