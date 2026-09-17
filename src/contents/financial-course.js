import { lessons } from './financial-course-data.js';
export { lessons };
export const AXES = ['금융이해', '위험인식', '계획성', '실천의지'];
export const STEPS = ['이론', '퀴즈', '영상', '토론', '중간 대시보드'];
export const PROGRESS_KEY = 'financial-education.progress.v1';
export function getLesson(round) {
  const lesson = lessons.find(item => item.id === Number(round));
  if (!lesson) throw new RangeError('차시는 1~4여야 합니다.');
  return lesson;
}
// Internal step IDs stay stable for saved progress and discussion components.
export function afterTheory(round) {
  return getLesson(round).quizEnabled
    ? {step: 2, path: 'quiz', label: '퀴즈'}
    : {step: 3, path: 'video', label: '영상'};
}
export function lessonSteps(round) {
  return STEPS.map((label, index) => ({step: index + 1, label}))
    .filter(item => item.step !== 2 || getLesson(round).quizEnabled);
}
export function syncTarget(state, progress, live) {
  if (!state?.commandId || !Number.isInteger(state.round) || state.round < 1 || state.round > 4) return null;
  const target = afterTheory(state.round);
  // Reconnects catch up students still in theory, but never rewind later stages.
  if (!live && (progress.round > state.round || (progress.round === state.round && progress.step >= target.step))) return null;
  return target;
}
export function nextLesson(round) {
  const current = getLesson(round);
  if (current.id === 4) return { round: 4, step: 5, videoId: 3, final: true };
  return { round: current.id + 1, step: 1, videoId: current.id, final: false };
}
export function restoreProgress(raw) {
  const initial = { round: 1, step: 1, videoId: 0 };
  try {
    const value = JSON.parse(raw);
    if (!value || !Number.isInteger(value.round) || !Number.isInteger(value.step) || value.step < 1 || value.step > 5) return initial;
    return { round: getLesson(value.round).id, step: value.step === 2 ? afterTheory(value.round).step : value.step, videoId: value.round - 1 };
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
