

// server/repositories/quiz.repo.js
import { pool } from '../db.js';

/**
 * 사용자별 4차시 스코어 조회
 * @param {string} user_id
 * @returns {Promise<{user_id:string, round1_score:number|null, round2_score:number|null, round3_score:number|null}|null>}
 */
export async function getScoresByUserId(user_id) {
  const [rows] = await pool.query(
    'SELECT user_id, round1_score, round2_score, round3_score, round4_score FROM user_round_scores WHERE user_id = ? LIMIT 1',
    [user_id]
  );
  return rows[0] || null;
}

/**
 * 특정 라운드 스코어 업서트 (INSERT ... ON DUPLICATE KEY UPDATE)
 * @param {Object} params
 * @param {string} params.user_id
 * @param {1|2|3|4} params.round
 * @param {number} params.score  // 0.000 ~ 1.000 (DECIMAL(6,3) 권장)
 * @returns {Promise<boolean>}   // true면 성공
 */
export async function upsertRoundScore({ user_id, round, score }) {
  if (![1, 2, 3, 4].includes(Number(round))) {
    throw Object.assign(new Error('round must be 1, 2, 3, or 4'), { status: 400 });
  }
  const col = `round${Number(round)}_score`;

  // INSERT 시 PK(user_id)로 신규 생성, 존재 시 해당 라운드 컬럼만 갱신
  const sql = `
    INSERT INTO user_round_scores (user_id, ${col})
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE
      ${col} = VALUES(${col}),
      updated_at = CURRENT_TIMESTAMP
  `;

  const [result] = await pool.query(sql, [user_id, score]);
  // 결과가 OK이면 true 반환 (affectedRows: insert=1, upsert=2로 올 수 있음)
  return result.affectedRows > 0;
}