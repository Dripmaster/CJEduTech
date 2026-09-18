import {lessons} from '../data/course-content.js';
import {mergeLessonResults} from '../services/lesson-results.js';
import {getRoomArchive} from '../services/socket.service.js';
// server/routes/socket.routes.js
import { Router } from "express";
import { getOverview } from "../services/socket.service.js";

import { getRoomResult, getUserLastResult } from "../services/socket.service.js";

const router = Router();

// GET /api/chat/overview
router.get("/overview", (req, res) => {
  try {
    const data = getOverview();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "overview_failed" });
  }
});
router.get("/result/:roomId", (req, res) => {
  const data = getRoomResult(req.params.roomId);
  if (!data) return res.status(404).json({ error: "not_found" });

  res.json(data);
});

router.get('/lesson-result/:roomId/:round', async (req,res) => {
  const lesson=lessons.find(l=>l.id===Number(req.params.round));
  if(!lesson?.activityIds.length) return res.status(400).json({error:'no_discussion'});
  const base=req.params.roomId.replace(/__r\d+$/,'');
  const results=await Promise.all(lesson.activityIds.map(async videoId=>{
    const id=`${base}__r${videoId+1}`;
    return getRoomResult(id)||await getRoomArchive(id);
  }));
  if(!results.some(Boolean)) return res.status(404).json({error:'not_found'});
  res.json(mergeLessonResults(results,lesson.id));
});

router.get("/my-result", (req, res) => {
  const { nickname } = req.query || {};

  console.log("my result",nickname);
  if (!nickname) return res.status(400).json({ error: "nickname_required" });
  const data = getUserLastResult(String(nickname));
  if (!data) return res.status(404).json({ error: "not_found" });

  res.json(data);
});
export default router;
