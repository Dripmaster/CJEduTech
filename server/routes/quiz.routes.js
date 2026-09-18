import quizResponses from './quiz-responses.routes.js';


// server/routes/quiz.routes.js
import { Router } from 'express';
import { z } from 'zod';
import { authRequired } from '../middlewares/auth.js';
import { getUserScores, saveRoundScore } from '../services/quiz.service.js';

const router = Router();

// 모든 퀴즈 관련 라우트는 인증 필요
router.use(authRequired);
router.use('/responses',quizResponses);

// GET /api/quiz/scores/me -> 현재 사용자 점수 조회
router.get('/scores/me', async (req, res, next) => {
  try {
    const scores = await getUserScores(req.user.uid);
    res.json(
      scores || {
        user_id: req.user.uid,
        round1_score: null,
        round2_score: null,
        round3_score: null,
        round4_score: null,
      }
    );
  } catch (e) {
    next(e);
  }
});

// POST /api/quiz/scores -> 라운드별 점수 저장
const bodySchema = z.object({
  round: z.number().int().min(1).max(4),
  correct: z.number().int().min(0),
  total: z.number().int().min(1),
});

router.post('/scores', async (req, res, next) => {
  try {
    const { round, correct, total } = bodySchema.parse(req.body);
    const result = await saveRoundScore({
      user_id: req.user.uid,
      round,
      correct,
      total,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

export default router;