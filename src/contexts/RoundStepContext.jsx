import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { PROGRESS_KEY, restoreProgress, getLesson, getActivity } from '../contents/financial-course.js';
const RoundStepContext = createContext();
export function RoundStepProvider({ children }) {
  const [progress, setProgress] = useState(() => restoreProgress(sessionStorage.getItem(PROGRESS_KEY)));
  const resetProgress = () => setProgress(restoreProgress(null));
  const setRound = (value) => setProgress(prev => {
    const round = typeof value === 'function' ? value(prev.round) : value;
    const lesson = getLesson(round);
    return { ...prev, round: lesson.id, videoId: lesson.activityIds[0] ?? null };
  });
  const setStep = (value) => setProgress(prev => ({ ...prev, step: typeof value === 'function' ? value(prev.step) : value }));
  const setVideoId = (value) => setProgress(prev => {
    const videoId = Number(typeof value === 'function' ? value(prev.videoId) : value);
    return Number.isInteger(videoId) && videoId >= 0 && videoId < 4 ? { ...prev, round: getActivity(videoId).lessonId, videoId } : prev;
  });
  const applyProgress = useCallback(value => setProgress(restoreProgress(JSON.stringify(value))), []);
  useEffect(() => {
    sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    // Existing discussion components still read these keys.
    for (const [key, value] of Object.entries(progress)) sessionStorage.setItem(key, String(value));
  }, [progress]);
  return <RoundStepContext.Provider value={{ ...progress, setRound, setStep, setVideoId, resetProgress, applyProgress }}>{children}</RoundStepContext.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components -- Context provider and its consumer hook share the existing module.
export function useRoundStep() {
  const context = useContext(RoundStepContext);
  if (!context) throw new Error('RoundStepProvider is required');
  return context;
}
