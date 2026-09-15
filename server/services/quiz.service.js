

// server/services/quiz.service.js
import { getScoresByUserId, upsertRoundScore } from '../repositories/quiz.repo.js';

/**
 * 0~1 사이 스코어 계산(소수점 3자리 반올림)
 * @param {number} correct 정답 수(0 <= correct <= total)
 * @param {number} total   전체 문항 수(>0)
 * @returns {number} 소수점 3자리까지 반올림된 스코어 (예: 0.7 -> 0.700)
 */
export function computeScore({ correct, total }) {
  const c = Number(correct);
  const t = Number(total);
  if (!Number.isFinite(c) || !Number.isFinite(t)) {
    const err = new Error('correct/total must be numbers');
    err.status = 400; throw err;
  }
  if (t <= 0) {
    const err = new Error('total must be greater than 0');
    err.status = 400; throw err;
  }
  if (c < 0 || c > t) {
    const err = new Error('correct must be between 0 and total');
    err.status = 400; throw err;
  }
  const raw = c / t; // 0..1
  return Number(raw.toFixed(3));
}

/**
 * 라운드 스코어 저장(업서트)
 * @param {Object} params
 * @param {string} params.user_id  (필수) 사용자 ID
 * @param {1|2|3|4|string|number} params.round  라운드 번호(1~4)
 * @param {number} params.correct  정답 수
 * @param {number} params.total    전체 문항 수
 * @returns {Promise<{ok:true, round:number, score:number}>}
 */
export async function saveRoundScore({ user_id, round, correct, total }) {
  const r = Number(round);
  if (![1,2,3,4].includes(r)) {
    const err = new Error('round must be 1, 2, 3, or 4');
    err.status = 400; throw err;
  }

  const score = computeScore({ correct, total });
  await upsertRoundScore({ user_id, round: r, score });
  return { ok: true, round: r, score };
}

/**
 * 사용자 스코어 조회(편의 래퍼)
 * @param {string} user_id
 * @returns {Promise<{user_id:string, round1_score:number|null, round2_score:number|null, round3_score:number|null}|null>}
 */
export async function getUserScores(user_id) {
  return getScoresByUserId(user_id);
}