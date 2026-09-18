// server/routes/review.routes.js
import {authRequired} from '../middlewares/auth.js';
import { Router } from 'express';
import { generateOverallSummary, getOverallSummary, generateFinalResult, getFinalResult, generateMultiVideoFinalResult } from '../services/review.service.js';

const router = Router();
router.use(authRequired);
router.use((req, res, next) => {
  if (req.user.role === 'admin') return next();
  const target = req.body?.nickname || req.query?.nickname;
  if ((target && target !== req.user.nn) || String(req.query?.force).toLowerCase() === 'true') {
    return res.status(403).json({message:'접근 권한이 없습니다.'});
  }
  next();
});

// POST /api/review/:roomId/final-result   body: { nickname }
router.post('/:roomId/final-result', async (req, res) => {
    console.log("final post");
  try {
    const { roomId } = req.params;
    const nickname = req.user.role === 'admin' ? (req.body?.nickname || req.query?.nickname || '') : req.user.nn;
    const force = String(req.query?.force || '').toLowerCase() === 'true';
    const result = await generateFinalResult(roomId, nickname, { force });
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ error: 'final_result_failed', message: e?.message });
  }
});

// GET /api/review/:roomId/final-result?nickname=...  (return cached)
router.get('/:roomId/final-result', (req, res) => {
      console.log("final get");
  try {
    const { roomId } = req.params;
    const nickname = req.user.role === 'admin' ? (req.body?.nickname || req.query?.nickname || '') : req.user.nn;
    const v = getFinalResult(roomId, nickname);
    if (!v) return res.status(404).json({ error: 'not_found' });
    return res.json(v);
  } catch (e) {
    return res.status(500).json({ error: 'final_result_failed', message: e?.message });
  }
});

// POST /api/review/:roomId/multi-final-result  body: { nickname, videoIds: [] }
router.post('/:roomId/multi-final-result', async (req, res) => {
  try {
    const { roomId } = req.params;
    const nickname = req.user.role === 'admin' ? (req.body?.nickname || req.query?.nickname || '') : req.user.nn;
    const videoIds = Array.isArray(req.body?.videoIds) ? req.body.videoIds : [];
    if (!videoIds.length) return res.status(400).json({ error: 'videoIds_required' });
    const force = String(req.query?.force || '').toLowerCase() === 'true';
    const result = await generateMultiVideoFinalResult(roomId, nickname, videoIds, { force, deferAI:req.body?.deferAI === true, retryAI:req.body?.retryAI === true });
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ error: 'multi_final_result_failed', message: e?.message });
  }
});

// POST /api/review/:roomId/overall-summary  (generate once; returns cached if exists)
router.post('/:roomId/overall-summary', async (req, res) => {
  try {
    const { roomId } = req.params;

  console.log("post",roomId)
    const force = String(req.query?.force || '').toLowerCase() === 'true';
    const result = await generateOverallSummary(roomId, { force, deferAI:req.body?.deferAI === true, retryAI:req.body?.retryAI === true });
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ error: 'overall_summary_failed', message: e?.message });
  }
});

// GET /api/review/:roomId/overall-summary  (return if generated)
router.get('/:roomId/overall-summary', (req, res) => {
  try {
    const { roomId } = req.params;
    const v = getOverallSummary(roomId);

    if (!v) return res.status(404).json({ error: 'not_found' });
    
    return res.json(v);
  } catch (e) {
    return res.status(500).json({ error: 'overall_summary_failed', message: e?.message });
  }
});

export default router;