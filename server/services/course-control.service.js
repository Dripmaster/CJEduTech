import {lessons} from '../data/course-content.js';
import {isTeacherSocket} from '../middlewares/teacher.js';
import {randomUUID} from 'node:crypto';

// One class per dedicated financial-education server. This must not join a
// discussion room: discussion timers and AI activity start later in the course.
export function initCourseControl(io) {
  const namespace = io.of('/chat');
  const courseRoom = 'financial-course';
  let state = null;
  namespace.on('connection', socket => {
    socket.on('course:join', (payload, reply) => {
      // Client-provided role flags never grant teacher permissions.
      socket.data.courseTeacher = isTeacherSocket(socket);
      socket.join(courseRoom);
      if (typeof reply === 'function') reply({ok:true, state});
    });
    socket.on('course:slide', (payload, reply) => {
      const respond=value=>{if(typeof reply==='function') reply(value);};
      if(!socket.rooms.has(courseRoom) || !isTeacherSocket(socket)) return respond({ok:false,error:'강사만 슬라이드를 넘길 수 있습니다.'});
      const lesson=lessons.find(l=>l.id===payload?.round);
      const pages=lesson ? (lesson.id===1 ? [1,2,3,4,...lesson.theoryPages] : lesson.theoryPages) : [];
      if(!pages.includes(payload?.page)) return respond({ok:false,error:'현재 차시의 이론 슬라이드가 아닙니다.'});
      if(state && lesson.id < state.round) return respond({ok:false,error:'이미 지난 차시입니다. 현재 수업 차시를 확인해 주세요.'});
      if(state?.round===lesson.id && state.step!==1) return respond({ok:false,error:'이미 다음 단계를 시작했습니다.'});
      if(state?.round!==lesson.id || state?.page!==payload.page || state?.step!==1)
        state={round:lesson.id,step:1,page:payload.page,commandId:randomUUID()};
      namespace.to(courseRoom).emit('course:slide',state);
      respond({ok:true,state});
    });
    socket.on('course:start-quiz', (payload, reply) => {
      const respond = value => { if (typeof reply === 'function') reply(value); };
      if (!socket.rooms.has(courseRoom) || !isTeacherSocket(socket)) {
        respond({ok:false, error:'강사 화면에서 다음 단계를 시작해 주세요.'});
        return;
      }
      if (!Number.isInteger(payload?.round) || payload.round < 1 || payload.round > 4) {
        respond({ok:false, error:'차시는 1~4여야 합니다.'});
        return;
      }
      if (state && payload.round < state.round) {
        respond({ok:false, error:'이미 지난 차시입니다. 현재 수업 차시를 확인해 주세요.'});
        return;
      }
      // Keep legacy event names during rollout. Lessons 3/4 continue at video.
      // A retry after an interrupted acknowledgement keeps the same command.
      if (state?.round !== payload.round || state.step === 1) state = {round:payload.round, step:payload.round <= 2 ? 2 : 3, commandId:randomUUID()};
      namespace.to(courseRoom).emit('course:quiz', state);
      respond({ok:true, state});
    });
  });
}
