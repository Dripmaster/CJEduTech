// Browser-local session only. Never delete server-side submissions here.
export const TOKEN_KEY = 'financial-education.auth-token';
const keys = ['nickname','avatarUrl','isAdmin','videoId','round','step','roomId','topic',
  'lastRoomId','myNickname','userNickname','user_name',
  'financial-education.progress.v1','financial-education.progress.v2','financial-education.last-quiz-command',TOKEN_KEY];
export function clearTabSession(storage = sessionStorage) {
  for (const key of keys) storage.removeItem(key);
  for (const key of Object.keys(storage)) if(key.startsWith('financial-education.quiz-draft.')) storage.removeItem(key);
}
export function prepareTabSession(pathname, storage = sessionStorage) {
  const teacherEntry = pathname === '/admin/session';
  const studentEntry = pathname === '/' || pathname === '/user/login';
  if (teacherEntry && storage.getItem('isAdmin') !== 'true') clearTabSession(storage);
  if (studentEntry && storage.getItem('isAdmin') === 'true') clearTabSession(storage);
  if (studentEntry) storage.setItem('isAdmin','false');
}
