import {Router} from 'express';
import {quizQuestions, validateAnswers, gradeAnswers} from '../data/quiz-rules.js';
import {getQuizResponse, listQuizResponses, saveQuizResponse} from '../repositories/quiz-responses.repo.js';
const router=Router();
// Parent quiz router authenticates every request. Student identity always comes from the token.
router.get('/:round/class',async(req,res,next)=>{
 if(req.user.role!=='admin') return res.status(403).json({message:'강사만 학생 답안을 확인할 수 있습니다.'});
 try {const round=Number(req.params.round);quizQuestions(round);res.json({responses:await listQuizResponses(round)});}catch(error){next(error);}
});
router.get('/:round',async(req,res,next)=>{
 try {const round=Number(req.params.round);quizQuestions(round);res.json(await getQuizResponse(req.user.uid,round));}catch(error){next(error);}
});
const save=submit=>async(req,res,next)=>{
 if(req.user.role==='admin') return res.status(403).json({message:'학생 화면에서 답안을 제출해 주세요.'});
 try {
  const round=Number(req.params.round);
  const answers=validateAnswers(round,req.body?.answers,submit);
  const grade=submit?gradeAnswers(round,answers):null;
  res.json(await saveQuizResponse(req.user.uid,round,answers,grade));
 } catch(error){next(error);}
};
router.put('/:round',save(false));
router.post('/:round/submit',save(true));
export default router;
