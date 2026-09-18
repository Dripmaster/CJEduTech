import {createContext, useContext, useEffect, useState, useCallback} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {syncTarget} from '../../contents/financial-course.js';
import {socket} from '../../api/chat';
import {useUser} from '../../contexts/UserContext';
import {useRoundStep} from '../../contexts/RoundStepContext';

const QuizSyncContext = createContext();
const HANDLED_KEY = 'financial-education.last-quiz-command';
const entryPages = new Set(['/user/login', '/user/selectAvatar', '/user/end']);

export default function QuizSync({children}) {
  const {isAdmin, nickname} = useUser();
  const {round, step, applyProgress} = useRoundStep();
  const {pathname} = useLocation();
  const navigate = useNavigate();
  const [connected, setConnected] = useState(false);
  const [pending, setPending] = useState(null);

  useEffect(() => {
    let active = true;
    let retryTimer;
    let generation = 0;
    const onConnect = () => {
      clearTimeout(retryTimer);
      const request = ++generation;
      setConnected(false);
      socket.timeout(5000).emit('course:join', {isAdmin}, (error, response) => {
        if (!active || request !== generation || !socket.connected) return;
        setConnected(!error && response?.ok === true);
        if (error || !response?.ok) retryTimer = setTimeout(onConnect, 1000);
        if (!error && response?.state) setPending({state:response.state, live:false});
      });
    };
    const onDisconnect = () => {
      generation++;
      clearTimeout(retryTimer);
      setConnected(false);
    };
    const onQuiz = state => setPending({state, live:true});
    const onOnline = () => {
      if (!socket.connected) socket.connect();
      else onConnect();
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('course:quiz', onQuiz);
    socket.on('course:slide', onQuiz);
    window.addEventListener('online', onOnline);
    if (socket.connected) onConnect();
    return () => {
      active = false;
      clearTimeout(retryTimer);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('course:quiz', onQuiz);
      socket.off('course:slide', onQuiz);
      window.removeEventListener('online', onOnline);
    };
  }, [isAdmin]);

  useEffect(() => {
    const state = pending?.state;
    if (isAdmin || !nickname || !pathname.startsWith('/user/') || entryPages.has(pathname)) return;
    if (!state?.commandId || !Number.isInteger(state.round) || state.round < 1 || state.round > 4) return;
    if (sessionStorage.getItem(HANDLED_KEY) === state.commandId) return;
    sessionStorage.setItem(HANDLED_KEY, state.commandId);
    const target = syncTarget(state, {round, step}, pending.live);
    if (!target) return;
    applyProgress({round:state.round,step:target.step});
    navigate(`/user/${target.path}`, {replace:true});
  }, [pending, isAdmin, nickname, pathname, round, step, applyProgress, navigate]);

  const startNext = lessonRound => new Promise((resolve, reject) => {
    if (!connected || !socket.connected) {
      reject(new Error('수업 서버 연결 후 다시 눌러 주세요.'));
      return;
    }
    socket.timeout(5000).emit('course:start-quiz', {round:lessonRound}, (error, response) => {
      if (error || !response?.ok) reject(new Error(response?.error || '다음 단계 시작을 확인하지 못했습니다. 다시 눌러 주세요.'));
      else resolve(response.state);
    });
  });

  const publishSlide = useCallback((lessonRound, page) => new Promise((resolve,reject) => {
    if(!connected || !socket.connected) return reject(new Error('수업 서버에 연결 중입니다.'));
    socket.timeout(5000).emit('course:slide',{round:lessonRound,page},(error,response)=>{
      if(error || !response?.ok) reject(new Error(response?.error || '슬라이드 전환을 확인하지 못했습니다. 다시 시도해 주세요.'));
      else {setPending({state:response.state,live:true});resolve(response.state);}
    });
  }),[connected]);

  return <QuizSyncContext.Provider value={{connected, startNext, publishSlide, state:pending?.state}}>{children}</QuizSyncContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- Provider and hook form one course control API.
export function useQuizSync() {
  return useContext(QuizSyncContext);
}
