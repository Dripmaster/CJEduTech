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
      // Keep legacy event names during rollout. Lessons 3/4 continue at video.
      // A retry after an interrupted acknowledgement keeps the same command.
      if (state?.round !== payload.round) state = {round:payload.round, step:payload.round <= 2 ? 2 : 3, commandId:randomUUID()};
      namespace.to(courseRoom).emit('course:quiz', state);
      respond({ok:true, state});
    });
  });
}
