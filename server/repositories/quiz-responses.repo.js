import {pool} from '../db.js';
function unpack(row) {
 if(!row) return {answers:{},submittedAt:null,updatedAt:null};
 return {answers:typeof row.answers==='string'?JSON.parse(row.answers):row.answers,
   submittedAt:row.submitted_at,updatedAt:row.updated_at,...(row.nickname?{nickname:row.nickname}:{})};
}
export async function getQuizResponse(userId,round) {
 const [rows]=await pool.query('SELECT answers, submitted_at, updated_at FROM user_quiz_responses WHERE user_id = ? AND round_number = ?',[userId,round]);
 return unpack(rows[0]);
}
export async function listQuizResponses(round) {
 const [rows]=await pool.query('SELECT u.nickname, r.answers, r.submitted_at, r.updated_at FROM user_quiz_responses r JOIN users u ON u.user_id = r.user_id WHERE r.round_number = ? ORDER BY u.nickname',[round]);
 return rows.map(unpack);
}
export async function saveQuizResponse(userId,round,answers,grade=null) {
 round=Number(round);
 if(![1,2].includes(round)) throw Object.assign(new Error('퀴즈 차시가 아닙니다.'),{status:400});
 const connection=await pool.getConnection();
 try {
  await connection.beginTransaction();
  await connection.query(`INSERT INTO user_quiz_responses (user_id, round_number, answers, submitted_at) VALUES (?, ?, ?, ${grade?'CURRENT_TIMESTAMP':'NULL'}) ON DUPLICATE KEY UPDATE answers = VALUES(answers), submitted_at = VALUES(submitted_at), updated_at = CURRENT_TIMESTAMP`,[userId,round,JSON.stringify(answers)]);
  if(grade) await connection.query(`INSERT INTO user_round_scores (user_id, round${round}_score) VALUES (?, ?) ON DUPLICATE KEY UPDATE round${round}_score = VALUES(round${round}_score), updated_at = CURRENT_TIMESTAMP`,[userId,grade.score]);
  await connection.commit();
  return {ok:true,round,answers,submitted:!!grade,...(grade||{})};
 } catch(error) {await connection.rollback();throw error;}
 finally {connection.release();}
}
