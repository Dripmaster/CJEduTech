import test from 'node:test';
import assert from 'node:assert/strict';
import { getLesson, nextLesson, scoreQuiz, quizResults, restoreProgress, afterTheory, lessonSteps, syncTarget } from '../src/contents/financial-course.js';

test('next lesson resets the video index and ends only after lesson four', () => {
  assert.deepEqual(nextLesson(1), { round: 2, step: 1, videoId: 1, final: false });
  assert.deepEqual(nextLesson(3), { round: 4, step: 1, videoId: 3, final: false });
  assert.equal(nextLesson(4).final, true);
  assert.throws(() => nextLesson(5), RangeError);
});
test('restore ignores legacy session positions and derives video from lesson', () => {
  assert.deepEqual(restoreProgress(null), { round: 1, step: 1, videoId: 0 });
  assert.deepEqual(restoreProgress('{"round":4,"step":3,"videoId":9}'), { round: 4, step: 3, videoId: 3 });
  assert.deepEqual(restoreProgress('{"round":8,"step":3}'), { round: 1, step: 1, videoId: 0 });
  assert.deepEqual(restoreProgress('broken'), { round: 1, step: 1, videoId: 0 });
});
test('theory preserves page order while moving quizzes to their own phase', () => {
  const lesson = getLesson(1);
  assert.deepEqual(lesson.theoryPages.slice(0,7), [5,6,7,8,10,11,13]);
  assert.equal(lesson.theoryPages.includes(22), true);
  assert.deepEqual(lesson.quizPages.map(p => p.page), [9,12,26]);
  assert.equal(getLesson(4).theoryPages.at(-1),60);
});
test('unanswered and explanation-only questions cannot produce a completed score', () => {
  assert.equal(scoreQuiz(1, {}).complete, false);
  assert.deepEqual(scoreQuiz(1, {'p9-q1':2,'p9-q2':1,'p12-q1':1,'p12-q2':1,'p26-q1':1}), {complete:true,correct:5,total:5});
  assert.equal(scoreQuiz(1, {'p9-q1':99}).complete,false);
  assert.deepEqual(scoreQuiz(3,{}), {complete:false,correct:0,total:0});
});
test('skipped quizzes ignore any legacy score and are not marked missing', () => {
  const result=quizResults({round1_score:'0.8',round2_score:0,round3_score:1,round4_score:0});
  assert.equal(result[0].correctRate,80);
  assert.equal(result[0].correctCount,4);
  assert.equal(result[1].correctRate,0);
  assert.equal(result[2].correctRate,null);
  assert.equal(result[3].totalQuestions,0);
  assert.equal(result[2].status,'not_applicable');
  assert.equal(result[3].status,'not_applicable');
});

test('saved quiz positions in lessons three and four resume at the video', () => {
  for (const round of [3,4]) assert.deepEqual(restoreProgress(JSON.stringify({round,step:2})), {round,step:3,videoId:round-1});
  assert.equal(restoreProgress('{"round":2,"step":2}').step,2);
});

test('reconnects catch up skipped-quiz lessons without rewinding completed stages', () => {
  const state = {round:3, commandId:'next-3', step:3};
  assert.deepEqual(syncTarget(state,{round:3,step:1},false),{step:3,path:'video',label:'영상'});
  assert.equal(syncTarget(state,{round:3,step:3},false),null);
  assert.equal(syncTarget(state,{round:3,step:5},false),null);
  assert.equal(syncTarget(state,{round:4,step:1},false),null);
  assert.deepEqual(syncTarget(state,{round:3,step:2},true),{step:3,path:'video',label:'영상'});
  assert.equal(syncTarget({round:5,commandId:'invalid'},{round:1,step:1},true),null);
  assert.equal(syncTarget({round:3},{round:1,step:1},true),null);
  assert.deepEqual(afterTheory(2),{step:2,path:'quiz',label:'퀴즈'});
  assert.deepEqual(lessonSteps(3).map(s=>s.step),[1,3,4,5]);
  assert.deepEqual(lessonSteps(1).map(s=>s.step),[1,2,3,4,5]);
});
