import { lessons, activities } from './financial-course-data.js';
export { lessons, activities };
export const AXES = ['금융이해', '위험인식', '계획성', '실천의지'];
export const STEPS = ['이론', '퀴즈', '영상', '토론', '중간 대시보드'];
export const PROGRESS_KEY = 'financial-education.progress.v2';
export function getLesson(round) {
  const lesson = lessons.find(item => item.id === Number(round));
  if (!lesson) throw new RangeError('차시는 1~4여야 합니다.');
  return lesson;
}
export function getActivity(videoId) {
  const activity = activities.find(item => item.videoId === videoId);
  if (!activity) throw new RangeError('알 수 없는 영상 활동입니다.');
  return activity;
}
export function theoryPages(round) {
  const pages = getLesson(round).theoryPages;
  return round === 1 ? [1,2,3,4,...pages] : pages;
}
export function lessonProgress(round, step = 1) {
  return {round, step, videoId:getLesson(round).activityIds[0] ?? null};
}
// Step IDs stay stable; video IDs identify activities independently of lessons.
export function afterTheory(round) {
  return getLesson(round).quizEnabled
    ? {step: 2, path: 'quiz', label: '퀴즈'}
    : {step: 3, path: 'video', label: '영상'};
}
export function afterQuiz(round) {
  if (!getLesson(round).activityIds.length) return {...lessonProgress(round+1),path:'slide',label:`${round+1}차시 이론`};
  return {...lessonProgress(round,3),path:'video',label:'영상'};
}
export function afterDiscussion(round, videoId) {
  const ids=getLesson(round).activityIds;
  const index=ids.indexOf(videoId);
  if(index<0) throw new RangeError('현재 차시의 토론이 아닙니다.');
  const next=ids[index+1];
  return next === undefined
    ? {round,step:5,videoId,path:'discussionResult',label:'중간 대시보드'}
    : {round,step:3,videoId:next,path:'video',label:getActivity(next).videoTitle};
}
export function lessonSteps(round) {
  const lesson=getLesson(round);
  return STEPS.map((label, index) => ({step: index + 1, label}))
    .filter(item => (item.step !== 2 || lesson.quizEnabled) && (item.step < 3 || lesson.activityIds.length));
}
export function syncTarget(state, progress, live) {
  if (!state?.commandId || !Number.isInteger(state.round) || state.round < 1 || state.round > 4) return null;
  if(state.step === 1) {
    if(!theoryPages(state.round).includes(state.page)) return null;
    // Late slide packets must not rewind a student already doing this lesson's quiz/video.
    if(progress.round === state.round && progress.step > 1) return null;
    if(!live && progress.round > state.round) return null;
    return {step:1,path:'slide',label:'이론'};
  }
  const target = afterTheory(state.round);
  if (!live && (progress.round > state.round || (progress.round === state.round && progress.step >= target.step))) return null;
  return target;
}
export function nextLesson(round) {
  const current = getLesson(round);
  if (current.id === 4) return {...lessonProgress(4,5), final:true};
  return {...lessonProgress(current.id+1),final:false};
}
export function restoreProgress(raw) {
  const initial = lessonProgress(1);
  try {
    const value = JSON.parse(raw);
    if (!value || !Number.isInteger(value.round) || !Number.isInteger(value.step) || value.step < 1 || value.step > 5) return initial;
    const lesson=getLesson(value.round);
    let step=value.step;
    if(step===2 && !lesson.quizEnabled) step=3;
    if(step>=3 && !lesson.activityIds.length) return lessonProgress(value.round+1);
    return {round:lesson.id,step,videoId:lesson.activityIds.includes(value.videoId)?value.videoId:lesson.activityIds[0]??null};
  } catch { return initial; }
}
export function scoreQuiz(round, answers) {
  const lesson = getLesson(round);
  const questions = (lesson.quizEnabled ? lesson.quizPages : []).flatMap(page => page.questions).filter(q => q.kind === 'choice');
  return {
    complete: questions.length > 0 && questions.every(q => Number.isInteger(answers[q.id]) && answers[q.id] >= 0 && answers[q.id] < q.options.length),
    correct: questions.filter(q => answers[q.id] === q.answer).length,
    total: questions.length,
  };
}
export function quizResults(scores) {
  return lessons.map(lesson => {
    const total = scoreQuiz(lesson.id, {}).total;
    const raw = scores?.[`round${lesson.id}_score`];
    const score = raw == null || !total ? null : Number(raw);
    const valid = score != null && Number.isFinite(score) && score >= 0 && score <= 1;
    return { status: !lesson.quizEnabled ? 'not_applicable' : valid ? 'recorded' : 'missing', round_number: lesson.id, totalQuestions: total, correctCount: valid ? Math.round(score * total) : null, correctRate: valid ? score * 100 : null };
  });
}

// Read saved answers directly: a separate submit click must not be required for results.
export function quizResultsFromAnswers(responses) {
  return lessons.map(lesson => {
    const answers=responses?.[lesson.id]||{};
    const result=scoreQuiz(lesson.id,answers);
    const questions=lesson.quizPages.flatMap(page=>page.questions).filter(q=>q.kind==='choice');
    const answered=questions.filter(q=>Number.isInteger(answers[q.id]) && answers[q.id]>=0 && answers[q.id]<q.options.length).length;
    return {round_number:lesson.id,totalQuestions:result.total,
      status:!lesson.quizEnabled?'not_applicable':!answered?'missing':result.complete?'recorded':'partial',
      correctCount:answered?result.correct:null,correctRate:answered?result.correct/result.total*100:null,
      unansweredCount:result.total-answered};
  });
}
