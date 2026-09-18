

// src/api/quiz.js
// 퀴즈 점수 관련 API 래퍼
// - 모든 요청은 http 유틸을 통해 현재 탭의 인증 토큰이 적용됩니다.
import { http } from '@/lib/http';

export const quizApi = {
  /** 내(로그인 유저) 점수 조회 */
  getMyScores: () => http.get('/api/quiz/scores/me'),

  /** 라운드 점수 저장: round(1~4), correct(정답수), total(총 문항수) */
  submitRoundScore: ({ round, correct, total }) =>
    http.post('/api/quiz/scores', { round, correct, total }),
};