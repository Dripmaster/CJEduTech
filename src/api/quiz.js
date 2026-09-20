

// src/api/quiz.js
// 퀴즈 점수 관련 API 래퍼
// - 모든 요청은 http 유틸을 통해 현재 탭의 인증 토큰이 적용됩니다.
import { http } from '@/lib/http';
import {TOKEN_KEY} from '../lib/tab-session.js';
import {createAnswerSaver} from '../lib/quiz-autosave.js';
import {validateAnswers} from '../../server/data/quiz-rules.js';

export const quizApi = {
  getResponse: round => http.get(`/api/quiz/responses/${round}`),
  saveDraft: (round, answers) => http.put(`/api/quiz/responses/${round}`, {answers}),
  submitAnswers: (round, answers) => http.post(`/api/quiz/responses/${round}/submit`, {answers}),
  getClassResponses: round => http.get(`/api/quiz/responses/${round}/class`),
  /** 내(로그인 유저) 점수 조회 */
  getMyScores: () => http.get('/api/quiz/scores/me'),

  /** 라운드 점수 저장: round(1~4), correct(정답수), total(총 문항수) */
  submitRoundScore: ({ round, correct, total }) =>
    http.post('/api/quiz/scores', { round, correct, total }),
};
// Keep the queue across route changes so teacher-driven navigation cannot discard a pending edit.
const answerSavers=new Map();
export function getAnswerSaver(round,draftKey) {
 const token=sessionStorage.getItem(TOKEN_KEY);
 const scope=`${token}:${round}`;
 if(!answerSavers.has(scope))answerSavers.set(scope,createAnswerSaver({
  save:async answers=>{
   if(sessionStorage.getItem(TOKEN_KEY)!==token)throw new Error('접속 계정이 변경되었습니다.');
   let complete=true;
   try{validateAnswers(round,answers,true);}catch{complete=false;}
   return complete?quizApi.submitAnswers(round,answers):quizApi.saveDraft(round,answers);
  },
  onSaved:answers=>{
   try{if(sessionStorage.getItem(draftKey)===JSON.stringify(answers))sessionStorage.removeItem(draftKey);}catch{/* Keep server save independent of browser storage. */}
  },
 }));
 return answerSavers.get(scope);
}

export async function flushPendingQuizAnswers() {
 const prefix=`${sessionStorage.getItem(TOKEN_KEY)}:`;
 await Promise.all([...answerSavers].filter(([key])=>key.startsWith(prefix)).map(([,saver])=>saver.flush()));
}
